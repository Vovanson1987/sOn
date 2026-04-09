import { useEffect, useState, useCallback } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { getCallHistory, type CallHistoryEntry } from '@/api/client';
import { useAuthStore } from '@stores/authStore';
import { useCallStore } from '@stores/callStore';

/** Форматирование даты звонка */
function formatCallDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Вчера';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Форматирование длительности звонка */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0) {
    return `${min} мин ${sec > 0 ? `${sec} сек` : ''}`.trim();
  }
  return `${sec} сек`;
}

/** Экран истории звонков */
export default function CallHistoryScreen() {
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const myId = useAuthStore((s) => s.user?.id);
  const startCall = useCallStore((s) => s.startCall);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCallHistory();
        if (!cancelled) {
          setCalls(data.calls);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Не удалось загрузить историю звонков');
          console.error('Call history error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCallTap = useCallback((call: CallHistoryEntry) => {
    if (!myId) return;
    const isOutgoing = call.caller_id === myId;
    const targetUserId = isOutgoing ? call.callee_id : call.caller_id;
    const contactName = isOutgoing ? call.callee_name : call.caller_name;
    const contactAvatar = isOutgoing ? call.callee_avatar : call.caller_avatar;
    startCall(
      call.chat_id || '',
      contactName,
      call.is_video,
      targetUserId,
      contactAvatar || undefined,
    );
  }, [myId, startCall]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#636366', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
        <Phone size={48} color="#636366" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-[14px] text-center" style={{ color: '#FF453A' }}>{error}</p>
      </div>
    );
  }

  // Empty state
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Phone size={48} color="#636366" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-[17px] font-semibold text-white">Нет звонков</p>
        <p className="text-[14px] text-center px-8" style={{ color: '#ABABAF' }}>
          Здесь будет отображаться журнал ваших звонков
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#141420' }}>
      {/* Header */}
      <div className="flex items-center justify-center px-4 pt-4 pb-2">
        <h1 className="text-[20px] font-bold text-white">Звонки</h1>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto">
        {calls.map((call) => {
          const isOutgoing = call.caller_id === myId;
          const isMissed = call.status === 'missed' || call.status === 'no_answer';
          const contactName = isOutgoing ? call.callee_name : call.caller_name;
          const contactAvatar = isOutgoing ? call.callee_avatar : call.caller_avatar;
          const duration = call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '';

          return (
            <button
              key={call.id}
              onClick={() => handleCallTap(call)}
              className="w-full flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity"
              style={{ borderBottom: '0.5px solid #282840' }}
              aria-label={`Позвонить ${contactName}`}
            >
              {/* Avatar */}
              <Avatar size={44} name={contactName} src={contactAvatar || undefined} />

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <p
                  className="text-[16px] font-medium truncate"
                  style={{ color: isMissed ? '#FF453A' : '#FFFFFF' }}
                >
                  {contactName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {/* Direction icon */}
                  {isMissed ? (
                    <PhoneMissed size={14} color="#FF453A" strokeWidth={2} />
                  ) : isOutgoing ? (
                    <PhoneOutgoing size={14} color="#30D158" strokeWidth={2} />
                  ) : (
                    <PhoneIncoming size={14} color="#30D158" strokeWidth={2} />
                  )}
                  <span className="text-[13px]" style={{ color: '#8E8E93' }}>
                    {isMissed
                      ? (isOutgoing ? 'Не отвечен' : 'Пропущенный')
                      : (isOutgoing ? 'Исходящий' : 'Входящий')}
                    {duration ? ` \u00B7 ${duration}` : ''}
                  </span>
                </div>
              </div>

              {/* Right side: date + call type */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[13px]" style={{ color: '#8E8E93' }}>
                  {formatCallDate(call.created_at)}
                </span>
                {call.is_video ? (
                  <Video size={18} color="#5B5FC7" strokeWidth={1.5} />
                ) : (
                  <Phone size={18} color="#5B5FC7" strokeWidth={1.5} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
