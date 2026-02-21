import { useEffect, useRef } from 'react';
import { useTranslatorStore } from '../../store/useTranslatorStore';

export function SourcePanel() {
  const sentences = useTranslatorStore((s) => s.sentences);
  const currentInterimSource = useTranslatorStore((s) => s.currentInterimSource);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sentences.length, currentInterimSource]);

  const isEmpty = sentences.length === 0 && !currentInterimSource;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50">
      {isEmpty && (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-300 text-sm text-center select-none">
            Korean speech will appear here
          </p>
        </div>
      )}
      {sentences.map((sentence, i) => (
        <div key={i} className="py-3 border-b border-slate-100 last:border-0">
          <p className="text-slate-800 font-medium leading-relaxed">{sentence.sourceText}</p>
        </div>
      ))}
      {currentInterimSource && (
        <div className="py-3">
          <p className="text-slate-400 italic leading-relaxed">{currentInterimSource}</p>
        </div>
      )}
    </div>
  );
}
