import { useTranslatorStore } from '../../store/useTranslatorStore';

interface RecordButtonProps {
  onToggle: () => void;
  dark?: boolean;
}

export function RecordButton({ onToggle, dark }: RecordButtonProps) {
  const isRecording = useTranslatorStore((s) => s.isRecording);
  const connectionStatus = useTranslatorStore((s) => s.connectionStatus);
  const isConnecting = connectionStatus === 'connecting';
  const glow = dark ? '' : 'shadow-lg shadow-red-100';

  return (
    <button
      onClick={onToggle}
      disabled={isConnecting}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-4 focus:ring-offset-2 ${
        isRecording
          ? `bg-red-500 hover:bg-red-600 focus:ring-red-200 ${glow}`
          : isConnecting
          ? 'bg-slate-300 cursor-not-allowed'
          : `bg-red-600 hover:bg-red-700 focus:ring-red-200 ${glow} hover:scale-105 active:scale-100`
      }`}
    >

      <span className="relative z-10 text-white">
        {isRecording ? (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </span>
    </button>
  );
}
