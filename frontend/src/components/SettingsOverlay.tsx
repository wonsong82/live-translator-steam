import { useEffect, useState } from 'react';
import { useTranslatorStore } from '../store/useTranslatorStore';
import { useDevices } from '../hooks/useDevices';
import type { TranslationMode } from '../types';

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
  showMicSelector?: boolean;
}

function getInitialMode(): TranslationMode {
  const saved = localStorage.getItem('translationMode');
  if (saved === 'hybrid' || saved === 'final-only') return saved;
  return 'hybrid';
}

export function SettingsOverlay({ open, onClose, showMicSelector }: SettingsOverlayProps) {
  const [mode, setMode] = useState<TranslationMode>(getInitialMode);
  const showTranscription = useTranslatorStore((s) => s.showTranscription);
  const setShowTranscription = useTranslatorStore((s) => s.setShowTranscription);
  const isRecording = useTranslatorStore((s) => s.isRecording);
  
  const { devices, selectedDeviceId, setSelectedDeviceId, refreshDevices } = useDevices();

  useEffect(() => {
    if (open) {
      void refreshDevices();
    }
  }, [open, refreshDevices]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleModeChange = (newMode: TranslationMode): void => {
    setMode(newMode);
    localStorage.setItem('translationMode', newMode);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#111] border border-[#222] rounded-xl p-8 flex flex-col gap-6 max-w-sm w-full mx-4">
        <div className="flex w-full justify-between items-center">
          <span className="text-[#888] text-sm font-medium uppercase tracking-widest">Settings</span>
          <button
            onClick={onClose}
            aria-label="Dismiss overlay"
            className="text-[#555] hover:text-white transition-colors text-2xl leading-none p-1 rounded hover:bg-[#1a1a1a]"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-xs uppercase tracking-widest text-[#555]">Translation Mode</h2>
            <div className="flex flex-col border border-[#222] rounded-lg overflow-hidden">
              <button 
                onClick={() => handleModeChange('hybrid')} 
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] transition-colors border-b border-[#222]"
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-[#ccc]">Hybrid</div>
                  <div className="text-xs text-[#666] mt-0.5">Interim NMT + final LLM translation</div>
                </div>
                <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${mode === 'hybrid' ? 'border-red-600 bg-red-600' : 'border-[#444]'}`}>
                  {mode === 'hybrid' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
              <button 
                onClick={() => handleModeChange('final-only')} 
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-[#ccc]">Final Only</div>
                  <div className="text-xs text-[#666] mt-0.5">LLM translation on complete sentences only</div>
                </div>
                <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${mode === 'final-only' ? 'border-red-600 bg-red-600' : 'border-[#444]'}`}>
                  {mode === 'final-only' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-[#222]" />

          <div className="flex flex-col gap-2">
            <h2 className="text-xs uppercase tracking-widest text-[#555]">Display</h2>
            <div className="flex items-center justify-between px-4 py-3 border border-[#222] rounded-lg">
              <div className="text-left">
                <div className="text-sm font-medium text-[#ccc]">Show Transcription</div>
                <div className="text-xs text-[#666] mt-0.5">Display the Korean source text panel</div>
              </div>
              <button
                onClick={() => setShowTranscription(!showTranscription)}
                aria-label={showTranscription ? 'Hide transcription' : 'Show transcription'}
                className="flex items-center gap-2 transition-colors shrink-0"
              >
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    showTranscription ? 'bg-red-600' : 'bg-[#333]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      showTranscription ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>

          {showMicSelector && (
            <>
              <div className="border-t border-[#222]" />
              
              <div className={`flex flex-col gap-2 ${isRecording ? 'opacity-50 pointer-events-none' : ''}`}>
                <h2 className="text-xs uppercase tracking-widest text-[#555]">Microphone</h2>
                <div className="flex flex-col border border-[#222] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {devices.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[#666] text-center">
                      No microphones found
                    </div>
                  ) : (
                    devices.map((device, index) => {
                      const isSelected = selectedDeviceId ? device.deviceId === selectedDeviceId : index === 0;
                      const label = device.label || `Microphone ${index + 1}`;
                      
                      return (
                        <button
                          key={device.deviceId || index}
                          onClick={() => setSelectedDeviceId(device.deviceId)}
                          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] transition-colors ${index !== devices.length - 1 ? 'border-b border-[#222]' : ''}`}
                        >
                          <div className="text-sm font-medium text-[#ccc] text-left truncate pr-4">
                            {label}
                          </div>
                          <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-red-600 bg-red-600' : 'border-[#444]'}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
