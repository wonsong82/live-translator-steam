import { useCallback, useEffect, useRef } from 'react';
import { useTranslatorStore } from '../store/useTranslatorStore';
import { useRoomStore } from '../store/useRoomStore';
import { TranslateSDK, type TranslateSDKInstance } from 'translate-sdk';

export interface TranslatorHook {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => Promise<void>;
  destroy: () => void;
  createRoom: () => Promise<string>;
}

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8080/ws';

export function useTranslator(): TranslatorHook {
  const sdkRef = useRef<TranslateSDKInstance | null>(null);

  useEffect(() => {
    return () => {
      sdkRef.current?.destroy();
      sdkRef.current = null;
      const store = useTranslatorStore.getState();
      store.setRecording(false);
      store.setConnectionStatus('disconnected');
      store.setInterimSource('');
      store.setInterimTranslation('');
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (sdkRef.current) return;
    const store = useTranslatorStore.getState();
    const sentenceOffset = store.sentences.length;
    store.setConnectionStatus('connecting');

    const savedMode = localStorage.getItem('translationMode');
    const mode = savedMode === 'final-only' ? 'final-only' : 'hybrid';

    const sdk = TranslateSDK.init({
      serverUrl: WS_URL,
      apiKey: '',
      sourceLanguage: 'ko',
      targetLanguage: 'en',
      mode,
      onTranscriptionInterim: (data) => {
        useTranslatorStore.getState().setInterimSource(data.text);
      },
      onTranscriptionFinal: (data) => {
        useTranslatorStore.getState().addSentence(data.text, data.timestamp);
      },
      onTranslationInterim: (data) => {
        useTranslatorStore.getState().setInterimTranslation(data.translatedText);
      },
      onTranslationFinal: (data) => {
        useTranslatorStore.getState().setTranslation(sentenceOffset + data.sentenceIndex, data.translatedText);
      },
      onStatusChange: (status) => {
        const s = useTranslatorStore.getState();
        s.setConnectionStatus(status);
        if (status === 'connected') s.setRecording(true);
        if (status === 'disconnected' || status === 'error') s.setRecording(false);
      },
       onError: (err) => {
         useTranslatorStore.getState().setError(err.message);
       },
       onViewerCountChange: (data) => {
         useRoomStore.getState().setViewerCount(data.count);
       },
     });

    sdkRef.current = sdk;
    await sdk.start().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      useTranslatorStore.getState().setError(message);
      useTranslatorStore.getState().setConnectionStatus('error');
      sdk.destroy();
      sdkRef.current = null;
      throw err;
    });
  }, []);

  const stop = useCallback((): void => {
    sdkRef.current?.destroy();
    sdkRef.current = null;
    const store = useTranslatorStore.getState();
    store.setRecording(false);
    store.setInterimSource('');
    store.setInterimTranslation('');
  }, []);

  const pause = useCallback((): void => {
    sdkRef.current?.stop();
    const store = useTranslatorStore.getState();
    store.setRecording(false);
    store.setInterimSource('');
    store.setInterimTranslation('');
  }, []);

  const resume = useCallback(async (): Promise<void> => {
    if (!sdkRef.current) return;
    await sdkRef.current.resume();
    useTranslatorStore.getState().setRecording(true);
  }, []);

  const destroy = useCallback((): void => {
    sdkRef.current?.destroy();
    sdkRef.current = null;
    useTranslatorStore.getState().reset();
  }, []);

  const createRoom = useCallback(async (): Promise<string> => {
    if (!sdkRef.current) throw new Error('SDK not started');
    const { roomId } = await sdkRef.current.createRoom();
    return roomId;
  }, []);

  return { start, stop, pause, resume, destroy, createRoom };
}
