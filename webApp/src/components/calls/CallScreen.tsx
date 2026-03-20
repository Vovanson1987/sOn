import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, PhoneOff, Phone } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { useCallStore } from '@stores/callStore';

/** Форматирование таймера "ММ:СС" */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

/** Полноэкранный экран звонка в стиле iOS */
export function CallScreen() {
  const call = useCallStore((s) => s.activeCall);
  const acceptCall = useCallStore((s) => s.acceptCall);
  const endCall = useCallStore((s) => s.endCall);
  const toggleMic = useCallStore((s) => s.toggleMic);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);

  const [elapsed, setElapsed] = useState(0);

  // Статус и время начала звонка для зависимостей эффекта
  const callStatus = call?.status;
  const callStartedAt = call?.startedAt;

  // Таймер звонка
  useEffect(() => {
    if (callStatus !== 'active' || !callStartedAt) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - callStartedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus, callStartedAt]);

  // Сброс таймера при завершении звонка
  const elapsedValue = (!callStatus || callStatus === 'ended') ? 0 : elapsed;

  const handleEnd = useCallback(() => endCall(), [endCall]);
  const handleAccept = useCallback(() => acceptCall(), [acceptCall]);

  if (!call) return null;

  const isRinging = call.status === 'ringing';
  const isIncoming = call.isIncoming && isRinging;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-16"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${call.isVideo ? 'Видеозвонок' : 'Аудиозвонок'} — ${call.contactName}`}
    >
      {/* Верхняя часть: аватар + имя */}
      <div className="flex flex-col items-center">
        {/* Пульсирующие кольца при вызове */}
        <div className="relative">
          {isRinging && (
            <>
              <div
                className="absolute inset-[-15px] rounded-full"
                style={{
                  border: '2px solid rgba(48,209,88,0.3)',
                  animation: 'pulseRing 2s ease-out infinite',
                }}
              />
              <div
                className="absolute inset-[-30px] rounded-full"
                style={{
                  border: '2px solid rgba(48,209,88,0.15)',
                  animation: 'pulseRing 2s ease-out 0.5s infinite',
                }}
              />
            </>
          )}
          <Avatar size={120} name={call.contactName} src={call.contactAvatar} />
        </div>

        <h2 className="text-[28px] font-semibold text-white mt-6">{call.contactName}</h2>
        <p className="text-[16px] mt-1" style={{ color: '#ABABAF' }}>
          {isIncoming
            ? `Входящий ${call.isVideo ? 'видеозвонок' : 'аудиозвонок'}...`
            : isRinging
              ? 'Вызов...'
              : call.status === 'active'
                ? formatDuration(elapsedValue)
                : 'Завершён'}
        </p>
      </div>

      {/* Видео-заглушка (для видеозвонка) */}
      {call.isVideo && call.status === 'active' && (
        <div
          className="w-[100px] h-[140px] rounded-[12px] absolute top-[200px] right-[20px]"
          style={{
            background: 'linear-gradient(135deg, #1C1C1E, #2C2C2E)',
            border: '2px solid #38383A',
            cursor: 'grab',
          }}
        >
          <div className="flex items-center justify-center h-full text-[10px]" style={{ color: '#ABABAF' }}>
            PiP
          </div>
        </div>
      )}

      {/* Кнопки управления */}
      <div className="flex flex-col items-center gap-8">
        {/* Управление звонком */}
        {!isIncoming && (
          <div className="flex items-center gap-6">
            {/* Микрофон */}
            <button
              onClick={toggleMic}
              className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
              style={{ background: call.isMicMuted ? '#FF453A' : 'rgba(255,255,255,0.15)' }}
              aria-label={call.isMicMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {call.isMicMuted ? <MicOff size={24} color="white" /> : <Mic size={24} color="white" />}
            </button>

            {/* Камера */}
            {call.isVideo && (
              <button
                onClick={toggleCamera}
                className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
                style={{ background: !call.isCameraOn ? '#FF453A' : 'rgba(255,255,255,0.15)' }}
                aria-label={call.isCameraOn ? 'Выключить камеру' : 'Включить камеру'}
              >
                {call.isCameraOn ? <Video size={24} color="white" /> : <VideoOff size={24} color="white" />}
              </button>
            )}

            {/* Динамик */}
            <button
              onClick={toggleSpeaker}
              className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
              style={{ background: call.isSpeakerOn ? '#007AFF' : 'rgba(255,255,255,0.15)' }}
              aria-label={call.isSpeakerOn ? 'Выключить динамик' : 'Включить динамик'}
            >
              <Volume2 size={24} color="white" />
            </button>
          </div>
        )}

        {/* Кнопки принять/отклонить или завершить */}
        {isIncoming ? (
          <div className="flex items-center gap-16">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleEnd}
                className="w-[64px] h-[64px] rounded-full flex items-center justify-center"
                style={{ background: '#FF453A' }}
                aria-label="Отклонить"
              >
                <PhoneOff size={28} color="white" />
              </button>
              <span className="text-[12px]" style={{ color: '#FF453A' }}>Отклонить</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAccept}
                className="w-[64px] h-[64px] rounded-full flex items-center justify-center"
                style={{ background: '#30D158' }}
                aria-label="Принять"
              >
                <Phone size={28} color="white" />
              </button>
              <span className="text-[12px]" style={{ color: '#30D158' }}>Принять</span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleEnd}
            className="w-[64px] h-[64px] rounded-full flex items-center justify-center"
            style={{ background: '#FF453A' }}
            aria-label="Завершить звонок"
          >
            <PhoneOff size={28} color="white" />
          </button>
        )}
      </div>
    </div>
  );
}
