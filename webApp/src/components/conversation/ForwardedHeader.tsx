/**
 * P2.3: Заголовок пересланного сообщения в MessageBubble.
 * Показывает имя исходного отправителя и название чата.
 */

import { memo } from 'react';
import { CornerDownRight } from 'lucide-react';

interface ForwardedHeaderProps {
  senderName: string;
  chatName?: string;
}

export const ForwardedHeader = memo(function ForwardedHeader({ senderName, chatName }: ForwardedHeaderProps) {
  return (
    <div
      className="flex items-center gap-1.5 mb-1 text-[11px] opacity-70"
      style={{ color: '#8E8E93' }}
    >
      <CornerDownRight size={12} />
      <span>
        Переслано от <span className="font-semibold">{senderName}</span>
        {chatName ? <span> из {chatName}</span> : null}
      </span>
    </div>
  );
});
