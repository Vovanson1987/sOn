import { memo } from 'react';
import { Lock } from 'lucide-react';
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

/** Пузырь сообщения в стиле iMessage (Mac) */
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  chatType,
  showSenderName,
}: MessageBubbleProps) {
  const isSecret = chatType === 'secret';

  // Системное сообщение — по центру серым текстом
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-2 px-8">
        <span className="text-[12px] text-center leading-[1.4]" style={{ color: '#8E8E93' }}>
          {message.content}
        </span>
      </div>
    );
  }

  // Уничтоженное сообщение
  if (message.isDestroyed) {
    return (
      <div className="flex justify-center py-2 px-8">
        <span className="text-[12px] italic" style={{ color: '#8E8E93' }}>
          🔒 Сообщение удалено
        </span>
      </div>
    );
  }

  // Цвет фона пузыря (используем только background, без backgroundColor)
  let bg: string;
  if (isOwn) {
    bg = isSecret ? 'linear-gradient(135deg, #34C759, #30D158)' : '#007AFF';
  } else {
    bg = isSecret ? '#1E1E22' : '#26252A';
  }

  // Скругления с группировкой (без хвостиков на десктопе)
  const ownRadius = {
    borderTopLeftRadius: '18px',
    borderTopRightRadius: isFirstInGroup ? '18px' : '6px',
    borderBottomRightRadius: isLastInGroup ? '18px' : '6px',
    borderBottomLeftRadius: '18px',
  };
  const otherRadius = {
    borderTopLeftRadius: isFirstInGroup ? '18px' : '6px',
    borderTopRightRadius: '18px',
    borderBottomRightRadius: '18px',
    borderBottomLeftRadius: isLastInGroup ? '18px' : '6px',
  };
  const radiusStyle = isOwn ? ownRadius : otherRadius;

  // Реакции
  const reactionEntries = Object.entries(message.reactions).filter(([, users]) => users.length > 0);

  return (
    <div
      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
      style={{
        paddingLeft: isOwn ? '20%' : '16px',
        paddingRight: isOwn ? '20px' : '20%',
        marginTop: isFirstInGroup ? '6px' : '1px',
      }}
    >
      {/* Имя отправителя в групповых чатах */}
      {showSenderName && !isOwn && isFirstInGroup && (
        <span className="text-[12px] font-medium mb-[2px] ml-[12px]" style={{ color: '#007AFF' }}>
          {message.senderName}
        </span>
      )}

      {/* Пузырь — fit-content */}
      <div
        className="relative px-[12px] py-[8px]"
        style={{
          background: bg,
          ...radiusStyle,
          maxWidth: '100%',
          width: 'fit-content',
        }}
      >
        {/* Текст сообщения */}
        <p className="text-[17px] leading-[1.35] text-white whitespace-pre-wrap break-words">
          {isSecret && <Lock size={12} color="rgba(255,255,255,0.5)" className="inline mr-1 mb-[2px]" />}
          {message.content}
        </p>
      </div>

      {/* Реакции */}
      {reactionEntries.length > 0 && (
        <div className={`flex gap-1 mt-[-4px] ${isOwn ? 'mr-1' : 'ml-1'}`}>
          {reactionEntries.map(([emoji, users]) => (
            <span
              key={emoji}
              className="text-[12px] px-[5px] py-[1px] rounded-full"
              style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
            >
              {emoji}{users.length > 1 ? ` ${users.length}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
