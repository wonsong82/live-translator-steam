import WebSocket from 'ws';
import { ASRError, type ASRProviderConfig, type ConnectionState, type IASRProvider, type TranscriptResult } from './types.js';
import { getLogger } from '../config/logger.js';

export class Qwen3AsrAdapter implements IASRProvider {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private transcriptCallback: ((result: TranscriptResult) => void) | null = null;
  private errorCallback: ((error: ASRError) => void) | null = null;
  private stateCallback: ((state: ConnectionState) => void) | null = null;
  private readonly log = getLogger().child({ module: 'asr-qwen3' });

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  async connect(config: ASRProviderConfig): Promise<void> {
    this.setState('connecting');
    const url = `ws://${this.host}:${this.port}/ws/transcribe`;

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.log.info({ host: this.host, port: this.port }, 'Qwen3-ASR connected');

        this.ws!.send(JSON.stringify({
          type: 'config',
          language: config.language ?? 'ko',
          model: config.model ?? 'Qwen/Qwen3-ASR-1.7B',
        }));

        this.setState('connected');
        resolve();
      });

      this.ws.on('message', (raw: Buffer) => {
        this.handleMessage(raw, config.language ?? 'ko');
      });

      this.ws.on('error', (err) => {
        this.log.error({ err }, 'Qwen3-ASR WS error');
        const asrError = new ASRError(err.message, 'CONNECTION_FAILED', 'qwen3-asr', true);
        this.errorCallback?.(asrError);
        reject(asrError);
      });

      this.ws.on('close', () => {
        this.log.info('Qwen3-ASR connection closed');
        this.setState('disconnected');
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  sendAudio(audioChunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioChunk);
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

  private handleMessage(raw: Buffer, language: string): void {
    let msg: { type?: string; text?: string; is_final?: boolean; confidence?: number };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'transcript' && msg.text) {
      this.transcriptCallback?.({
        text: msg.text,
        isFinal: Boolean(msg.is_final),
        confidence: msg.confidence ?? 0,
        language,
        timestamp: Date.now(),
      });
    } else if (msg.type === 'error') {
      this.errorCallback?.(new ASRError(
        String(msg.text ?? 'Qwen3-ASR error'),
        'PROVIDER_ERROR',
        'qwen3-asr',
        true,
      ));
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallback?.(state);
  }
}
