import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViewerClient } from '../src/transport/viewer-client.js';
import type { ServerMessage } from '../src/transport/protocol.js';

const createMockWsInstance = () => ({
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  onopen: null as ((event: Event) => void) | null,
  onmessage: null as ((event: MessageEvent) => void) | null,
  onclose: null as ((event: CloseEvent) => void) | null,
  onerror: null as ((event: Event) => void) | null,
});

type MockWsInstance = ReturnType<typeof createMockWsInstance>;

let mockWsInstance: MockWsInstance;
let MockWebSocket: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockWsInstance = createMockWsInstance();
  MockWebSocket = vi.fn(() => mockWsInstance);
  (MockWebSocket as unknown as { OPEN: number }).OPEN = 1;
  vi.stubGlobal('WebSocket', MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllTimers();
});

describe('ViewerClient', () => {
  describe('connection and room.join', () => {
    it('sends room.join with roomId on connection open', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM123', apiKey: 'test-key' }, onMessage, onStateChange);

      mockWsInstance.onopen?.(new Event('open'));

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'room.join', roomId: 'ROOM123' }),
      );
    });

    it('does NOT send session.start at any point', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM456', apiKey: 'test-key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      const allSentMessages = mockWsInstance.send.mock.calls.map((call) => {
        try {
          return JSON.parse(call[0] as string);
        } catch {
          return null;
        }
      });

      const hasSessionStart = allSentMessages.some((msg) => msg?.type === 'session.start');
      expect(hasSessionStart).toBe(false);
    });

    it('calls onStateChange with "connecting" when connect() is called', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM789', apiKey: 'test-key' }, onMessage, onStateChange);

      expect(onStateChange).toHaveBeenCalledWith('connecting');
    });

    it('calls onStateChange with "connected" when room.joined is received', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM789', apiKey: 'test-key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      mockWsInstance.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'room.joined', roomId: 'ROOM789' }),
        }),
      );

      expect(onStateChange).toHaveBeenCalledWith('connected');
    });
  });

  describe('message parsing', () => {
    it('parses transcription.interim and calls onMessage callback', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn<[ServerMessage], void>();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM1', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      const interimPayload = {
        type: 'transcription.interim',
        text: '안녕',
        language: 'ko',
        timestamp: 1000,
        confidence: 0.85,
      };

      mockWsInstance.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(interimPayload) }),
      );

      expect(onMessage).toHaveBeenCalledOnce();
      const received = onMessage.mock.calls[0][0];
      expect(received.type).toBe('transcription.interim');
      if (received.type === 'transcription.interim') {
        expect(received.text).toBe('안녕');
        expect(received.confidence).toBe(0.85);
      }
    });

    it('parses transcription.final and calls callback with sentenceIndex', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn<[ServerMessage], void>();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM2', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      const finalPayload = {
        type: 'transcription.final',
        text: '안녕하세요',
        language: 'ko',
        timestamp: 2000,
        confidence: 0.95,
        sentenceIndex: 3,
      };

      mockWsInstance.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(finalPayload) }),
      );

      expect(onMessage).toHaveBeenCalledOnce();
      const received = onMessage.mock.calls[0][0];
      expect(received.type).toBe('transcription.final');
      if (received.type === 'transcription.final') {
        expect(received.sentenceIndex).toBe(3);
        expect(received.text).toBe('안녕하세요');
      }
    });

    it('parses translation.final and calls callback', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn<[ServerMessage], void>();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM3', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      const translationPayload = {
        type: 'translation.final',
        sourceText: '안녕하세요',
        translatedText: 'Hello',
        sentenceIndex: 0,
      };

      mockWsInstance.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(translationPayload) }),
      );

      expect(onMessage).toHaveBeenCalledOnce();
      const received = onMessage.mock.calls[0][0];
      expect(received.type).toBe('translation.final');
      if (received.type === 'translation.final') {
        expect(received.translatedText).toBe('Hello');
        expect(received.sentenceIndex).toBe(0);
      }
    });

    it('handles room.error message and calls onMessage callback', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn<[ServerMessage], void>();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM4', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      const errorPayload = {
        type: 'room.error',
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      };

      mockWsInstance.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(errorPayload) }),
      );

      expect(onMessage).toHaveBeenCalledOnce();
      const received = onMessage.mock.calls[0][0];
      expect(received.type).toBe('room.error');
      if (received.type === 'room.error') {
        expect(received.code).toBe('ROOM_NOT_FOUND');
        expect(received.message).toBe('Room not found');
      }
    });

    it('ignores invalid JSON messages without throwing', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM5', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      expect(() => {
        mockWsInstance.onmessage?.(
          new MessageEvent('message', { data: 'not valid json' }),
        );
      }).not.toThrow();

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('sends room.leave and closes WebSocket on disconnect()', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM6', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      mockWsInstance.send.mockClear();

      client.disconnect();

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'room.leave' }),
      );
      expect(mockWsInstance.close).toHaveBeenCalledWith(1000);
    });

    it('calls onStateChange with "disconnected" after disconnect()', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM7', apiKey: 'key' }, onMessage, onStateChange);
      mockWsInstance.onopen?.(new Event('open'));

      onStateChange.mockClear();
      client.disconnect();

      expect(onStateChange).toHaveBeenCalledWith('disconnected');
    });
  });

  describe('error handling', () => {
    it('calls onStateChange with "error" on WebSocket error', () => {
      const client = new ViewerClient('ws://localhost:8080/viewer');
      const onMessage = vi.fn();
      const onStateChange = vi.fn();

      client.connect({ roomId: 'ROOM8', apiKey: 'key' }, onMessage, onStateChange);

      mockWsInstance.onerror?.(new Event('error'));

      expect(onStateChange).toHaveBeenCalledWith('error');
    });
  });
});
