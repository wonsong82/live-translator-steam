import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RoomOverlayProps {
  roomId: string;
  viewerCount: number;
  onDismiss: () => void;
}

export function RoomOverlay({ roomId, viewerCount, onDismiss }: RoomOverlayProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/view/${roomId}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#111] border border-[#222] rounded-xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
        <div className="flex w-full justify-between items-center">
          <span className="text-[#888] text-sm font-medium uppercase tracking-widest">Live Room</span>
          <button
            onClick={onDismiss}
            aria-label="Dismiss overlay"
            className="text-[#555] hover:text-white transition-colors text-2xl leading-none p-1 rounded hover:bg-[#1a1a1a]"
          >
            ×
          </button>
        </div>

        <div className="text-5xl font-mono tracking-widest text-white select-all">{roomId}</div>

        <QRCodeSVG value={url} size={200} bgColor="transparent" fgColor="#fff" />

        <p className="text-xs text-[#666] break-all text-center select-all w-full px-2">{url}</p>

        <button
          onClick={handleCopy}
          className="w-full py-2 px-4 bg-[#222] hover:bg-[#333] text-white rounded-lg text-sm transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>

        <span className="text-[#888] text-sm">
          {viewerCount} viewer{viewerCount !== 1 ? 's' : ''} connected
        </span>
      </div>
    </div>
  );
}
