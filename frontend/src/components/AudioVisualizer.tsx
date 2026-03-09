import { useAudioLevel } from '../hooks/useAudioLevel';

const BAR_MULTIPLIERS = [0.35, 0.6, 0.85, 1.0, 0.85, 0.6, 0.35];

export function AudioVisualizer() {
  const level = useAudioLevel();

  return (
    <div className="flex items-center justify-center gap-0.5 h-7">
      {BAR_MULTIPLIERS.map((multiplier, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-red-500 transition-all duration-75"
          style={{ height: `${Math.max(3, level * multiplier * 28)}px`, opacity: level > 0 ? 1 : 0.3 }}
        />
      ))}
    </div>
  );
}
