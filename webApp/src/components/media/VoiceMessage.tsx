import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceMessageProps {
  duration: number;
  isPlaying?: boolean;
  progress?: number;
  onTogglePlay?: () => void;
  audioUrl?: string;
}

/** Форматирование секунд в m:ss */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Голосовое сообщение с SVG-волной и реальным воспроизведением */
export const VoiceMessage = memo(function VoiceMessage({
  duration,
  isPlaying: externalIsPlaying,
  progress: externalProgress,
  onTogglePlay: externalToggle,
  audioUrl,
}: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [internalProgress, setInternalProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Use internal state when audioUrl is provided, otherwise fall back to external props
  const hasAudio = !!audioUrl;
  const isPlaying = hasAudio ? internalPlaying : (externalIsPlaying ?? false);
  const progress = hasAudio ? internalProgress : (externalProgress ?? 0);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!hasAudio) {
      externalToggle?.();
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setInternalProgress(audio.currentTime / audio.duration);
          setCurrentTime(audio.currentTime);
        }
      };

      audio.onended = () => {
        setInternalPlaying(false);
        setInternalProgress(0);
        setCurrentTime(0);
        audioRef.current = null;
      };

      audio.onerror = () => {
        console.error('Ошибка воспроизведения аудио');
        setInternalPlaying(false);
        audioRef.current = null;
      };
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (internalPlaying) {
      audio.pause();
      setInternalPlaying(false);
    } else {
      audio.play().then(() => {
        setInternalPlaying(true);
      }).catch((err) => {
        console.error('Ошибка воспроизведения:', err);
      });
    }
  }, [hasAudio, audioUrl, internalPlaying, externalToggle]);

  // Генерация простой волны (мемоизируем, т.к. зависит только от количества баров)
  const bars = 24;
  const heights = useMemo(
    () => Array.from({ length: bars }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin((i * 3.14) / 6))),
    [bars],
  );

  const displayDuration = hasAudio && isPlaying ? currentTime : duration;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        onClick={handleTogglePlay}
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
      <div
        className="flex-1 flex items-center gap-[2px] h-[28px]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Прогресс воспроизведения"
      >
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
        {formatDuration(displayDuration)}
      </span>
    </div>
  );
});
