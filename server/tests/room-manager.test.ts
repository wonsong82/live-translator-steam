import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomManager } from '../src/ws/room-manager.js';
import type { WebSocket as WsWebSocket } from 'ws';

function mockWs(readyState = 1): WsWebSocket {
  return { readyState, send: vi.fn(), close: vi.fn() } as unknown as WsWebSocket;
}

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('createRoom() returns a 6-char uppercase hex string', () => {
    const presenterWs = mockWs();
    const roomCode = manager.createRoom(presenterWs);
    expect(roomCode).toMatch(/^[A-F0-9]{6}$/);
  });

  it('createRoom() with two different presenters returns different codes', () => {
    const code1 = manager.createRoom(mockWs());
    const code2 = manager.createRoom(mockWs());
    expect(code1).not.toBe(code2);
  });

  it('joinRoom() with valid code returns true', () => {
    const presenterWs = mockWs();
    const roomCode = manager.createRoom(presenterWs);
    const viewerWs = mockWs();
    const result = manager.joinRoom(roomCode, viewerWs);
    expect(result).toBe(true);
  });

  it('joinRoom() with invalid code returns false', () => {
    const result = manager.joinRoom('ZZZZZZ', mockWs());
    expect(result).toBe(false);
  });

  it('joinRoom() at capacity (200) returns false', () => {
    const roomCode = manager.createRoom(mockWs());
    for (let i = 0; i < 200; i++) {
      manager.joinRoom(roomCode, mockWs());
    }
    expect(manager.joinRoom(roomCode, mockWs())).toBe(false);
  });

  it('broadcast() calls send on all viewers', () => {
    const roomCode = manager.createRoom(mockWs());
    const viewer1 = mockWs();
    const viewer2 = mockWs();
    manager.joinRoom(roomCode, viewer1);
    manager.joinRoom(roomCode, viewer2);

    const message = { type: 'transcription.interim', text: '안녕하세요' };
    manager.broadcast(roomCode, message);

    const expectedJson = JSON.stringify(message);
    expect(viewer1.send).toHaveBeenCalledWith(expectedJson);
    expect(viewer2.send).toHaveBeenCalledWith(expectedJson);
  });

  it('broadcast() removes dead viewer (readyState !== 1)', () => {
    const roomCode = manager.createRoom(mockWs());
    const deadViewer = mockWs(3);
    manager.joinRoom(roomCode, deadViewer);

    expect(manager.getViewerCount(roomCode)).toBe(1);

    manager.broadcast(roomCode, { type: 'test' });

    expect(deadViewer.send).not.toHaveBeenCalled();
    expect(manager.getViewerCount(roomCode)).toBe(0);
  });

  it('leaveRoom() removes viewer', () => {
    const roomCode = manager.createRoom(mockWs());
    const viewerWs = mockWs();
    manager.joinRoom(roomCode, viewerWs);

    expect(manager.getViewerCount(roomCode)).toBe(1);

    manager.leaveRoom(roomCode, viewerWs);

    expect(manager.getViewerCount(roomCode)).toBe(0);
  });

  it('destroyRoom() closes all viewers and removes room', () => {
    const roomCode = manager.createRoom(mockWs());
    const viewer1 = mockWs();
    const viewer2 = mockWs();
    manager.joinRoom(roomCode, viewer1);
    manager.joinRoom(roomCode, viewer2);

    manager.destroyRoom(roomCode);

    expect(viewer1.close).toHaveBeenCalledWith(1000);
    expect(viewer2.close).toHaveBeenCalledWith(1000);
    expect(manager.getViewerCount(roomCode)).toBe(0);
  });

  it('getRoomByPresenter() returns room for valid presenter', () => {
    const presenterWs = mockWs();
    const roomCode = manager.createRoom(presenterWs);

    const room = manager.getRoomByPresenter(presenterWs);

    expect(room).toBeDefined();
    expect(room?.roomId).toBe(roomCode);
  });

  it('getRoomByPresenter() returns undefined for unknown presenter', () => {
    manager.createRoom(mockWs());
    const unknownWs = mockWs();

    const room = manager.getRoomByPresenter(unknownWs);

    expect(room).toBeUndefined();
  });
});
