import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket as WsWebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger them
// ---------------------------------------------------------------------------

// Mock the 'ws' module so WebSocketServer doesn't bind to a real port
vi.mock('ws', async () => {
  const { EventEmitter } = await import('events');

  class MockWebSocketServer extends EventEmitter {
    on(_event: string, _listener: (...args: unknown[]) => void) { return this; }
    close() { /* no-op */ }
  }

  // Expose OPEN constant so gateway code `ws.readyState === WebSocket.OPEN` works
  const WebSocket = { OPEN: 1 };

  return { WebSocketServer: MockWebSocketServer, WebSocket };
});

// Mock config so loadConfig() doesn't fail on missing env vars
vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    PORT: 8080,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    ASR_PROVIDER: 'deepgram',
    ASR_MODEL: undefined,
    DEEPGRAM_API_KEY: 'test-key',
    TRANSLATION_INTERIM_PROVIDER: 'google',
    TRANSLATION_FINAL_PROVIDER: 'google',
    TRANSLATION_INTERIM_MODEL: 'nmt',
    TRANSLATION_FINAL_MODEL: 'tllm',
    GOOGLE_TRANSLATION_PROJECT_ID: 'test-project',
    GOOGLE_TRANSLATION_LOCATION: 'us-central1',
    CLAUDE_API_KEY: undefined,
    QWEN_TRANSLATION_URL: 'http://localhost:8002/v1',
    QWEN_TRANSLATION_MODEL: 'Qwen/Qwen3-30B-A3B',
    QWEN3_ASR_ENABLED: false,
    QWEN3_ASR_HOST: 'qwen3-asr',
    QWEN3_ASR_PORT: 8001,
  })),
  resolveProviderConfig: vi.fn(() => ({
    asrProvider: 'deepgram',
    asrModel: undefined,
    translationInterimProvider: 'google',
    translationInterimModel: 'nmt',
    translationFinalProvider: 'google',
    translationFinalModel: 'tllm',
  })),
}));

// Mock ASR router — returns a fake IASRProvider
vi.mock('../src/asr/router.js', () => ({
  createASRProvider: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
    onTranscript: vi.fn(),
    onError: vi.fn(),
    onConnectionStateChange: vi.fn(),
  })),
}));

// Mock translation router — returns a fake TranslationRouter
vi.mock('../src/translation/router.js', () => ({
  createTranslationRouter: vi.fn(() => ({
    translateInterim: vi.fn().mockResolvedValue({ sourceText: '안녕', translatedText: 'Hello' }),
    translateFinal: vi.fn().mockResolvedValue({ sourceText: '안녕하세요', translatedText: 'Hello there' }),
  })),
}));

// Mock logger to suppress output during tests
vi.mock('../src/config/logger.js', () => ({
  getLogger: vi.fn(() => ({
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Import the class under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import { WSGateway } from '../src/ws/gateway.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWs(readyState = 1): WsWebSocket {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
  } as unknown as WsWebSocket;
}

/** Parse the last JSON message sent on a mock WebSocket */
function lastSent(ws: WsWebSocket): Record<string, unknown> {
  const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
  if (calls.length === 0) throw new Error('No messages sent');
  return JSON.parse(calls[calls.length - 1][0] as string) as Record<string, unknown>;
}

/** Find a sent message matching a predicate */
function findSent(ws: WsWebSocket, predicate: (msg: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
  for (const call of calls) {
    const msg = JSON.parse(call[0] as string) as Record<string, unknown>;
    if (predicate(msg)) return msg;
  }
  return undefined;
}

/** Create a fake HttpServer (gateway only uses it to pass to WebSocketServer) */
function fakeHttpServer() {
  return {} as import('http').Server;
}

// ---------------------------------------------------------------------------
// Access private methods via type cast
// ---------------------------------------------------------------------------
type GatewayPrivate = {
  handleConnection(ws: WsWebSocket): void;
  handleMessage(ws: WsWebSocket, data: Buffer | string, isBinary: boolean): void;
  handleClose(ws: WsWebSocket, code: number, reason: Buffer): void;
};

function asPrivate(gateway: WSGateway): GatewayPrivate {
  return gateway as unknown as GatewayPrivate;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WSGateway — room integration', () => {
  let gateway: WSGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new WSGateway(fakeHttpServer());
  });

  // -------------------------------------------------------------------------
  // Test 1: Presenter connects → session.start → room.create → room.created
  // -------------------------------------------------------------------------
  it('presenter creates a room and receives room.created with 6-char roomId', async () => {
    const presenterWs = mockWs();
    const gw = asPrivate(gateway);

    // Register connection
    gw.handleConnection(presenterWs);

    // Start a session
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start', config: { mode: 'hybrid' } }), false);

    // Wait for async session.start() to resolve
    await vi.waitFor(() => {
      const sent = findSent(presenterWs, (m) => m.type === 'session.status');
      return sent !== undefined;
    }, { timeout: 1000 });

    // Create a room
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    expect(roomCreated).toBeDefined();
    expect(typeof roomCreated!.roomId).toBe('string');
    expect((roomCreated!.roomId as string)).toMatch(/^[A-F0-9]{6}$/);
  });

  // -------------------------------------------------------------------------
  // Test 2: Viewer connects → room.join → receives room.joined
  // -------------------------------------------------------------------------
  it('viewer joins an existing room and receives room.joined', async () => {
    const presenterWs = mockWs();
    const viewerWs = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(presenterWs);
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start' }), false);

    await vi.waitFor(() => findSent(presenterWs, (m) => m.type === 'session.status') !== undefined, { timeout: 1000 });

    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    const roomId = roomCreated!.roomId as string;

    // Viewer joins
    gw.handleConnection(viewerWs);
    gw.handleMessage(viewerWs, JSON.stringify({ type: 'room.join', roomId }), false);

    const roomJoined = findSent(viewerWs, (m) => m.type === 'room.joined');
    expect(roomJoined).toBeDefined();
    expect(roomJoined!.roomId).toBe(roomId);
  });

  // -------------------------------------------------------------------------
  // Test 3: Presenter's session onSend fires → viewer receives the message
  // -------------------------------------------------------------------------
  it('viewer receives broadcast when presenter session fires onSend', async () => {
    const presenterWs = mockWs();
    const viewerWs = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(presenterWs);
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start' }), false);

    await vi.waitFor(() => findSent(presenterWs, (m) => m.type === 'session.status') !== undefined, { timeout: 1000 });

    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    const roomId = roomCreated!.roomId as string;

    gw.handleConnection(viewerWs);
    gw.handleMessage(viewerWs, JSON.stringify({ type: 'room.join', roomId }), false);

    // Simulate a transcription message being sent by the session
    // The session's send() method calls sendListeners for transcription.* messages
    // We can trigger this by accessing the session's onSend listeners directly
    // via the gateway's internal sessions map
    const sessions = (gateway as unknown as { sessions: Map<WsWebSocket, { onSend: (cb: (msg: Record<string, unknown>) => void) => void } > }).sessions;
    const session = sessions.get(presenterWs);
    expect(session).toBeDefined();

    // Manually trigger the broadcast by calling the session's send listeners
    // We do this by simulating what session.send() does internally:
    // call all registered onSend listeners with a transcription message
    const transcriptionMsg = { type: 'transcription.final', text: '안녕하세요', language: 'ko', sentenceIndex: 0 };

    // Access the sendListeners array on the session
    const sendListeners = (session as unknown as { sendListeners: Array<(msg: Record<string, unknown>) => void> }).sendListeners;
    expect(sendListeners.length).toBeGreaterThan(0);

    // Fire the listener (simulates session broadcasting)
    for (const listener of sendListeners) {
      listener(transcriptionMsg);
    }

    // Viewer should have received the broadcast
    const viewerReceived = findSent(viewerWs, (m) => m.type === 'transcription.final');
    expect(viewerReceived).toBeDefined();
    expect(viewerReceived!.text).toBe('안녕하세요');
  });

  // -------------------------------------------------------------------------
  // Test 4: Viewer sends binary audio → receives VIEWER_NO_AUDIO error
  // -------------------------------------------------------------------------
  it('viewer sending binary audio receives VIEWER_NO_AUDIO error', async () => {
    const presenterWs = mockWs();
    const viewerWs = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(presenterWs);
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start' }), false);

    await vi.waitFor(() => findSent(presenterWs, (m) => m.type === 'session.status') !== undefined, { timeout: 1000 });

    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    const roomId = roomCreated!.roomId as string;

    gw.handleConnection(viewerWs);
    gw.handleMessage(viewerWs, JSON.stringify({ type: 'room.join', roomId }), false);

    // Viewer sends binary audio
    const audioChunk = Buffer.from([0x01, 0x02, 0x03]);
    gw.handleMessage(viewerWs, audioChunk, true);

    const errorMsg = findSent(viewerWs, (m) => m.type === 'error' && m.code === 'VIEWER_NO_AUDIO');
    expect(errorMsg).toBeDefined();
    expect(errorMsg!.code).toBe('VIEWER_NO_AUDIO');
  });

  // -------------------------------------------------------------------------
  // Test 5: Viewer disconnects → removed from room (viewer count decreases)
  // -------------------------------------------------------------------------
  it('viewer disconnect removes them from the room', async () => {
    const presenterWs = mockWs();
    const viewerWs = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(presenterWs);
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start' }), false);

    await vi.waitFor(() => findSent(presenterWs, (m) => m.type === 'session.status') !== undefined, { timeout: 1000 });

    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    const roomId = roomCreated!.roomId as string;

    gw.handleConnection(viewerWs);
    gw.handleMessage(viewerWs, JSON.stringify({ type: 'room.join', roomId }), false);

    // Verify viewer count after join
    const rooms = (gateway as unknown as { rooms: import('../src/ws/room-manager.js').RoomManager }).rooms;
    expect(rooms.getViewerCount(roomId)).toBe(1);

    // Viewer disconnects
    gw.handleClose(viewerWs, 1000, Buffer.from(''));

    // Viewer count should be 0
    expect(rooms.getViewerCount(roomId)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 6: Presenter disconnects → room destroyed, viewers get close(1000)
  // -------------------------------------------------------------------------
  it('presenter disconnect destroys room and closes all viewers', async () => {
    const presenterWs = mockWs();
    const viewer1 = mockWs();
    const viewer2 = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(presenterWs);
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start' }), false);

    await vi.waitFor(() => findSent(presenterWs, (m) => m.type === 'session.status') !== undefined, { timeout: 1000 });

    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    const roomId = roomCreated!.roomId as string;

    gw.handleConnection(viewer1);
    gw.handleMessage(viewer1, JSON.stringify({ type: 'room.join', roomId }), false);

    gw.handleConnection(viewer2);
    gw.handleMessage(viewer2, JSON.stringify({ type: 'room.join', roomId }), false);

    // Presenter disconnects
    gw.handleClose(presenterWs, 1000, Buffer.from(''));

    // Both viewers should have been closed with code 1000
    expect(viewer1.close).toHaveBeenCalledWith(1000);
    expect(viewer2.close).toHaveBeenCalledWith(1000);
  });

  // -------------------------------------------------------------------------
  // Test 7: room.join with nonexistent roomId → room.error ROOM_NOT_FOUND
  // -------------------------------------------------------------------------
  it('joining a nonexistent room returns room.error with ROOM_NOT_FOUND', () => {
    const viewerWs = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(viewerWs);
    gw.handleMessage(viewerWs, JSON.stringify({ type: 'room.join', roomId: 'ZZZZZZ' }), false);

    const errorMsg = findSent(viewerWs, (m) => m.type === 'room.error');
    expect(errorMsg).toBeDefined();
    expect(errorMsg!.code).toBe('ROOM_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // Test 8: room.create without active session → receives error
  // -------------------------------------------------------------------------
  it('room.create without active session returns NO_SESSION error', () => {
    const ws = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(ws);
    gw.handleMessage(ws, JSON.stringify({ type: 'room.create' }), false);

    const errorMsg = findSent(ws, (m) => m.type === 'error' && m.code === 'NO_SESSION');
    expect(errorMsg).toBeDefined();
    expect(errorMsg!.code).toBe('NO_SESSION');
  });

  // -------------------------------------------------------------------------
  // Test 9 (bonus): room.join when room is full (200 viewers) → ROOM_FULL
  // -------------------------------------------------------------------------
  it('joining a full room (200 viewers) returns room.error with ROOM_NOT_FOUND (capacity exceeded)', async () => {
    const presenterWs = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(presenterWs);
    gw.handleMessage(presenterWs, JSON.stringify({ type: 'session.start' }), false);

    await vi.waitFor(() => findSent(presenterWs, (m) => m.type === 'session.status') !== undefined, { timeout: 1000 });

    gw.handleMessage(presenterWs, JSON.stringify({ type: 'room.create' }), false);

    const roomCreated = findSent(presenterWs, (m) => m.type === 'room.created');
    const roomId = roomCreated!.roomId as string;

    // Fill room to capacity (200 viewers)
    for (let i = 0; i < 200; i++) {
      const v = mockWs();
      gw.handleConnection(v);
      gw.handleMessage(v, JSON.stringify({ type: 'room.join', roomId }), false);
    }

    // 201st viewer should be rejected
    const lateViewer = mockWs();
    gw.handleConnection(lateViewer);
    gw.handleMessage(lateViewer, JSON.stringify({ type: 'room.join', roomId }), false);

    const errorMsg = findSent(lateViewer, (m) => m.type === 'room.error');
    expect(errorMsg).toBeDefined();
    // RoomManager returns false when full, gateway sends ROOM_NOT_FOUND (same path as not found)
    expect(errorMsg!.code).toBe('ROOM_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // Test 10: Invalid JSON message → INVALID_MESSAGE error
  // -------------------------------------------------------------------------
  it('sending invalid JSON returns INVALID_MESSAGE error', () => {
    const ws = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(ws);
    gw.handleMessage(ws, 'not-valid-json{{{', false);

    const errorMsg = lastSent(ws);
    expect(errorMsg.type).toBe('error');
    expect(errorMsg.code).toBe('INVALID_MESSAGE');
  });

  // -------------------------------------------------------------------------
  // Test 11: room.join without roomId → ROOM_ERROR
  // -------------------------------------------------------------------------
  it('room.join without roomId returns ROOM_ERROR', () => {
    const ws = mockWs();
    const gw = asPrivate(gateway);

    gw.handleConnection(ws);
    gw.handleMessage(ws, JSON.stringify({ type: 'room.join' }), false);

    const errorMsg = findSent(ws, (m) => m.type === 'error' && m.code === 'ROOM_ERROR');
    expect(errorMsg).toBeDefined();
    expect(errorMsg!.code).toBe('ROOM_ERROR');
  });
});
