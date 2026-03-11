import type {
  TranslateSDKConfig,
  TranslateSDKInstance,
  ConnectionStatus,
  TranscriptState,
  TranslationMode,
  ViewerConfig,
  ViewerInstance,
} from './types.js';
import { AudioCapture } from './audio/capture.js';
import { WSClient, type WSMessageCallback } from './transport/ws-client.js';
import { ViewerClient, type ViewerMessageCallback } from './transport/viewer-client.js';
import { SessionState } from './state/session-state.js';
import { EventEmitter } from './events/emitter.js';
import type { ServerMessage } from './transport/protocol.js';

type SDKEvents = {
  [key: string]: unknown;
  transcriptionInterim: { text: string; language: string; timestamp: number; confidence: number };
  transcriptionFinal: { text: string; language: string; timestamp: number; confidence: number; sentenceIndex: number };
  translationInterim: { sourceText: string; translatedText: string; sentenceIndex: null };
  translationFinal: { sourceText: string; translatedText: string; sentenceIndex: number };
  statusChange: ConnectionStatus;
  error: { code: string; message: string };
};

function createInstance(config: TranslateSDKConfig): TranslateSDKInstance {
  const state = new SessionState(config.sourceLanguage, config.targetLanguage, config.mode);
  const emitter = new EventEmitter<SDKEvents>();
  const audio = new AudioCapture();
  const wsClient = new WSClient(config.serverUrl);

  if (config.onTranscriptionInterim) emitter.on('transcriptionInterim', config.onTranscriptionInterim);
  if (config.onTranscriptionFinal) emitter.on('transcriptionFinal', config.onTranscriptionFinal);
  if (config.onTranslationInterim) emitter.on('translationInterim', config.onTranslationInterim);
  if (config.onTranslationFinal) emitter.on('translationFinal', config.onTranslationFinal);
  if (config.onStatusChange) emitter.on('statusChange', config.onStatusChange);
  if (config.onError) emitter.on('error', config.onError);

  let pendingRoomResolve: ((value: { roomId: string }) => void) | null = null;
  let pendingRoomReject: ((reason: Error) => void) | null = null;

  const handleMessage: WSMessageCallback = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'transcription.interim':
        state.setInterim(msg.text);
        emitter.emit('transcriptionInterim', {
          text: msg.text, language: msg.language, timestamp: msg.timestamp, confidence: msg.confidence,
        });
        break;

      case 'transcription.final':
        state.addFinal(msg.text);
        emitter.emit('transcriptionFinal', {
          text: msg.text, language: msg.language, timestamp: msg.timestamp,
          confidence: msg.confidence, sentenceIndex: msg.sentenceIndex,
        });
        break;

      case 'translation.interim':
        state.setInterimTranslation(msg.translatedText);
        emitter.emit('translationInterim', {
          sourceText: msg.sourceText, translatedText: msg.translatedText, sentenceIndex: null,
        });
        break;

      case 'translation.final':
        state.setTranslation(msg.sentenceIndex, msg.translatedText);
        emitter.emit('translationFinal', {
          sourceText: msg.sourceText, translatedText: msg.translatedText, sentenceIndex: msg.sentenceIndex,
        });
        break;

      case 'session.status': {
        const statusMap: Record<string, ConnectionStatus> = {
          connected: 'connected', reconnecting: 'connecting', error: 'error',
        };
        const mapped = statusMap[msg.status] ?? 'error';
        state.status = mapped;
        emitter.emit('statusChange', mapped);
        break;
      }

      case 'room.created':
        if (pendingRoomResolve) {
          pendingRoomResolve({ roomId: msg.roomId });
          pendingRoomResolve = null;
          pendingRoomReject = null;
        }
        if (config.onRoomCreated) config.onRoomCreated({ roomId: msg.roomId });
        break;

      case 'room.error':
        if (pendingRoomReject) {
          pendingRoomReject(new Error(msg.message));
          pendingRoomResolve = null;
          pendingRoomReject = null;
        }
        if (config.onRoomError) config.onRoomError({ code: msg.code, message: msg.message });
        break;

      case 'room.viewerCount':
        if (config.onViewerCountChange) config.onViewerCountChange({ count: msg.count });
        break;

      case 'error':
        emitter.emit('error', { code: msg.code, message: msg.message });
        break;
    }
  };

  const instance: TranslateSDKInstance = {
    async start(): Promise<void> {
      wsClient.connect(
        { sourceLanguage: state.sourceLanguage, targetLanguage: state.targetLanguage, mode: state.mode, apiKey: config.apiKey },
        handleMessage,
        (wsState) => {
          const statusMap: Record<string, ConnectionStatus> = {
            connecting: 'connecting', connected: 'connected', disconnected: 'disconnected', error: 'error',
          };
          state.status = statusMap[wsState] ?? 'disconnected';
          emitter.emit('statusChange', state.status);
        },
      );

      await audio.start((pcm16Frame) => {
        wsClient.sendAudio(pcm16Frame);
      });

      state.recording = true;
    },

    stop(): void {
      audio.stop();
      state.recording = false;
    },

    async resume(): Promise<void> {
      await audio.start((pcm16Frame) => {
        wsClient.sendAudio(pcm16Frame);
      });
      state.recording = true;
    },

    destroy(): void {
      audio.stop();
      wsClient.disconnect();
      emitter.removeAllListeners();
      state.reset();
    },

    setSourceLanguage(lang: string): void {
      state.sourceLanguage = lang;
      wsClient.sendSessionUpdate({ sourceLanguage: lang });
    },

    setTargetLanguage(lang: string): void {
      state.targetLanguage = lang;
      wsClient.sendSessionUpdate({ targetLanguage: lang });
    },

    setMode(mode: TranslationMode): void {
      state.mode = mode;
      wsClient.sendSessionUpdate({ mode });
    },

    getStatus(): ConnectionStatus {
      return state.status;
    },

    isRecording(): boolean {
      return state.recording;
    },

    getTranscript(): TranscriptState {
      return state.getTranscript();
    },

    getTranslations(): Record<number, string> {
      return state.getTranslations();
    },

    async createRoom(): Promise<{ roomId: string }> {
      return new Promise((resolve, reject) => {
        pendingRoomResolve = resolve;
        pendingRoomReject = reject;
        wsClient.sendRoomCreate();
      });
    },

    destroyRoom(): void {
      wsClient.disconnect();
    },
  };

  return instance;
}

function createViewerInstance(config: ViewerConfig): ViewerInstance {
  const emitter = new EventEmitter<SDKEvents>();
  const viewerClient = new ViewerClient(config.serverUrl);

  if (config.onTranscriptionInterim) emitter.on('transcriptionInterim', config.onTranscriptionInterim);
  if (config.onTranscriptionFinal) emitter.on('transcriptionFinal', config.onTranscriptionFinal);
  if (config.onTranslationInterim) emitter.on('translationInterim', config.onTranslationInterim);
  if (config.onTranslationFinal) emitter.on('translationFinal', config.onTranslationFinal);
  if (config.onStatusChange) emitter.on('statusChange', config.onStatusChange);
  if (config.onError) emitter.on('error', config.onError);

  let currentStatus: ConnectionStatus = 'disconnected';

  const handleMessage: ViewerMessageCallback = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'transcription.interim':
        emitter.emit('transcriptionInterim', {
          text: msg.text, language: msg.language, timestamp: msg.timestamp, confidence: msg.confidence,
        });
        break;

      case 'transcription.final':
        emitter.emit('transcriptionFinal', {
          text: msg.text, language: msg.language, timestamp: msg.timestamp,
          confidence: msg.confidence, sentenceIndex: msg.sentenceIndex,
        });
        break;

      case 'translation.interim':
        emitter.emit('translationInterim', {
          sourceText: msg.sourceText, translatedText: msg.translatedText, sentenceIndex: null,
        });
        break;

      case 'translation.final':
        emitter.emit('translationFinal', {
          sourceText: msg.sourceText, translatedText: msg.translatedText, sentenceIndex: msg.sentenceIndex,
        });
        break;

      case 'room.error':
        if (config.onRoomError) config.onRoomError({ code: msg.code, message: msg.message });
        break;
    }
  };

  const instance: ViewerInstance = {
    connect(): void {
      viewerClient.connect(
        { roomId: config.roomId, apiKey: config.apiKey },
        handleMessage,
        (wsState) => {
          const statusMap: Record<string, ConnectionStatus> = {
            connecting: 'connecting', connected: 'connected', disconnected: 'disconnected', error: 'error',
          };
          currentStatus = statusMap[wsState] ?? 'disconnected';
          emitter.emit('statusChange', currentStatus);
        },
      );
    },

    disconnect(): void {
      viewerClient.disconnect();
    },

    destroy(): void {
      viewerClient.disconnect();
      emitter.removeAllListeners();
    },

    getStatus(): ConnectionStatus {
      return currentStatus;
    },
  };

  return instance;
}

export const TranslateSDK = { init: createInstance, view: createViewerInstance };
export type { TranslateSDKConfig, TranslateSDKInstance, ConnectionStatus, TranslationMode, TranscriptState, ViewerConfig, ViewerInstance };
