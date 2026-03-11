import { useState, useRef, useEffect } from 'react';
import { useDevices } from '../../hooks/useDevices';
import { useTranslatorStore } from '../../store/useTranslatorStore';

interface MicPickerProps {
  dark?: boolean;
}

export function MicPicker({ dark }: MicPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { devices, selectedDeviceId, setSelectedDeviceId } = useDevices();
  const isRecording = useTranslatorStore((s) => s.isRecording);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    if (!isRecording) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setIsOpen(false);
  };

  const buttonIconColor = dark ? 'text-[#555]' : 'text-slate-400';
  const dropdownBg = dark ? 'bg-[#222]' : 'bg-white';
  const dropdownText = dark ? 'text-[#888]' : 'text-slate-600';
  const dropdownBorder = dark ? 'border-[#333]' : 'border-slate-200';
  const hoverBg = dark ? 'hover:bg-[#333]' : 'hover:bg-slate-50';

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={handleToggle}
        disabled={isRecording}
        className={`p-1.5 rounded flex items-center justify-center transition-colors ${
          isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5'
        } ${buttonIconColor}`}
        aria-label="Select microphone"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
        <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute bottom-full mb-2 left-0 min-w-[180px] rounded-lg border overflow-hidden shadow-lg z-50 ${dropdownBg} ${dropdownBorder} ${dropdownText}`}>
          {devices.length === 0 ? (
            <div className="px-3 py-2 text-sm opacity-50">
              No microphones detected
            </div>
          ) : (
            <div className="py-1">
              {devices.map((device, index) => {
                const isSelected = device.deviceId === selectedDeviceId || (!selectedDeviceId && index === 0);
                const label = device.label || `Microphone ${index + 1}`;
                
                return (
                  <div
                    key={device.deviceId}
                    onClick={() => handleSelect(device.deviceId)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm ${hoverBg}`}
                  >
                    <div className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
                      {isSelected && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
