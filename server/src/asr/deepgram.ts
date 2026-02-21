import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { ListenLiveClient } from '@deepgram/sdk';
import { ASRError, type ASRProviderConfig, type ConnectionState, type IASRProvider, type TranscriptResult } from './types.js';
import { getLogger } from '../config/logger.js';

const KEEPALIVE_INTERVAL_MS = 8000;

export class DeepgramAdapter implements IASRProvider {
  private readonly client;
  private connection: ListenLiveClient | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private state: ConnectionState = 'disconnected';
  private transcriptCallback: ((result: TranscriptResult) => void) | null = null;
  private errorCallback: ((error: ASRError) => void) | null = null;
  private stateCallback: ((state: ConnectionState) => void) | null = null;
  private readonly log = getLogger().child({ module: 'asr-deepgram' });

  constructor(apiKey: string) {
    this.client = createClient(apiKey);
  }

  async connect(config: ASRProviderConfig): Promise<void> {
    this.setState('connecting');

    return new Promise<void>((resolve, reject) => {
      this.connection = this.client.listen.live({
        model: config.model ?? 'nova-3',
        language: config.language ?? 'ko',
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        interim_results: true,
        smart_format: true,
        endpointing: 300,
        utterance_end_ms: 1000,
        vad_events: true,
        punctuate: true,
      });

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.log.info('Deepgram connection opened');
        this.setState('connected');
        this.keepAliveTimer = setInterval(() => {
          this.connection?.keepAlive();
        }, KEEPALIVE_INTERVAL_MS);
        resolve();
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data.channel?.alternatives?.[0];
        if (!alt?.transcript) return;

        const result: TranscriptResult = {
          text: alt.transcript,
          isFinal: Boolean(data.is_final && data.speech_final),
          confidence: alt.confidence ?? 0,
          language: config.language ?? 'ko',
          timestamp: Date.now(),
          metadata: {
            isFinal: data.is_final,
            speechFinal: data.speech_final,
            start: data.start,
            duration: data.duration,
          },
        };

        this.transcriptCallback?.(result);
      });

      this.connection.on(LiveTranscriptionEvents.Error, (err) => {
        this.log.error({ err }, 'Deepgram error');
        const asrError = new ASRError(
          err.message ?? 'Deepgram error',
          err.statusCode === 401 || err.statusCode === 403 ? 'AUTH_ERROR' : 'PROVIDER_ERROR',
          'deepgram',
          err.statusCode !== 401 && err.statusCode !== 403,
        );
        this.errorCallback?.(asrError);
        if (!asrError.recoverable) {
          reject(asrError);
        }
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        this.log.info('Deepgram connection closed');
        this.clearKeepAlive();
        this.setState('disconnected');
      });
    });
  }

  async disconnect(): Promise<void> {
    this.clearKeepAlive();
    if (this.connection) {
      this.connection.finalize();
      this.connection.requestClose();
      this.connection = null;
    }
    this.setState('disconnected');
  }

  sendAudio(audioChunk: Buffer): void {
    if (this.connection) {
      const arrayBuffer = audioChunk.buffer.slice(
        audioChunk.byteOffset,
        audioChunk.byteOffset + audioChunk.byteLength,
      );
      this.connection.send(arrayBuffer);
    }
  }

  onTranscript(callback: (result: TranscriptResult) => void): void {
    this.transcriptCallback = callback;
  }

  onError(callback: (error: ASRError) => void): void {
    this.errorCallback = callback;
  }

  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.stateCallback = callback;
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallback?.(state);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
