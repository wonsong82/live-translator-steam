import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslatorStore } from '../store/useTranslatorStore';
import { useViewer } from '../hooks/useViewer';

export default function ViewerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { connectionStatus } = useViewer();
  const sentences = useTranslatorStore((s) => s.sentences);
  const currentInterimSource = useTranslatorStore((s) => s.currentInterimSource);
  const currentInterimTranslation = useTranslatorStore((s) => s.currentInterimTranslation);

  const koreanRef = useRef<HTMLDivElement>(null);
  const englishRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    koreanRef.current?.scrollTo({ top: koreanRef.current.scrollHeight, behavior: 'smooth' });
    englishRef.current?.scrollTo({ top: englishRef.current.scrollHeight, behavior: 'smooth' });
  }, [sentences.length, currentInterimSource, currentInterimTranslation]);

  const visibleSentences = sentences.slice(-20);
  const offset = sentences.length - visibleSentences.length;

  const getStatusText = (): string => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting to room...';
      case 'error':
        return 'Room not found or presenter disconnected';
      case 'disconnected':
        return 'Presenter disconnected';
      case 'connected':
        return '';
      default:
        return '';
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center px-5 py-3 bg-[#111] border-b border-[#222] gap-3 shrink-0">
         <span className="font-semibold text-[#999] text-sm">Viewing Room: {roomId}</span>
        <div className="flex-1" />
        {!isConnected && (
          <span className="text-xs text-[#666] font-medium">{getStatusText()}</span>
        )}
      </div>

      <div className="flex bg-[#111] border-b border-[#222] shrink-0">
        <div className="flex-1 px-5 py-2 text-xs font-semibold text-[#555] uppercase tracking-widest">Korean</div>
        <div className="w-px bg-[#222]" />
        <div className="flex-1 px-5 py-2 text-xs font-semibold text-[#555] uppercase tracking-widest">English</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isConnected ? (
          <>
            <div ref={koreanRef} className="flex-1 overflow-y-auto px-6 py-4 pb-40">
              {visibleSentences.map((sentence, i) => (
                <div key={offset + i} className="py-2">
                  <p
                    className="text-2xl font-medium leading-relaxed text-white transition-opacity duration-300"
                    style={{ opacity: Math.max(0.3, (i + 1) / visibleSentences.length) }}
                  >
                    {sentence.sourceText}
                  </p>
                </div>
              ))}
              {currentInterimSource && (
                <div className="py-3">
                  <p className="text-2xl leading-relaxed text-white/35 italic">{currentInterimSource}</p>
                </div>
              )}
              {sentences.length === 0 && !currentInterimSource && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[#333] text-sm text-center select-none">Korean speech will appear here</p>
                </div>
              )}
            </div>
            <div className="w-px bg-[#222] shrink-0" />
            <div ref={englishRef} className="flex-1 overflow-y-auto px-6 py-4 pb-40">
              {visibleSentences.map((sentence, i) => (
                <div key={offset + i} className="py-2">
                  {sentence.translation !== null ? (
                    <p
                      className="text-2xl leading-relaxed text-white transition-opacity duration-300"
                      style={{ opacity: Math.max(0.3, (i + 1) / visibleSentences.length) }}
                    >
                      {sentence.translation}
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              ))}
              {currentInterimTranslation && (
                <div className="py-3">
                  <p className="text-2xl leading-relaxed text-white/35 italic">{currentInterimTranslation}</p>
                </div>
              )}
              {sentences.length === 0 && !currentInterimTranslation && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[#333] text-sm text-center select-none">English translation will appear here</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#666] text-sm text-center select-none">{getStatusText()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
