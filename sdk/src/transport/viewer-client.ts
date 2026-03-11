import { serializeClientMessage, parseServerMessage } from './protocol.js';
import type { ServerMessage } from './protocol.js';

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;

export type ViewerMessageCallback = (message: ServerMessage) => void;
export type ViewerStateCallback = (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class ViewerClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private onMessage: ViewerMessageCallback | null = null;
  private onStateChange: ViewerStateCallback | null = null;
  private roomId: string | null = null;

  constructor(private readonly serverUrl: string) {}

  connect(
    config: { roomId: string; apiKey: string },
    onMessage: ViewerMessageCallback,
    onStateChange: ViewerStateCallback,
  ): void {
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.roomId = config.roomId;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;

    const url = `${this.serverUrl}?apiKey=${encodeURIComponent(config.apiKey)}`;
    this.createConnection(url);
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(serializeClientMessage({ type: 'room.leave' }));
      }
      this.ws.close(1000);
      this.ws = null;
    }
    this.onStateChange?.('disconnected');
  }

  private createConnection(url: string): void {
    this.onStateChange?.('connecting');
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.sendRoomJoin();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        const msg = parseServerMessage(event.data);
        if (msg) {
          if (msg.type === 'room.joined') {
            this.onStateChange?.('connected');
          }
          this.onMessage?.(msg);
        }
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

  private sendRoomJoin(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.roomId) return;
    this.ws.send(serializeClientMessage({ type: 'room.join', roomId: this.roomId }));
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
