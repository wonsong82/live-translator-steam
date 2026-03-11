import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslatorStore } from '../store/useTranslatorStore';
import { useViewer } from '../hooks/useViewer';

export default function ViewerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { connectionStatus } = useViewer();
  const sentences = useTranslatorStore((s) => s.sentences);
  const currentInterimSource = useTranslatorStore((s) => s.currentInterimSource);
  const currentInterimTranslation = useTranslatorStore((s) => s.currentInterimTranslation);

  const [showTranscription, setShowTranscription] = useState(true);
  const [showInterim, setShowInterim] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const koreanRef = useRef<HTMLDivElement>(null);
  const englishRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    koreanRef.current?.scrollTo({ top: koreanRef.current.scrollHeight, behavior: 'smooth' });
    englishRef.current?.scrollTo({ top: englishRef.current.scrollHeight, behavior: 'smooth' });
  }, [sentences.length, currentInterimSource, currentInterimTranslation]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen();
    } else {
      // Mobile Safari fallback — no Fullscreen API, toggle immersive mode
      setIsFullscreen((prev) => !prev);
    }
  }, []);

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
      {!isFullscreen && (
        <div className="flex items-center px-5 py-3 bg-[#111] border-b border-[#222] gap-3 shrink-0">
           <span className="font-semibold text-[#999] text-sm">Viewing Room: {roomId}</span>
          <div className="flex-1" />
          {!isConnected && (
            <span className="text-xs text-[#666] font-medium">{getStatusText()}</span>
          )}
          <button
            onClick={toggleFullscreen}
            aria-label="Enter fullscreen"
            className="text-[#555] hover:text-[#999] transition-colors p-1 rounded-lg hover:bg-[#1a1a1a]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline strokeLinecap="round" strokeLinejoin="round" points="15 3 21 3 21 9" />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="9 21 3 21 3 15" />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="21 3 14 10" />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="3 21 10 14" />
            </svg>
          </button>
        </div>
      )}

      <div className={`flex bg-[#111] border-b border-[#222] shrink-0 ${isFullscreen ? 'relative' : ''}`}>
        {showTranscription ? (
          <>
            <div className="flex-1 px-5 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#555] uppercase tracking-widest">Korean</span>
              <button
                onClick={() => setShowTranscription(false)}
                aria-label="Hide transcription"
                title="Hide transcription"
                className="text-[#555] hover:text-[#888] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect strokeLinecap="round" strokeLinejoin="round" x="3" y="3" width="18" height="18" rx="2" />
                  <line strokeLinecap="round" strokeLinejoin="round" x1="9" y1="3" x2="9" y2="21" />
                  <polyline strokeLinecap="round" strokeLinejoin="round" points="14 9 12 12 14 15" />
                </svg>
              </button>
            </div>
            <div className="w-px bg-[#222]" />
            <div className="flex-1 px-5 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#555] uppercase tracking-widest">English</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInterim(!showInterim)}
                  aria-label={showInterim ? 'Hide interim' : 'Show interim'}
                  title={showInterim ? 'Hide interim translations' : 'Show interim translations'}
                  className={`transition-colors ${showInterim ? 'text-[#888]' : 'text-[#555] hover:text-[#888]'}`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                {isFullscreen && (
                  <button
                    onClick={toggleFullscreen}
                    aria-label="Exit fullscreen"
                    title="Exit fullscreen"
                    className="text-[#555] hover:text-[#888] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline strokeLinecap="round" strokeLinejoin="round" points="4 14 8 14 8 18" />
                      <polyline strokeLinecap="round" strokeLinejoin="round" points="20 10 16 10 16 6" />
                      <polyline strokeLinecap="round" strokeLinejoin="round" points="14 4 14 8 18 8" />
                      <polyline strokeLinecap="round" strokeLinejoin="round" points="10 20 10 16 6 16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-stretch justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setShowTranscription(true)}
                aria-label="Show transcription"
                title="Show transcription"
                className="text-[#555] hover:text-[#888] transition-colors px-4 py-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect strokeLinecap="round" strokeLinejoin="round" x="3" y="3" width="18" height="18" rx="2" />
                  <line strokeLinecap="round" strokeLinejoin="round" x1="9" y1="3" x2="9" y2="21" />
                  <polyline strokeLinecap="round" strokeLinejoin="round" points="14 9 16 12 14 15" />
                </svg>
              </button>
              <div className="w-px self-stretch bg-[#333]" />
              <span className="text-xs font-semibold text-[#555] uppercase tracking-widest pl-5 py-2">English Translation</span>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowInterim(!showInterim)}
                aria-label={showInterim ? 'Hide interim' : 'Show interim'}
                title={showInterim ? 'Hide interim translations' : 'Show interim translations'}
                className={`transition-colors px-5 py-2 ${showInterim ? 'text-[#888]' : 'text-[#555] hover:text-[#888]'}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              {isFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  aria-label="Exit fullscreen"
                  title="Exit fullscreen"
                  className="text-[#555] hover:text-[#888] transition-colors pr-5 py-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline strokeLinecap="round" strokeLinejoin="round" points="4 14 8 14 8 18" />
                    <polyline strokeLinecap="round" strokeLinejoin="round" points="20 10 16 10 16 6" />
                    <polyline strokeLinecap="round" strokeLinejoin="round" points="14 4 14 8 18 8" />
                    <polyline strokeLinecap="round" strokeLinejoin="round" points="10 20 10 16 6 16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isConnected ? (
          <>
            {showTranscription && (
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
                  {showInterim && currentInterimSource && (
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
              </>
            )}
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
              {showInterim && currentInterimTranslation && (
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
