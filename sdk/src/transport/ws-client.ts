import { serializeClientMessage, parseServerMessage, type ServerMessage, type SessionStartMessage } from './protocol.js';
import type { TranslationMode } from '../types.js';

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;

export type WSMessageCallback = (message: ServerMessage) => void;
export type WSStateCallback = (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private audioBuffer: ArrayBuffer[] = [];
  private onMessage: WSMessageCallback | null = null;
  private onStateChange: WSStateCallback | null = null;
  private sessionConfig: { sourceLanguage: string; targetLanguage: string; mode: TranslationMode } | null = null;

  constructor(private readonly serverUrl: string) {}

  connect(
    config: { sourceLanguage: string; targetLanguage: string; mode: TranslationMode; apiKey: string },
    onMessage: WSMessageCallback,
    onStateChange: WSStateCallback,
  ): void {
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.sessionConfig = { sourceLanguage: config.sourceLanguage, targetLanguage: config.targetLanguage, mode: config.mode };
    this.intentionalClose = false;
    this.reconnectAttempts = 0;

    const url = `${this.serverUrl}?apiKey=${encodeURIComponent(config.apiKey)}`;
    this.createConnection(url);
  }

  sendAudio(pcm16: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm16);
    } else {
      this.audioBuffer.push(pcm16);
    }
  }

  sendSessionUpdate(config: { sourceLanguage?: string; targetLanguage?: string; mode?: TranslationMode }): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(serializeClientMessage({ type: 'session.update', config }));
    if (config.sourceLanguage && this.sessionConfig) this.sessionConfig.sourceLanguage = config.sourceLanguage;
    if (config.targetLanguage && this.sessionConfig) this.sessionConfig.targetLanguage = config.targetLanguage;
    if (config.mode && this.sessionConfig) this.sessionConfig.mode = config.mode;
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(serializeClientMessage({ type: 'session.end' }));
      }
      this.ws.close(1000);
      this.ws = null;
    }
    this.onStateChange?.('disconnected');
  }

  private createConnection(url: string): void {
    this.onStateChange?.('connecting');
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStateChange?.('connected');
      this.startHeartbeat();
      this.sendSessionStart();
      this.flushAudioBuffer();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        const msg = parseServerMessage(event.data);
        if (msg) this.onMessage?.(msg);
      }
    };

    this.ws.onclose = () => {
      this.clearHeartbeat();
      if (!this.intentionalClose) {
        this.attemptReconnect(url);
      }
    };

    this.ws.onerror = () => {
      this.onStateChange?.('error');
    };
  }

  private sendSessionStart(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionConfig) return;

    const msg: SessionStartMessage = {
      type: 'session.start',
      config: {
        sourceLanguage: this.sessionConfig.sourceLanguage,
        targetLanguage: this.sessionConfig.targetLanguage,
        mode: this.sessionConfig.mode,
        audioFormat: { encoding: 'pcm16', sampleRate: 16000, channels: 1 },
      },
    };
    this.ws.send(serializeClientMessage(msg));
  }

  private flushAudioBuffer(): void {
    while (this.audioBuffer.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const frame = this.audioBuffer.shift()!;
      this.ws.send(frame);
    }
  }

  private attemptReconnect(url: string): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.onStateChange?.('error');
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.createConnection(url);
    }, delay);
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
