import { memo } from 'react';
import { Lock } from 'lucide-react';
import { formatMessageTime } from '@utils/dateFormat';
import type { Message } from '@/types/message';
import type { ChatType } from '@/types/chat';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  chatType: ChatType;
  showSenderName?: boolean;
}

/** Пузырь сообщения в стиле iOS Messages */
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  chatType,
  showSenderName,
}: MessageBubbleProps) {
  const isSecret = chatType === 'secret';
  const time = formatMessageTime(message.createdAt);

  // Системное сообщение — по центру серым текстом
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-1 px-4">
        <span className="text-[13px] text-center" style={{ color: '#8E8E93' }}>
          {message.content}
        </span>
      </div>
    );
  }

  // Уничтоженное сообщение
  if (message.isDestroyed) {
    return (
      <div className="flex justify-center py-1 px-4">
        <span className="text-[13px] italic" style={{ color: '#8E8E93' }}>
          🔒 Сообщение удалено
        </span>
      </div>
    );
  }

  // Цвет фона пузыря
  let bgColor: string;
  if (isOwn) {
    if (isSecret) {
      bgColor = 'linear-gradient(135deg, #34C759, #30D158)';
    } else {
      bgColor = '#007AFF';
    }
  } else {
    bgColor = isSecret ? '#1E1E22' : '#26252A';
  }

  // Скругления с группировкой
  const topLeft = isOwn ? '18px' : (isFirstInGroup ? '18px' : '4px');
  const topRight = isOwn ? (isFirstInGroup ? '18px' : '4px') : '18px';
  const bottomLeft = isOwn ? '18px' : (isLastInGroup ? '18px' : '4px');
  const bottomRight = isOwn ? (isLastInGroup ? '18px' : '4px') : '18px';
  const borderRadius = `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;

  // Реакции
  const reactionEntries = Object.entries(message.reactions).filter(([, users]) => users.length > 0);

  return (
    <div
      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} px-4`}
      style={{ marginTop: isFirstInGroup ? '8px' : '2px' }}
    >
      {/* Имя отправителя в групповых чатах */}
      {showSenderName && !isOwn && isFirstInGroup && (
        <span className="text-[12px] font-medium ml-3 mb-[2px]" style={{ color: '#007AFF' }}>
          {message.senderName}
        </span>
      )}

      {/* Пузырь */}
      <div
        className="relative px-3 py-[6px] max-w-[75%]"
        style={{
          background: isOwn && isSecret ? bgColor : undefined,
          backgroundColor: isOwn && isSecret ? undefined : bgColor,
          borderRadius,
        }}
      >
        {/* Текст сообщения */}
        <p className="text-[17px] leading-[1.3] text-white whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Время + иконка замка для секретных */}
        <div className={`flex items-center gap-1 mt-[2px] ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {isSecret && <Lock size={10} color="rgba(255,255,255,0.5)" />}
          <span
            className="text-[11px]"
            style={{ color: isOwn ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}
          >
            {time}
          </span>
        </div>
      </div>

      {/* Реакции */}
      {reactionEntries.length > 0 && (
        <div className={`flex gap-1 mt-[-4px] ${isOwn ? 'mr-2' : 'ml-2'}`}>
          {reactionEntries.map(([emoji, users]) => (
            <span
              key={emoji}
              className="text-[12px] px-[5px] py-[1px] rounded-full"
              style={{ backgroundColor: '#1C1C1E', border: '0.5px solid #38383A' }}
            >
              {emoji}{users.length > 1 ? ` ${users.length}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
