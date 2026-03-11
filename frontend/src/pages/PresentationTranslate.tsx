import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { RecordButton } from '../components/Controls/RecordButton';
import { ModeToggle } from '../components/Controls/ModeToggle';
import { TranscriptionToggle } from '../components/Controls/TranscriptionToggle';
import { StatusBar } from '../components/StatusBar';
import { RoomOverlay } from '../components/RoomOverlay';
import { useTranslator } from '../hooks/useTranslator';
import { useTranslatorStore } from '../store/useTranslatorStore';
import { useRoomStore } from '../store/useRoomStore';
import { isMobile } from '../utils/isMobile';

export default function PresentationTranslate() {
  const navigate = useNavigate();
  const { start, pause, resume, destroy, createRoom, isStarted } = useTranslator();
  const isRecording = useTranslatorStore((s) => s.isRecording);
  const showTranscription = useTranslatorStore((s) => s.showTranscription);
  const sentences = useTranslatorStore((s) => s.sentences);
  const currentInterimSource = useTranslatorStore((s) => s.currentInterimSource);
  const currentInterimTranslation = useTranslatorStore((s) => s.currentInterimTranslation);

  const [showOverlay, setShowOverlay] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const roomId = useRoomStore((s) => s.roomId);
  const viewerCount = useRoomStore((s) => s.viewerCount);
  const setRoom = useRoomStore((s) => s.setRoom);

  const koreanRef = useRef<HTMLDivElement>(null);
  const englishRef = useRef<HTMLDivElement>(null);

  // Auto-start recording on mount (skip on mobile)
  useEffect(() => {
    if (!isMobile()) {
      start().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to start recording';
        setStartError(msg);
      });
    }
  }, [start]);

  const handleToggle = useCallback(async (): Promise<void> => {
    if (isRecording) {
      pause();
    } else if (isStarted) {
      await resume();
    } else {
      await start().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to start recording';
        setStartError(msg);
      });
    }
  }, [isRecording, isStarted, pause, resume, start]);

  const handleExit = useCallback((): void => {
    destroy(); // calls destroy() — full teardown
    useRoomStore.getState().resetRoom();
    navigate('/');
  }, [destroy, navigate]);

  const handleCreateRoom = useCallback(async (): Promise<void> => {
    try {
      const id = await createRoom();
      setRoom(id, 'presenter');
      setShowOverlay(true);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  }, [createRoom, setRoom]);

  useEffect(() => {
    koreanRef.current?.scrollTo({ top: koreanRef.current.scrollHeight, behavior: 'smooth' });
    englishRef.current?.scrollTo({ top: englishRef.current.scrollHeight, behavior: 'smooth' });
  }, [sentences.length, currentInterimSource, currentInterimTranslation]);

  const visibleSentences = sentences.slice(-20);
  const offset = sentences.length - visibleSentences.length;

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center px-5 py-3 bg-[#111] border-b border-[#222] gap-3 shrink-0">
        <span className="font-semibold text-[#999] text-sm">Live Translation</span>
        <div className="flex-1" />
         <StatusBar />
         <button
           onClick={() => { void handleCreateRoom(); }}
           aria-label="Create room"
           className="text-[#555] hover:text-[#999] transition-colors p-1 rounded-lg hover:bg-[#1a1a1a] ml-2"
           title="Create Room"
         >
           <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
           </svg>
         </button>
         <Link to="/settings" aria-label="Settings" className="text-[#555] hover:text-[#999] transition-colors p-1 rounded-lg hover:bg-[#1a1a1a] ml-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
          <button
            onClick={handleExit}
            aria-label="Exit to home"
            className="text-[#555] hover:text-[#999] transition-colors p-1 rounded-lg hover:bg-[#1a1a1a] ml-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="16 17 21 12 16 7" />
              <line strokeLinecap="round" strokeLinejoin="round" x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
       </div>

      <div className="flex bg-[#111] border-b border-[#222] shrink-0">
        {showTranscription ? (
          <>
            <div className="flex-1 px-5 py-2 text-xs font-semibold text-[#555] uppercase tracking-widest">Korean</div>
            <div className="w-px bg-[#222]" />
            <div className="flex-1 px-5 py-2 text-xs font-semibold text-[#555] uppercase tracking-widest">English</div>
          </>
        ) : (
          <div className="flex-1 px-5 py-2 text-xs font-semibold text-[#555] uppercase tracking-widest">English Translation</div>
        )}
      </div>

       <div className="flex flex-1 overflow-hidden relative">
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

         {showOverlay && roomId && (
           <RoomOverlay
             roomId={roomId}
             viewerCount={viewerCount}
             onDismiss={() => setShowOverlay(false)}
           />
         )}
       </div>

        <div className="bg-[#111] border-t border-[#222] px-6 py-4 flex items-center justify-center relative shrink-0">
          <div className="absolute left-6">
            <TranscriptionToggle />
          </div>
          <div className="absolute right-6">
            <ModeToggle />
          </div>
            <div className="flex flex-col items-center gap-2">
              <AudioVisualizer />
              <RecordButton onToggle={handleToggle} dark />
               <span className="text-xs text-[#555] font-medium">
                 {startError ? 'Error: ' + startError : isRecording ? 'Recording — tap to pause' : isStarted ? 'Paused — tap to resume' : 'Tap to start'}
               </span>
            </div>
        </div>
     </div>
   );
}
