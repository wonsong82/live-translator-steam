import { useTranslatorStore } from '../../store/useTranslatorStore';

export function TranscriptionToggle() {
  const showTranscription = useTranslatorStore((s) => s.showTranscription);
  const setShowTranscription = useTranslatorStore((s) => s.setShowTranscription);

  return (
    <button
      onClick={() => setShowTranscription(!showTranscription)}
      aria-label={showTranscription ? 'Hide transcription' : 'Show transcription'}
      className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
    >
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${
          showTranscription ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            showTranscription ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-xs font-medium hidden sm:inline">Transcription</span>
    </button>
  );
}
