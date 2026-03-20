import { memo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { Message } from '@/types/message';
import type { ChatType } from '@/types/chat';
import { FileAttachment } from '@components/media/FileAttachment';
import { VoiceMessage } from '@components/media/VoiceMessage';
import { ImageViewer } from '@components/media/ImageViewer';

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
  const [viewImage, setViewImage] = useState(false);

  // Системное сообщение — по центру серым текстом
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-2 px-8">
        <span className="text-[12px] text-center leading-[1.4]" style={{ color: '#ABABAF' }}>
          {message.content}
        </span>
      </div>
    );
  }

  // Уничтоженное сообщение
  if (message.isDestroyed) {
    return (
      <div className="flex justify-center py-2 px-8">
        <span className="text-[12px] italic" style={{ color: '#ABABAF' }}>
          🔒 Сообщение удалено
        </span>
      </div>
    );
  }

  // Цвет фона пузыря
  let bg: string;
  if (isOwn) {
    bg = isSecret ? '#30D158' : '#007AFF';
  } else {
    bg = isSecret ? '#1E1E22' : '#3A3A3C';
  }

  // Скругления: овальные пузыри (18px), группировка (4px на прилегающей стороне)
  const ownRadius = {
    borderTopLeftRadius: '18px',
    borderTopRightRadius: isFirstInGroup ? '18px' : '4px',
    borderBottomRightRadius: isLastInGroup ? '18px' : '4px',
    borderBottomLeftRadius: '18px',
  };
  const otherRadius = {
    borderTopLeftRadius: isFirstInGroup ? '18px' : '4px',
    borderTopRightRadius: '18px',
    borderBottomRightRadius: '18px',
    borderBottomLeftRadius: isLastInGroup ? '18px' : '4px',
  };
  const radiusStyle = isOwn ? ownRadius : otherRadius;

  // Реакции
  const reactionEntries = Object.entries(message.reactions).filter(([, users]) => users.length > 0);

  return (
    <div
      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
      style={{
        paddingLeft: isOwn ? '0' : '18px',
        paddingRight: isOwn ? '18px' : '0',
        marginTop: isFirstInGroup ? '8px' : '2px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Имя отправителя в групповых чатах */}
      {showSenderName && !isOwn && isFirstInGroup && (
        <span className="text-[12px] font-medium mb-[2px] ml-[12px]" style={{ color: '#007AFF' }}>
          {message.senderName}
        </span>
      )}

      {/* Пузырь — овал, fit-content */}
      <div
        style={{
          background: bg,
          ...radiusStyle,
          maxWidth: '65%',
          width: 'fit-content',
          padding: '8px 16px',
        }}
      >
        {message.type === 'image' && message.attachment ? (
          <>
            <img
              src={message.attachment.url}
              alt={message.content || 'Изображение'}
              className="rounded-[8px] max-w-full cursor-pointer"
              style={{ maxHeight: '300px' }}
              onClick={() => setViewImage(true)}
            />
            {message.content && (
              <p className="text-[15px] leading-[1.35] text-white mt-1">{message.content}</p>
            )}
            {viewImage && (
              <ImageViewer
                src={message.attachment.url}
                alt={message.content || 'Изображение'}
                onClose={() => setViewImage(false)}
              />
            )}
          </>
        ) : message.type === 'file' && message.attachment ? (
          <FileAttachment
            fileName={message.attachment.fileName || 'Файл'}
            fileSize={message.attachment.fileSize || 0}
          />
        ) : message.type === 'voice' && message.attachment ? (
          <VoiceMessage
            duration={message.attachment.duration || 0}
            isPlaying={false}
            progress={0}
            onTogglePlay={() => {}}
          />
        ) : (
          <p className="text-[17px] leading-[1.35] text-white whitespace-pre-wrap break-words">
            {isSecret && <Lock size={12} color="rgba(255,255,255,0.5)" className="inline mr-1 mb-[2px]" aria-hidden="true" />}
            {message.content}
          </p>
        )}
      </div>

      {/* Реакции */}
      {reactionEntries.length > 0 && (
        <div className={`flex gap-1 mt-[-4px] ${isOwn ? 'mr-1' : 'ml-1'}`}>
          {reactionEntries.map(([emoji, users]) => (
            <span
              key={emoji}
              className="text-[12px] px-[5px] py-[1px] rounded-full"
              style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
              role="img"
              aria-label={`${emoji} ${users.length}`}
            >
              {emoji}{users.length > 1 ? ` ${users.length}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
