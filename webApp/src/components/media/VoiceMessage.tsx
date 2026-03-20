import { memo } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceMessageProps {
  duration: number;
  isPlaying: boolean;
  progress: number;
  onTogglePlay: () => void;
}

/** Форматирование секунд в m:ss */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Голосовое сообщение с SVG-волной */
export const VoiceMessage = memo(function VoiceMessage({ duration, isPlaying, progress, onTogglePlay }: VoiceMessageProps) {
  // Генерация простой волны
  const bars = 24;
  const heights = Array.from({ length: bars }, (_, i) =>
    0.3 + 0.7 * Math.abs(Math.sin((i * 3.14) / 6)),
  );

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        onClick={onTogglePlay}
        className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0"
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        <div
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center"
          style={{ background: '#007AFF' }}
        >
          {isPlaying ? <Pause size={14} color="white" /> : <Play size={14} color="white" style={{ marginLeft: '2px' }} />}
        </div>
      </button>

      {/* SVG волна */}
      <div className="flex-1 flex items-center gap-[2px] h-[28px]">
        {heights.map((h, i) => {
          const played = i / bars <= progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${h * 100}%`,
                background: played ? '#007AFF' : '#636366',
                minWidth: '2px',
              }}
            />
          );
        })}
      </div>

      <span className="text-[12px] flex-shrink-0" style={{ color: '#ABABAF' }}>
        {formatDuration(duration)}
      </span>
    </div>
  );
});
