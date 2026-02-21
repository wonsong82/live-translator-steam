import WebSocket from 'ws';
import { ASRError, type ASRProviderConfig, type ConnectionState, type IASRProvider, type TranscriptResult } from './types.js';
import { getLogger } from '../config/logger.js';

const REALTIME_WS_URL = 'wss://api.openai.com/v1/realtime';

function resample16kTo24k(input: Buffer): Buffer {
  const sampleCount = input.length / 2;
  const ratio = 24000 / 16000;
  const outputCount = Math.floor(sampleCount * ratio);
  const output = Buffer.alloc(outputCount * 2);

  for (let i = 0; i < outputCount; i++) {
    const srcIndex = i / ratio;
    const srcFloor = Math.floor(srcIndex);
    const srcCeil = Math.min(srcFloor + 1, sampleCount - 1);
    const frac = srcIndex - srcFloor;

    const s0 = input.readInt16LE(srcFloor * 2);
    const s1 = input.readInt16LE(srcCeil * 2);
    const interpolated = Math.round(s0 + frac * (s1 - s0));

    output.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), i * 2);
  }

  return output;
}

export class OpenAIAdapter implements IASRProvider {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private transcriptCallback: ((result: TranscriptResult) => void) | null = null;
  private errorCallback: ((error: ASRError) => void) | null = null;
  private stateCallback: ((state: ConnectionState) => void) | null = null;
  private readonly log = getLogger().child({ module: 'asr-openai' });
  private accumulatedDeltas = new Map<string, string>();

  constructor(private readonly apiKey: string) {}

  async connect(config: ASRProviderConfig): Promise<void> {
    this.setState('connecting');
    const model = config.model ?? 'gpt-4o-transcribe';

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(
        `${REALTIME_WS_URL}?model=${model}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        },
      );

      this.ws.on('open', () => {
        this.log.info('OpenAI Realtime connection opened');
        this.sendSessionConfig(config);
        this.setState('connected');
        resolve();
      });

      this.ws.on('message', (raw: Buffer) => {
        this.handleServerEvent(raw, config.language ?? 'ko');
      });

      this.ws.on('error', (err) => {
        this.log.error({ err }, 'OpenAI Realtime WS error');
        const asrError = new ASRError(
          err.message,
          'CONNECTION_FAILED',
          'openai',
          true,
        );
        this.errorCallback?.(asrError);
        reject(asrError);
      });

      this.ws.on('close', (code) => {
        this.log.info({ code }, 'OpenAI Realtime connection closed');
        this.setState('disconnected');
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.accumulatedDeltas.clear();
    this.setState('disconnected');
  }

  sendAudio(audioChunk: Buffer): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    // OpenAI Realtime requires 24kHz PCM16. Server receives 16kHz from SDK.
    const resampled = resample16kTo24k(audioChunk);

    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: resampled.toString('base64'),
    }));
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

  private sendSessionConfig(config: ASRProviderConfig): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: config.model ?? 'gpt-4o-transcribe',
          language: config.language ?? 'ko',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
          create_response: false,
        },
        input_audio_noise_reduction: { type: 'near_field' },
      },
    }));
  }

  private handleServerEvent(raw: Buffer, language: string): void {
    let event: { type: string; item_id?: string; delta?: string; transcript?: string; error?: { message?: string; code?: string } };
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.delta': {
        const itemId = event.item_id ?? '';
        const existing = this.accumulatedDeltas.get(itemId) ?? '';
        const accumulated = existing + (event.delta ?? '');
        this.accumulatedDeltas.set(itemId, accumulated);

        this.transcriptCallback?.({
          text: accumulated,
          isFinal: false,
          confidence: 0,
          language,
          timestamp: Date.now(),
          metadata: { itemId },
        });
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const itemId = event.item_id ?? '';
        this.accumulatedDeltas.delete(itemId);

        this.transcriptCallback?.({
          text: event.transcript ?? '',
          isFinal: true,
          confidence: 1,
          language,
          timestamp: Date.now(),
          metadata: { itemId },
        });
        break;
      }

      case 'error': {
        this.log.error({ error: event.error }, 'OpenAI Realtime API error');
        this.errorCallback?.(new ASRError(
          event.error?.message ?? 'OpenAI error',
          'PROVIDER_ERROR',
          'openai',
          true,
        ));
        break;
      }
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallback?.(state);
  }
}
