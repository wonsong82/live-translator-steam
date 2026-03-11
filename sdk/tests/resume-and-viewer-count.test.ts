import { describe, it, expect, vi } from 'vitest';
import { TranslateSDK } from '../src/index.js';
import { parseServerMessage } from '../src/transport/protocol.js';
import type { TranslateSDKConfig } from '../src/types.js';

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
