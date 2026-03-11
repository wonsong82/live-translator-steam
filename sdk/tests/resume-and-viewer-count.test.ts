import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranslateSDK } from '../src/index.js';
import { parseServerMessage } from '../src/transport/protocol.js';
import type { TranslateSDKConfig } from '../src/types.js';

vi.mock('../src/audio/capture.js', () => ({
  AudioCapture: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    active: false,
  })),
}));

describe('SDK resume() and room.viewerCount', () => {
  describe('resume() method', () => {
    it('exists on SDK instance', () => {
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
      };

      const instance = TranslateSDK.init(config);
      expect(instance.resume).toBeDefined();
      expect(typeof instance.resume).toBe('function');
    });

    it('is an async function', async () => {
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
      };

      const instance = TranslateSDK.init(config);
      const result = instance.resume();
      expect(result).toBeInstanceOf(Promise);
      try {
        await result;
      } catch {
      }
    });
  });

  describe('room.viewerCount message handler', () => {
    it('accepts onViewerCountChange callback in config', () => {
      const onViewerCountChange = vi.fn();
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
        onViewerCountChange,
      };

      const instance = TranslateSDK.init(config);
      expect(instance).toBeDefined();
    });

    it('config accepts onViewerCountChange as optional callback', () => {
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
      };

      const instance = TranslateSDK.init(config);
      expect(instance).toBeDefined();
    });

    describe('onViewerCountChange callback behavior', () => {
      const createMockWsInstance = () => ({
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1,
        onopen: null as ((event: Event) => void) | null,
        onmessage: null as ((event: MessageEvent) => void) | null,
        onclose: null as ((event: CloseEvent) => void) | null,
        onerror: null as ((event: Event) => void) | null,
      });

      let mockWsInstance: ReturnType<typeof createMockWsInstance>;
      let MockWebSocket: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        mockWsInstance = createMockWsInstance();
        MockWebSocket = vi.fn(() => mockWsInstance);
        (MockWebSocket as unknown as { OPEN: number }).OPEN = 1;
        vi.stubGlobal('WebSocket', MockWebSocket);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        vi.clearAllTimers();
      });

      it('fires onViewerCountChange callback when room.viewerCount message is received', async () => {
        const onViewerCountChange = vi.fn();
        const config: TranslateSDKConfig = {
          serverUrl: 'ws://localhost:8080/ws',
          apiKey: 'test-key',
          sourceLanguage: 'ko',
          targetLanguage: 'en',
          mode: 'hybrid',
          onViewerCountChange,
        };

        const instance = TranslateSDK.init(config);

        // Call start() to trigger wsClient.connect() which registers the message handler
        const startPromise = instance.start();

        // Simulate WebSocket connection opening
        mockWsInstance.onopen?.(new Event('open'));

        // Wait for start() to complete
        await startPromise;

        // Simulate receiving a room.viewerCount message
        mockWsInstance.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'room.viewerCount', count: 3 }),
          }),
        );

        // Assert the callback was called with the correct count
        expect(onViewerCountChange).toHaveBeenCalledWith({ count: 3 });
      });
    });
  });

  describe('SDK instance state management', () => {
    it('isRecording() returns false initially', () => {
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
      };

      const instance = TranslateSDK.init(config);
      expect(instance.isRecording()).toBe(false);
    });

    it('stop() sets isRecording() to false', () => {
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
      };

      const instance = TranslateSDK.init(config);
      instance.stop();
      expect(instance.isRecording()).toBe(false);
    });

    it('destroy() cleans up resources', () => {
      const config: TranslateSDKConfig = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
      };

      const instance = TranslateSDK.init(config);
      expect(() => instance.destroy()).not.toThrow();
    });
  });

  describe('SDK message types', () => {
    it('parseServerMessage handles room.viewerCount', () => {
      const json = JSON.stringify({ type: 'room.viewerCount', count: 5 });
      const msg = parseServerMessage(json);
      expect(msg?.type).toBe('room.viewerCount');
      if (msg?.type === 'room.viewerCount') {
        expect(msg.count).toBe(5);
      }
    });

    it('parseServerMessage handles room.viewerCount with count 0', () => {
      const json = JSON.stringify({ type: 'room.viewerCount', count: 0 });
      const msg = parseServerMessage(json);
      expect(msg?.type).toBe('room.viewerCount');
      if (msg?.type === 'room.viewerCount') {
        expect(msg.count).toBe(0);
      }
    });

    it('parseServerMessage handles room.viewerCount with large count', () => {
      const json = JSON.stringify({ type: 'room.viewerCount', count: 999 });
      const msg = parseServerMessage(json);
      expect(msg?.type).toBe('room.viewerCount');
      if (msg?.type === 'room.viewerCount') {
        expect(msg.count).toBe(999);
      }
    });
  });
});
