import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { Server as HttpServer } from 'http';
import { Session } from './session.js';
import { RoomManager } from './room-manager.js';
import { getLogger } from '../config/logger.js';
import { loadConfig, resolveProviderConfig } from '../config/index.js';
import { createASRProvider } from '../asr/router.js';
import { createTranslationRouter } from '../translation/router.js';

const MAX_AUDIO_FRAME_SIZE = 32000;

export class WSGateway {
  private readonly wss: WebSocketServer;
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly rooms = new RoomManager();
  private readonly viewers = new Set<WebSocket>();
  private readonly viewerRooms = new Map<WebSocket, string>();
  private readonly aliveViewers = new Set<WebSocket>();
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
      if (session) {
        session.markAlive();
      } else if (this.viewers.has(ws)) {
        this.aliveViewers.add(ws);
      }
    });
  }

  private handleMessage(ws: WebSocket, data: RawData, isBinary: boolean): void {
    if (isBinary) {
      if (this.viewers.has(ws)) {
        this.sendError(ws, 'VIEWER_NO_AUDIO', 'Viewers cannot send audio');
        return;
      }
      this.handleAudioFrame(ws, data as Buffer);
      return;
    }

    try {
      const message = JSON.parse(data.toString()) as { type: string; config?: Record<string, unknown>; roomId?: string };
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

  private handleControlMessage(ws: WebSocket, message: { type: string; config?: Record<string, unknown>; roomId?: string }): void {
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
      case 'room.create':
        this.handleRoomCreate(ws);
        break;
      case 'room.join':
        this.handleRoomJoin(ws, message);
        break;
      case 'room.leave':
        this.handleRoomLeave(ws);
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

  private handleRoomCreate(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (!session) {
      this.sendError(ws, 'NO_SESSION', 'Start a session before creating a room');
      return;
    }
    const roomCode = this.rooms.createRoom(ws);
    session.onSend((msg) => {
      this.rooms.broadcast(roomCode, msg);
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'room.created', roomId: roomCode }));
    }
    this.log.info({ roomCode }, 'room created');
  }

  private handleRoomJoin(ws: WebSocket, message: { type: string; roomId?: string }): void {
    const roomId = message.roomId;
    if (!roomId) {
      this.sendError(ws, 'ROOM_ERROR', 'roomId is required');
      return;
    }
    // Check existence first to give a specific error code
    if (!this.rooms.hasRoom(roomId)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room.error', code: 'ROOM_NOT_FOUND', message: 'Room not found' }));
      }
      return;
    }
    const joined = this.rooms.joinRoom(roomId, ws);
    if (!joined) {
      // Room exists but is full
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room.error', code: 'ROOM_FULL', message: 'Room is at capacity' }));
      }
      return;
    }
    this.viewers.add(ws);
    this.viewerRooms.set(ws, roomId);
    this.aliveViewers.add(ws);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'room.joined', roomId }));
    }
    const presenterWs = this.rooms.getPresenterWs(roomId);
    if (presenterWs && presenterWs.readyState === WebSocket.OPEN) {
      presenterWs.send(JSON.stringify({ type: 'room.viewerCount', count: this.rooms.getViewerCount(roomId) }));
    }
    this.log.info({ roomId, totalViewers: this.rooms.getViewerCount(roomId) }, 'viewer joined room');
  }

  private handleRoomLeave(ws: WebSocket): void {
    const roomId = this.viewerRooms.get(ws);
    if (roomId) {
      this.rooms.leaveRoom(roomId, ws);
      this.viewerRooms.delete(ws);
      const presenterWs = this.rooms.getPresenterWs(roomId);
      if (presenterWs && presenterWs.readyState === WebSocket.OPEN) {
        presenterWs.send(JSON.stringify({ type: 'room.viewerCount', count: this.rooms.getViewerCount(roomId) }));
      }
    }
    this.aliveViewers.delete(ws);
    this.viewers.delete(ws);
  }

  private handleClose(ws: WebSocket, code: number, reason: Buffer): void {
    // Handle viewer disconnect
    if (this.viewers.has(ws)) {
      const roomId = this.viewerRooms.get(ws);
      if (roomId) {
        this.rooms.leaveRoom(roomId, ws);
        this.viewerRooms.delete(ws);
        const presenterWs = this.rooms.getPresenterWs(roomId);
        if (presenterWs && presenterWs.readyState === WebSocket.OPEN) {
          presenterWs.send(JSON.stringify({ type: 'room.viewerCount', count: this.rooms.getViewerCount(roomId) }));
        }
      }
      this.aliveViewers.delete(ws);
      this.viewers.delete(ws);
      this.log.info({ code, totalSessions: this.sessions.size }, 'viewer disconnected');
      return;
    }

    // Handle presenter disconnect — destroy room if exists
    const presenterRoom = this.rooms.getRoomByPresenter(ws);
    if (presenterRoom) {
      this.rooms.destroyRoom(presenterRoom.roomId);
      this.log.info({ roomId: presenterRoom.roomId }, 'room destroyed: presenter disconnected');
    }

    // Existing session cleanup
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

      for (const viewerWs of this.viewers) {
        if (!this.aliveViewers.has(viewerWs)) {
          this.log.warn('terminating stale viewer');
          viewerWs.terminate();
          this.viewers.delete(viewerWs);
          const roomId = this.viewerRooms.get(viewerWs);
          if (roomId) {
            this.rooms.leaveRoom(roomId, viewerWs);
            this.viewerRooms.delete(viewerWs);
            const presenterWs = this.rooms.getPresenterWs(roomId);
            if (presenterWs && presenterWs.readyState === WebSocket.OPEN) {
              presenterWs.send(JSON.stringify({ type: 'room.viewerCount', count: this.rooms.getViewerCount(roomId) }));
            }
          }
          continue;
        }
        this.aliveViewers.delete(viewerWs);
        if (viewerWs.readyState === WebSocket.OPEN) {
          viewerWs.ping();
        }
      }
    }, intervalMs);
  }

  async shutdown(): Promise<void> {
    for (const [wsConn, session] of this.sessions) {
      const presenterRoom = this.rooms.getRoomByPresenter(wsConn);
      if (presenterRoom) {
        this.rooms.destroyRoom(presenterRoom.roomId);
      }
      await session.stop();
      wsConn.close(1001, 'server shutting down');
    }
    this.sessions.clear();
    this.wss.close();
  }
}
