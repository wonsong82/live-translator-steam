import { useState } from 'react';
import { Link } from 'react-router-dom';

function getPresentation(): boolean {
  return localStorage.getItem('presentationMode') === 'true';
}

export default function Landing() {
  const [presentation, setPresentation] = useState(getPresentation);

  const togglePresentation = () => {
    const next = !presentation;
    setPresentation(next);
    localStorage.setItem('presentationMode', String(next));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <span className="text-red-700 font-bold text-lg tracking-tight">Translate</span>
        <Link
          to="/settings"
          className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors"
        >
          Settings
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-600 text-xs font-semibold tracking-widest uppercase">
            Real-time
          </span>
        </div>

        <h1 className="text-6xl font-extrabold text-slate-900 tracking-tight mb-5 leading-none">
          Korean{' '}
          <span className="text-red-600">↔</span>
          {' '}English
        </h1>

        <p className="text-xl text-slate-400 font-light max-w-sm mb-12 leading-relaxed">
          Speak naturally. Translations appear instantly, sentence by sentence.
        </p>

        <button
          onClick={togglePresentation}
          className="mb-8 flex items-center gap-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <div
            className={`relative w-9 h-5 rounded-full transition-colors ${
              presentation ? 'bg-red-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                presentation ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
          <span className="font-medium">Presentation Mode</span>
        </button>

        <Link
          to={presentation ? '/present' : '/translate'}
          className="group inline-flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl text-base transition-all hover:scale-105 hover:shadow-xl hover:shadow-red-200 active:scale-100"
        >
          <svg
            className="w-5 h-5 transition-transform group-hover:scale-110"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          Start Translating
        </Link>

        <p className="mt-10 text-slate-300 text-sm font-medium tracking-wide">
          한국어 → English · English → 한국어
        </p>
      </main>

      <div className="h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600" />
    </div>
  );
}
