import { useCallback, useEffect, useRef } from 'react';
import { useTranslatorStore } from '../store/useTranslatorStore';

export interface TranslatorHook {
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

interface MockSDK {
  destroy: () => void;
}

const SAMPLE_PAIRS: ReadonlyArray<{
  readonly korean: string;
  readonly english: string;
}> = [
  { korean: '안녕하세요, 만나서 반갑습니다', english: 'Hello, nice to meet you' },
  { korean: '오늘 회의 잘 부탁드립니다', english: "I look forward to today's meeting" },
  { korean: '이 서비스는 실시간으로 번역됩니다', english: 'This service translates in real time' },
  { korean: '네, 알겠습니다. 감사합니다', english: 'Yes, I understand. Thank you' },
  {
    korean: '잠깐만요, 다시 말씀해 주시겠어요',
    english: 'Just a moment, could you say that again?',
  },
];

function createMockSDK(
  onInterim: (text: string) => void,
  onFinal: (korean: string, english: string, timestamp: number) => void,
): MockSDK {
  let destroyed = false;
  let sampleIdx = 0;

  const scheduleNext = (): void => {
    if (destroyed) return;
    const pair = SAMPLE_PAIRS[sampleIdx % SAMPLE_PAIRS.length];
    if (!pair) return;

    let charIdx = 0;
    const charTimer = setInterval(() => {
      if (destroyed) {
        clearInterval(charTimer);
        return;
      }
      charIdx++;
      onInterim(pair.korean.slice(0, charIdx));
      if (charIdx >= pair.korean.length) {
        clearInterval(charTimer);
        setTimeout(() => {
          if (!destroyed) {
            onFinal(pair.korean, pair.english, Date.now());
            sampleIdx++;
            setTimeout(scheduleNext, 1200);
          }
        }, 400);
      }
    }, 100);
  };

  setTimeout(scheduleNext, 300);

  return { destroy: () => { destroyed = true; } };
}

export function useTranslator(): TranslatorHook {
  const sdkRef = useRef<MockSDK | null>(null);

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

  const start = useCallback((): void => {
    if (sdkRef.current) return;
    const store = useTranslatorStore.getState();
    store.setConnectionStatus('connecting');

    setTimeout(() => {
      const s = useTranslatorStore.getState();
      s.setConnectionStatus('connected');
      s.setRecording(true);

      sdkRef.current = createMockSDK(
        (text) => useTranslatorStore.getState().setInterimSource(text),
        (korean, english, timestamp) => {
          const st = useTranslatorStore.getState();
          const index = st.sentences.length;
          st.addSentence(korean, timestamp);
          setTimeout(() => {
            useTranslatorStore.getState().setTranslation(index, english);
          }, 300);
        },
      );
    }, 700);
  }, []);

  const stop = useCallback((): void => {
    sdkRef.current?.destroy();
    sdkRef.current = null;
    const store = useTranslatorStore.getState();
    store.setRecording(false);
    store.setInterimSource('');
    store.setInterimTranslation('');
  }, []);

  const destroy = useCallback((): void => {
    sdkRef.current?.destroy();
    sdkRef.current = null;
    useTranslatorStore.getState().reset();
  }, []);

  return { start, stop, destroy };
}
