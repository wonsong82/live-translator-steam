import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { TranslateSDK, type ViewerInstance } from 'translate-sdk';
import { useTranslatorStore } from '../store/useTranslatorStore';
import { useRoomStore } from '../store/useRoomStore';
import type { ConnectionStatus } from '../types';

export interface ViewerHook {
  connectionStatus: ConnectionStatus;
}

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8080/ws';

export function useViewer(): ViewerHook {
  const { roomId } = useParams<{ roomId: string }>();
  const viewerRef = useRef<ViewerInstance | null>(null);
  const connectionStatus = useTranslatorStore((state) => state.connectionStatus);

  useEffect(() => {
    if (!roomId) return;

    useRoomStore.getState().setRoom(roomId, 'viewer');
    useTranslatorStore.getState().setConnectionStatus('connecting');

    const sentenceOffset = useTranslatorStore.getState().sentences.length;

    const viewer = TranslateSDK.view({
      serverUrl: WS_URL,
      roomId,
      apiKey: '',
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
        useTranslatorStore.getState().setConnectionStatus(status);
      },
      onError: (err) => {
        useTranslatorStore.getState().setError(err.message);
      },
    });

    viewerRef.current = viewer;
    viewer.connect();

    return () => {
      viewerRef.current?.disconnect();
      viewerRef.current = null;
    };
  }, [roomId]);

  return { connectionStatus };
}
