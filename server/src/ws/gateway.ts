import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { Server as HttpServer } from 'http';
import { Session } from './session.js';
import { getLogger } from '../config/logger.js';
import { loadConfig, resolveProviderConfig } from '../config/index.js';
import { createASRProvider } from '../asr/router.js';
import { createTranslationRouter } from '../translation/router.js';

const MAX_AUDIO_FRAME_SIZE = 32000;

export class WSGateway {
  private readonly wss: WebSocketServer;
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly log = getLogger().child({ module: 'ws-gateway' });

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.log.info('WebSocket gateway initialized');
  }

  private handleConnection(ws: WebSocket): void {
    this.log.info({ totalSessions: this.sessions.size + 1 }, 'client connected');

    ws.on('message', (data, isBinary) => this.handleMessage(ws, data, isBinary));
    ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
    ws.on('error', (err) => this.handleError(ws, err));

    ws.on('pong', () => {
      const session = this.sessions.get(ws);
      if (session) session.markAlive();
    });
  }

  private handleMessage(ws: WebSocket, data: RawData, isBinary: boolean): void {
    if (isBinary) {
      this.handleAudioFrame(ws, data as Buffer);
      return;
    }

    try {
      const message = JSON.parse(data.toString()) as { type: string; config?: Record<string, unknown> };
      this.handleControlMessage(ws, message);
    } catch {
      this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  private handleAudioFrame(ws: WebSocket, chunk: Buffer): void {
    const session = this.sessions.get(ws);
    if (!session) {
      this.sendError(ws, 'NO_SESSION', 'Send session.start before audio');
      return;
    }

    if (chunk.length > MAX_AUDIO_FRAME_SIZE) {
      this.sendError(ws, 'AUDIO_TOO_LARGE', `Audio frame exceeds ${MAX_AUDIO_FRAME_SIZE} bytes`);
      return;
    }

    session.sendAudio(chunk);
  }

  private handleControlMessage(ws: WebSocket, message: { type: string; config?: Record<string, unknown> }): void {
    switch (message.type) {
      case 'session.start':
        this.handleSessionStart(ws, message);
        break;
      case 'session.update':
        this.handleSessionUpdate(ws, message);
        break;
      case 'session.end':
        this.handleSessionEnd(ws);
        break;
      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE', `Unknown message type: ${message.type}`);
    }
  }

  private handleSessionStart(ws: WebSocket, message: { type: string; config?: Record<string, unknown> }): void {
    if (this.sessions.has(ws)) {
      this.sendError(ws, 'SESSION_EXISTS', 'Session already started');
      return;
    }

    const config = message.config as {
      sourceLanguage?: string;
      targetLanguage?: string;
      mode?: string;
      audioFormat?: { encoding?: string; sampleRate?: number; channels?: number };
    } | undefined;

    const envConfig = loadConfig();
    const providerConfig = resolveProviderConfig(envConfig);

    const session = new Session({
      ws,
      sourceLanguage: config?.sourceLanguage ?? 'ko',
      targetLanguage: config?.targetLanguage ?? 'en',
      mode: (config?.mode as 'hybrid' | 'final-only') ?? 'hybrid',
      providerConfig,
      envConfig,
      asrProviderFactory: createASRProvider,
      translationRouter: createTranslationRouter(envConfig),
    });

    this.sessions.set(ws, session);
    session.start().catch((err: unknown) => {
      this.log.error({ err }, 'session start failed');
      this.sendError(ws, 'SESSION_START_FAILED', 'Failed to start session');
      this.sessions.delete(ws);
    });
  }

  private handleSessionUpdate(ws: WebSocket, message: { type: string; config?: Record<string, unknown> }): void {
    const session = this.sessions.get(ws);
    if (!session) {
      this.sendError(ws, 'NO_SESSION', 'No active session');
      return;
    }

    const config = message.config as {
      sourceLanguage?: string;
      targetLanguage?: string;
      mode?: string;
    } | undefined;

    if (config) {
      session.updateConfig(config);
    }
  }

  private async handleSessionEnd(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    await session.stop();
    this.sessions.delete(ws);
    this.log.info({ totalSessions: this.sessions.size }, 'session ended');
  }

  private handleClose(ws: WebSocket, code: number, reason: Buffer): void {
    const session = this.sessions.get(ws);
    if (session) {
      session.stop().catch((err: unknown) => {
        this.log.error({ err }, 'session cleanup failed on close');
      });
      this.sessions.delete(ws);
    }
    this.log.info({ code, reason: reason.toString(), totalSessions: this.sessions.size }, 'client disconnected');
  }

  private handleError(_ws: WebSocket, err: Error): void {
    this.log.error({ err }, 'websocket error');
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', code, message }));
    }
  }

  startHeartbeat(intervalMs = 30000): NodeJS.Timeout {
    return setInterval(() => {
      for (const [ws, session] of this.sessions) {
        if (!session.isAlive()) {
          this.log.warn('terminating stale connection');
          ws.terminate();
          this.sessions.delete(ws);
          continue;
        }
        session.markDead();
        ws.ping();
      }
    }, intervalMs);
  }

  async shutdown(): Promise<void> {
    for (const [wsConn, session] of this.sessions) {
      await session.stop();
      wsConn.close(1001, 'server shutting down');
    }
    this.sessions.clear();
    this.wss.close();
  }
}
