import { useEffect, useState } from 'react';
import { useTranslatorStore } from '../store/useTranslatorStore';

export function useAudioLevel(): number {
  const isRecording = useTranslatorStore((s) => s.isRecording);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setLevel(0);
      return;
    }
    const id = setInterval(() => {
      setLevel(Math.abs(Math.sin(Date.now() / 500)) * 0.7 + 0.15);
    }, 50);
    return () => clearInterval(id);
  }, [isRecording]);

  return level;
}
