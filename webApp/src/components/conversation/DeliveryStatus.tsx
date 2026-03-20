import { memo } from 'react';
import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import type { MessageStatus } from '@/types/message';

interface DeliveryStatusProps {
  status: MessageStatus;
  readAt?: string;
  onRetry?: () => void;
}

/** Форматирование даты прочтения */
function formatReadDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Статус доставки под последним исходящим сообщением */
export const DeliveryStatus = memo(function DeliveryStatus({ status, readAt, onRetry }: DeliveryStatusProps) {
  if (status === 'sending') {
    return (
      <span className="text-[11px] flex items-center gap-1" style={{ color: '#ABABAF' }} role="status" aria-live="polite">
        <Clock size={11} aria-hidden="true" />
        Отправка...
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="text-[11px] flex items-center gap-1" style={{ color: '#ABABAF' }} role="status">
        <Check size={12} aria-hidden="true" />
        Отправлено
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="text-[11px] flex items-center gap-1" style={{ color: '#ABABAF' }} role="status">
        <CheckCheck size={12} aria-hidden="true" />
        Доставлено
      </span>
    );
  }
  if (status === 'read') {
    const dateStr = readAt ? ` ${formatReadDate(readAt)}` : '';
    return (
      <span className="text-[11px] flex items-center gap-1" style={{ color: '#007AFF' }} role="status">
        <CheckCheck size={12} aria-hidden="true" />
        Прочитано{dateStr}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="text-[11px] flex items-center gap-1" style={{ color: '#FF453A' }} role="status">
        <AlertCircle size={12} aria-hidden="true" />
        Не доставлено
        {onRetry && (
          <button
            onClick={onRetry}
            className="underline ml-1"
            style={{ color: '#007AFF' }}
            aria-label="Повторить отправку"
          >
            Повторить
          </button>
        )}
      </span>
    );
  }
  return null;
});
