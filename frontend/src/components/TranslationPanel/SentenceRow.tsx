import type { Sentence } from '../../types';

interface SentenceRowProps {
  sentence: Sentence;
}

export function SentenceRow({ sentence }: SentenceRowProps) {
  return (
    <div className="flex gap-6 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 text-slate-800 font-medium leading-relaxed">
        {sentence.sourceText}
      </div>
      <div className="flex-1 leading-relaxed">
        {sentence.translation !== null ? (
          <span className="text-slate-700">{sentence.translation}</span>
        ) : (
          <span className="text-slate-400 italic">Translating…</span>
        )}
      </div>
    </div>
  );
}
