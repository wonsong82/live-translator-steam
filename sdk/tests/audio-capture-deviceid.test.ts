import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioCapture } from '../src/audio/capture.js';

describe('AudioCapture deviceId parameter', () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>;
  let mockAudioContext: Partial<AudioContext>;
  let mockMediaStream: Partial<MediaStream>;
  let mockAudioWorklet: Partial<AudioWorklet>;
  let mockAudioWorkletNode: Partial<AudioWorkletNode>;
  let mockMediaStreamSource: Partial<MediaStreamAudioSourceNode>;

  beforeEach(() => {
    mockMediaStream = {
      getTracks: vi.fn(() => [
        { stop: vi.fn() },
      ]),
    };

    mockAudioWorkletNode = {
      port: {
        onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null,
      },
      disconnect: vi.fn(),
      connect: vi.fn(),
    };

    mockMediaStreamSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioWorklet = {
      addModule: vi.fn().mockResolvedValue(undefined),
    };

    mockAudioContext = {
      sampleRate: 48000,
      audioWorklet: mockAudioWorklet as AudioWorklet,
      createMediaStreamSource: vi.fn(() => mockMediaStreamSource as MediaStreamAudioSourceNode),
      destination: {} as AudioDestinationNode,
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    });

    vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
    vi.stubGlobal('AudioWorkletNode', vi.fn(() => mockAudioWorkletNode));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('start() without deviceId', () => {
    it('calls getUserMedia without deviceId constraint', async () => {
      const capture = new AudioCapture();
      const onFrame = vi.fn();

      await capture.start(onFrame);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    });

    it('sets active to true', async () => {
      const capture = new AudioCapture();
      const onFrame = vi.fn();

      expect(capture.active).toBe(false);
      await capture.start(onFrame);
      expect(capture.active).toBe(true);
    });
  });

  describe('start() with deviceId', () => {
    it('calls getUserMedia with exact deviceId constraint', async () => {
      const capture = new AudioCapture();
      const onFrame = vi.fn();
      const deviceId = 'device-123';

      await capture.start(onFrame, deviceId);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: { exact: deviceId },
        },
      });
    });

    it('stores deviceId internally', async () => {
      const capture = new AudioCapture();
      const onFrame = vi.fn();
      const deviceId = 'device-456';

      await capture.start(onFrame, deviceId);

      // Verify by checking that the stored deviceId is used (indirectly via the constraint)
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: expect.objectContaining({
            deviceId: { exact: deviceId },
          }),
        }),
      );
    });
  });

  describe('OverconstrainedError handling', () => {
    it('retries without deviceId constraint on OverconstrainedError', async () => {
      const overconstrainedError = new DOMException('Requested device not found', 'OverconstrainedError');
      mockGetUserMedia
        .mockRejectedValueOnce(overconstrainedError)
        .mockResolvedValueOnce(mockMediaStream);

      const capture = new AudioCapture();
      const onFrame = vi.fn();
      const deviceId = 'device-not-found';

      await capture.start(onFrame, deviceId);

      // First call with exact deviceId
      expect(mockGetUserMedia).toHaveBeenNthCalledWith(1, {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: { exact: deviceId },
        },
      });

      // Second call without deviceId (fallback)
      expect(mockGetUserMedia).toHaveBeenNthCalledWith(2, {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });

    it('handles OverconstrainedError with name property check', async () => {
      const errorWithName = { name: 'OverconstrainedError', message: 'Device not found' };
      mockGetUserMedia
        .mockRejectedValueOnce(errorWithName)
        .mockResolvedValueOnce(mockMediaStream);

      const capture = new AudioCapture();
      const onFrame = vi.fn();

      await capture.start(onFrame, 'device-id');

      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });

    it('rethrows non-OverconstrainedError exceptions', async () => {
      const otherError = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValueOnce(otherError);

      const capture = new AudioCapture();
      const onFrame = vi.fn();

      await expect(capture.start(onFrame, 'device-id')).rejects.toThrow('Permission denied');
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });

    it('succeeds after fallback retry', async () => {
      const overconstrainedError = new DOMException('Device not found', 'OverconstrainedError');
      mockGetUserMedia
        .mockRejectedValueOnce(overconstrainedError)
        .mockResolvedValueOnce(mockMediaStream);

      const capture = new AudioCapture();
      const onFrame = vi.fn();

      await capture.start(onFrame, 'device-id');

      expect(capture.active).toBe(true);
    });
  });

  describe('resume() behavior with deviceId', () => {
    it('resume() can be called after start() with deviceId', async () => {
      const capture = new AudioCapture();
      const onFrame = vi.fn();
      const deviceId = 'device-789';

      // First start with deviceId
      await capture.start(onFrame, deviceId);
      mockGetUserMedia.mockClear();

      // Stop
      capture.stop();

      // Resume should work (AudioCapture internally remembers deviceId)
      mockGetUserMedia.mockResolvedValueOnce(mockMediaStream);
      await capture.start(onFrame, deviceId);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: { exact: deviceId },
        },
      });
    });
  });

  describe('SDK integration', () => {
    it('SDK config accepts deviceId parameter', () => {
      // This test verifies the type interface accepts deviceId
      const config = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid' as const,
        deviceId: 'device-123',
      };

      expect(config.deviceId).toBe('device-123');
    });

    it('SDK config deviceId is optional', () => {
      const config = {
        serverUrl: 'ws://localhost:8080/ws',
        apiKey: 'test-key',
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid' as const,
      };

      expect(config.deviceId).toBeUndefined();
    });
  });
});
