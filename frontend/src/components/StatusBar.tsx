import { useTranslatorStore } from '../store/useTranslatorStore';
import type { ConnectionStatus } from '../types';

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string; pulse: boolean }
> = {
  disconnected: {
    label: 'Disconnected',
    dotClass: 'bg-slate-300',
    textClass: 'text-slate-400',
    pulse: false,
  },
  connecting: {
    label: 'Connecting…',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-600',
    pulse: true,
  },
  connected: {
    label: 'Connected',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
    pulse: false,
  },
  error: {
    label: 'Error',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600',
    pulse: false,
  },
};

export function StatusBar() {
  const connectionStatus = useTranslatorStore((s) => s.connectionStatus);
  const config = STATUS_CONFIG[connectionStatus];

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${config.textClass}`}>
      <span
        className={`w-2 h-2 rounded-full ${config.dotClass} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </div>
  );
}
