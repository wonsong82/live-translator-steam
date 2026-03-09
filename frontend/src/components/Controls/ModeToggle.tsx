import { useState } from 'react';

function getMode(): 'hybrid' | 'final-only' {
  const saved = localStorage.getItem('translationMode');
  return saved === 'final-only' ? 'final-only' : 'hybrid';
}

export function ModeToggle() {
  const [mode, setMode] = useState(getMode);
  const isHybrid = mode === 'hybrid';

  const toggle = () => {
    const next = isHybrid ? 'final-only' : 'hybrid';
    setMode(next);
    localStorage.setItem('translationMode', next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={isHybrid ? 'Switch to final-only mode' : 'Switch to hybrid mode'}
      className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
    >
      <span className="text-xs font-medium hidden sm:inline">Interim</span>
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${
          isHybrid ? 'bg-red-600' : 'bg-slate-300'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            isHybrid ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}
