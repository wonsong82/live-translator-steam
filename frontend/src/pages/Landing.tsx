import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsOverlay } from '../components/SettingsOverlay';

function getPresentation(): boolean {
  return localStorage.getItem('presentationMode') === 'true';
}

export default function Landing() {
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState(getPresentation);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [viewerCode, setViewerCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const togglePresentation = () => {
    const next = !presentation;
    setPresentation(next);
    localStorage.setItem('presentationMode', String(next));
    setError(null);
  };

  const handleStart = async () => {
    if (!presentation) {
      navigate('/translate');
      return;
    }

    if (!sessionCode) {
      navigate('/present');
      return;
    }

    try {
      const res = await fetch(`http://${window.location.hostname}:8080/api/room/check?code=${sessionCode}`);
      const data = await res.json();
      
      if (data.available) {
        localStorage.setItem('pendingSessionCode', sessionCode);
        navigate('/present');
      } else {
        setError('Session code is already in use');
      }
    } catch {
      setError('Failed to check session code');
    }
  };

  const handleJoin = () => {
    if (viewerCode) {
      navigate(`/view/${viewerCode}`);
    }
  };

  return (
    <div className={`min-h-dvh flex flex-col relative transition-colors duration-300 ${presentation ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
      <header className="px-8 py-6 flex items-center justify-between">
        <span className="text-red-700 font-bold text-lg tracking-tight">Translate</span>
        <button
          onClick={() => setShowSettings(true)}
          className={`text-sm font-medium transition-colors ${presentation ? 'text-[#555] hover:text-[#999]' : 'text-slate-400 hover:text-slate-700'}`}
        >
          Settings
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className={`mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors duration-300 ${presentation ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-600 text-xs font-semibold tracking-widest uppercase">
            Real-time
          </span>
        </div>

        <h1 className={`text-6xl font-extrabold tracking-tight mb-5 leading-none transition-colors duration-300 ${presentation ? 'text-white' : 'text-slate-900'}`}>
          Korean{' '}
          <span className="text-red-600">↔</span>
          {' '}English
        </h1>

        <p className={`text-xl font-light max-w-sm mb-12 leading-relaxed transition-colors duration-300 ${presentation ? 'text-[#999]' : 'text-slate-400'}`}>
          Speak naturally. Translations appear instantly, sentence by sentence.
        </p>

        <button
          onClick={togglePresentation}
          className={`mb-8 flex items-center gap-3 text-sm transition-colors duration-300 ${presentation ? 'text-[#999] hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
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

        <div className="w-full max-w-xs flex flex-col gap-4">
          {presentation && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="CUSTOM CODE (OPTIONAL)"
                value={sessionCode}
                onChange={(e) => {
                  setSessionCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                  setError(null);
                }}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors text-center font-mono text-sm tracking-widest placeholder:text-opacity-50 ${
                  presentation 
                    ? 'bg-[#1a1a1a] border-[#333] text-white focus:border-red-600 placeholder:text-[#eee]' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-red-600 placeholder:text-slate-400'
                }`}
              />
              {error && <span className="text-red-500 text-xs font-medium">{error}</span>}
            </div>
          )}

          <button
            onClick={handleStart}
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl text-base transition-all hover:scale-105 hover:shadow-xl hover:shadow-red-200 active:scale-100 w-full"
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            {presentation ? 'Start Presenting' : 'Start Translating'}
          </button>

          {presentation && (
            <>
              <div className="flex items-center gap-4 my-4">
                <div className={`h-px flex-1 ${presentation ? 'bg-[#222]' : 'bg-slate-200'}`} />
                <span className={`text-xs font-semibold uppercase tracking-widest ${presentation ? 'text-[#d0d0d0]' : 'text-slate-400'}`}>
                   Or Join
                 </span>
                <div className={`h-px flex-1 ${presentation ? 'bg-[#222]' : 'bg-slate-200'}`} />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={viewerCode}
                  onChange={(e) => setViewerCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  className={`flex-1 px-4 py-3 rounded-xl border outline-none transition-colors text-center font-mono text-sm tracking-widest placeholder:text-opacity-50 ${
                    presentation 
                    ? 'bg-[#1a1a1a] border-[#333] text-white focus:border-red-600 placeholder:text-[#eee]' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-red-600 placeholder:text-slate-400'
                  }`}
                />
                <button
                  onClick={handleJoin}
                  disabled={!viewerCode}
                  className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                    viewerCode 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : presentation ? 'bg-[#222] text-[#555] cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Join
                </button>
              </div>
            </>
          )}
        </div>

        <p className={`mt-10 text-sm font-medium tracking-wide transition-colors duration-300 ${presentation ? 'text-[#555]' : 'text-slate-300'}`}>
          한국어 → English · English → 한국어
        </p>
      </main>

      <div className={`h-1 bg-gradient-to-r transition-colors duration-300 ${presentation ? 'from-red-900 via-red-700 to-red-900' : 'from-red-600 via-red-400 to-red-600'}`} />

      {showSettings && (
        <SettingsOverlay open={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
