import { randomBytes } from 'crypto';
import type { WebSocket } from 'ws';

const MAX_VIEWERS_PER_ROOM = 200;

interface Room {
  readonly roomId: string;
  readonly presenterWs: WebSocket;
  readonly viewers: Set<WebSocket>;
  readonly createdAt: Date;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  createRoom(presenterWs: WebSocket): string {
    const roomCode = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    const room: Room = {
      roomId: roomCode,
      presenterWs,
      viewers: new Set<WebSocket>(),
      createdAt: new Date(),
    };
    this.rooms.set(roomCode, room);
    return roomCode;
  }

  joinRoom(roomCode: string, viewerWs: WebSocket): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.viewers.size >= MAX_VIEWERS_PER_ROOM) {
      return false;
    }
    room.viewers.add(viewerWs);
    return true;
  }

  leaveRoom(roomCode: string, viewerWs: WebSocket): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.viewers.delete(viewerWs);
  }

  broadcast(roomCode: string, message: Record<string, unknown>): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const json = JSON.stringify(message);
    for (const ws of room.viewers) {
      if (ws.readyState !== 1) {
        room.viewers.delete(ws);
        continue;
      }
      try {
        ws.send(json);
      } catch {
        room.viewers.delete(ws);
      }
    }
  }

  destroyRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    for (const ws of room.viewers) {
      try {
        ws.close(1000);
      } catch (_) {
        void _;
      }
    }
    this.rooms.delete(roomCode);
  }

  getRoomByPresenter(ws: WebSocket): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.presenterWs === ws) {
        return room;
      }
    }
    return undefined;
  }

  getViewerCount(roomCode: string): number {
    return this.rooms.get(roomCode)?.viewers.size ?? 0;
  }
}
