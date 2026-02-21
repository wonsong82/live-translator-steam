import speech from '@google-cloud/speech';
import type { Duplex } from 'stream';
import { ASRError, type ASRProviderConfig, type ConnectionState, type IASRProvider, type TranscriptResult } from './types.js';
import { getLogger } from '../config/logger.js';

const STREAM_LIMIT_MS = 290000;

export class GoogleAdapter implements IASRProvider {
  private readonly client: speech.SpeechClient;
  private recognizeStream: Duplex | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private state: ConnectionState = 'disconnected';
  private currentConfig: ASRProviderConfig | null = null;
  private transcriptCallback: ((result: TranscriptResult) => void) | null = null;
  private errorCallback: ((error: ASRError) => void) | null = null;
  private stateCallback: ((state: ConnectionState) => void) | null = null;
  private readonly log = getLogger().child({ module: 'asr-google' });

  constructor() {
    this.client = new speech.SpeechClient();
  }

  async connect(config: ASRProviderConfig): Promise<void> {
    this.currentConfig = config;
    this.setState('connecting');
    this.startStream(config);
    this.scheduleRestart(config);
  }

  async disconnect(): Promise<void> {
    this.clearRestartTimer();
    if (this.recognizeStream) {
      this.recognizeStream.end();
      this.recognizeStream = null;
    }
    this.setState('disconnected');
  }

  sendAudio(audioChunk: Buffer): void {
    if (this.recognizeStream && !this.recognizeStream.destroyed) {
      this.recognizeStream.write(audioChunk);
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

  private startStream(config: ASRProviderConfig): void {
    const request = {
      config: {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 16000,
        languageCode: config.language === 'ko' ? 'ko-KR' : config.language,
        model: config.model ?? 'latest_long',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
      },
      interimResults: true,
    };

    this.recognizeStream = this.client
      .streamingRecognize(request)
      .on('data', (data: {
        results?: Array<{
          isFinal?: boolean;
          alternatives?: Array<{ transcript?: string; confidence?: number }>;
        }>;
      }) => {
        const result = data.results?.[0];
        const alt = result?.alternatives?.[0];
        if (!alt?.transcript) return;

        const transcriptResult: TranscriptResult = {
          text: alt.transcript,
          isFinal: Boolean(result?.isFinal),
          confidence: alt.confidence ?? 0,
          language: config.language ?? 'ko',
          timestamp: Date.now(),
        };

        this.transcriptCallback?.(transcriptResult);
      })
      .on('error', (err: Error & { code?: number }) => {
        if (err.code === 11) {
          this.log.info('Google STT stream limit reached, restarting');
          this.restartStream();
          return;
        }

        this.log.error({ err }, 'Google STT error');
        const asrError = new ASRError(
          err.message,
          err.code === 16 ? 'AUTH_ERROR' : 'PROVIDER_ERROR',
          'google',
          err.code !== 16,
        );
        this.errorCallback?.(asrError);
      })
      .on('end', () => {
        this.log.debug('Google STT stream ended');
      });

    this.setState('connected');
    this.log.info({ language: config.language, model: config.model }, 'Google STT stream started');
  }

  private restartStream(): void {
    if (this.recognizeStream) {
      this.recognizeStream.end();
      this.recognizeStream = null;
    }

    if (this.currentConfig) {
      this.setState('reconnecting');
      this.startStream(this.currentConfig);
      this.scheduleRestart(this.currentConfig);
    }
  }

  private scheduleRestart(_config: ASRProviderConfig): void {
    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      this.log.info('Preemptive stream restart before 5-min limit');
      this.restartStream();
    }, STREAM_LIMIT_MS);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallback?.(state);
  }
}
