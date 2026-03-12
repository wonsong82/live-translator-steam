import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { RecordButton } from '../components/Controls/RecordButton';
import { ModeToggle } from '../components/Controls/ModeToggle';
import { TranscriptionToggle } from '../components/Controls/TranscriptionToggle';
import { StatusBar } from '../components/StatusBar';
import { SettingsOverlay } from '../components/SettingsOverlay';
import { SourcePanel } from '../components/TranslationPanel/SourcePanel';
import { TargetPanel } from '../components/TranslationPanel/TargetPanel';
import { useTranslator } from '../hooks/useTranslator';
import { useTranslatorStore } from '../store/useTranslatorStore';

export default function Translate() {
  const navigate = useNavigate();
  const { start, stop, destroy } = useTranslator();
  const isRecording = useTranslatorStore((s) => s.isRecording);
  const showTranscription = useTranslatorStore((s) => s.showTranscription);
  const [showSettings, setShowSettings] = useState(false);

  const handleToggle = useCallback((): void => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  const handleExit = useCallback((): void => {
    destroy();
    navigate('/');
  }, [destroy, navigate]);

  return (
    <div className="h-dvh flex flex-col bg-slate-50 overflow-hidden relative">
      <div className="flex items-center px-5 py-3 bg-white border-b border-slate-200 gap-3 shrink-0">
        <span className="font-semibold text-slate-700 text-sm">Live Translation</span>
        <div className="flex-1" />
        <StatusBar />
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 ml-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={handleExit}
          aria-label="Exit to home"
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 ml-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline strokeLinecap="round" strokeLinejoin="round" points="16 17 21 12 16 7" />
            <line strokeLinecap="round" strokeLinejoin="round" x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex bg-white border-b border-slate-100 shrink-0">
        {showTranscription ? (
          <>
            <div className="flex-1 px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">Korean</div>
            <div className="w-px bg-slate-100" />
            <div className="flex-1 px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">English</div>
          </>
        ) : (
          <div className="flex-1 px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">English Translation</div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showTranscription && (
          <>
            <SourcePanel />
            <div className="w-px bg-slate-200 shrink-0" />
          </>
        )}
        <TargetPanel />
      </div>

      <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-center relative shrink-0">
        <div className="absolute left-6">
          <TranscriptionToggle />
        </div>
        <div className="absolute right-6">
          <ModeToggle />
        </div>
        <div className="flex flex-col items-center gap-2">
          <AudioVisualizer />
          <RecordButton onToggle={handleToggle} />
          <span className="text-xs text-slate-400 font-medium">
            {isRecording ? 'Recording — tap to stop' : 'Tap to record'}
          </span>
        </div>
      </div>

      {showSettings && (
        <SettingsOverlay open={showSettings} onClose={() => setShowSettings(false)} showMicSelector />
      )}
    </div>
  );
}
