import { useEffect, useRef } from 'react';
import { useTranslatorStore } from '../../store/useTranslatorStore';

export function TargetPanel() {
  const sentences = useTranslatorStore((s) => s.sentences);
  const currentInterimTranslation = useTranslatorStore((s) => s.currentInterimTranslation);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sentences.length, currentInterimTranslation]);

  const isEmpty = sentences.length === 0 && !currentInterimTranslation;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 bg-white">
      {isEmpty && (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-300 text-sm text-center select-none">
            English translation will appear here
          </p>
        </div>
      )}
      {sentences.map((sentence, i) => (
        <div key={i} className="py-3 border-b border-slate-100 last:border-0">
          {sentence.translation !== null ? (
            <p className="text-slate-700 leading-relaxed">{sentence.translation}</p>
          ) : (
            <div className="flex items-center gap-1.5 pt-1">
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          )}
        </div>
      ))}
      {currentInterimTranslation && (
        <div className="py-3">
          <p className="text-slate-400 italic leading-relaxed">{currentInterimTranslation}</p>
        </div>
      )}
    </div>
  );
}
