import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TranscriptionToggle } from '../components/Controls/TranscriptionToggle';
import type { TranslationMode } from '../types';

function getInitialMode(): TranslationMode {
  const saved = localStorage.getItem('translationMode');
  if (saved === 'hybrid' || saved === 'final-only') return saved;
  return 'hybrid';
}

export default function Settings() {
  const [mode, setMode] = useState<TranslationMode>(getInitialMode);

  const handleModeChange = (newMode: TranslationMode): void => {
    setMode(newMode);
    localStorage.setItem('translationMode', newMode);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-3">
        <Link to="/" aria-label="Back" className="text-slate-400 hover:text-slate-600 transition-colors p-1 -ml-1 rounded-lg hover:bg-slate-100">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-semibold text-slate-800">Settings</h1>
      </header>

      <main className="max-w-lg mx-auto px-5 py-8 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 text-sm">Translation Mode</h2>
          </div>
          <button onClick={() => handleModeChange('hybrid')} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="text-left">
              <div className="text-sm font-medium text-slate-800">Hybrid</div>
              <div className="text-xs text-slate-400 mt-0.5">Interim NMT + final LLM translation</div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${mode === 'hybrid' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
              {mode === 'hybrid' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </button>
          <button onClick={() => handleModeChange('final-only')} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
            <div className="text-left">
              <div className="text-sm font-medium text-slate-800">Final Only</div>
              <div className="text-xs text-slate-400 mt-0.5">LLM translation on complete sentences only</div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${mode === 'final-only' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
              {mode === 'final-only' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 text-sm">Display</h2>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-800">Show Transcription</div>
              <div className="text-xs text-slate-400 mt-0.5">Display the Korean source text panel</div>
            </div>
            <TranscriptionToggle />
          </div>
        </div>
      </main>
    </div>
  );
}
