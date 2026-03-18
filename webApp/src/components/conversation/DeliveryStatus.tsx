import { memo } from 'react';
import { AlertCircle } from 'lucide-react';
import type { MessageStatus } from '@/types/message';

interface DeliveryStatusProps {
  status: MessageStatus;
}

/** Статус доставки под последним исходящим сообщением */
export const DeliveryStatus = memo(function DeliveryStatus({ status }: DeliveryStatusProps) {
  if (status === 'sending') {
    return <span className="text-[11px]" style={{ color: '#8E8E93' }}>Отправка...</span>;
  }
  if (status === 'sent') {
    return <span className="text-[11px]" style={{ color: '#8E8E93' }}>Отправлено</span>;
  }
  if (status === 'delivered') {
    return <span className="text-[11px]" style={{ color: '#8E8E93' }}>Доставлено</span>;
  }
  if (status === 'read') {
    return <span className="text-[11px]" style={{ color: '#007AFF' }}>Прочитано</span>;
  }
  if (status === 'failed') {
    return (
      <span className="text-[11px] flex items-center gap-1" style={{ color: '#FF3B30' }}>
        <AlertCircle size={12} />
        Не доставлено
      </span>
    );
  }
  return null;
});
