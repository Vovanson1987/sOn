import { useCallback } from 'react';
import type { Message } from '@/types/message';

/** Допустимые Tapback-реакции (как в iMessage) */
export type TapbackEmoji = '❤️' | '👍' | '👎' | '😂' | '‼️' | '❓';
const TAPBACK_EMOJIS: TapbackEmoji[] = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

interface TapbackOverlayProps {
  message: Message;
  isOwn: boolean;
  onReact: (emoji: TapbackEmoji) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Оверлей Tapback-реакций + контекстное меню (стиль iMessage) */
export function TapbackOverlay({
  message,
  isOwn,
  onReact,
  onReply,
  onCopy,
  onDelete,
  onClose,
}: TapbackOverlayProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-label="Реакции и действия"
    >
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Панель реакций */}
        <div
          className="flex items-center gap-1 px-3 py-2 rounded-full mb-2"
          style={{ background: '#1C1C1E' }}
          role="toolbar"
          aria-label="Реакции"
        >
          {TAPBACK_EMOJIS.map((emoji) => {
            const isActive = (message.reactions[emoji] ?? []).includes('user-me');
            return (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-full text-[20px] transition-transform hover:scale-125"
                style={{ background: isActive ? '#38383A' : 'transparent' }}
                aria-label={`Реакция ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>

        {/* Приподнятое сообщение */}
        <div
          className="px-[12px] py-[8px] rounded-[18px] mb-2"
          style={{
            background: isOwn ? '#007AFF' : '#26252A',
            transform: 'scale(1.05)',
          }}
        >
          <p className="text-[17px] leading-[1.35] text-white whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Контекстное меню */}
        <div
          className="rounded-[12px] overflow-hidden min-w-[200px]"
          style={{ background: '#1C1C1E' }}
          role="menu"
        >
          <button
            onClick={onReply}
            className="w-full flex items-center gap-3 px-4 py-[10px] text-left hover:bg-[#2C2C2E]"
            role="menuitem"
          >
            <span className="text-[15px]">💬</span>
            <span className="text-[15px] text-white">Ответить</span>
          </button>
          <div style={{ height: '0.5px', background: '#38383A', marginLeft: '44px' }} />
          <button
            onClick={onCopy}
            className="w-full flex items-center gap-3 px-4 py-[10px] text-left hover:bg-[#2C2C2E]"
            role="menuitem"
          >
            <span className="text-[15px]">📋</span>
            <span className="text-[15px] text-white">Копировать</span>
          </button>
          <div style={{ height: '0.5px', background: '#38383A', marginLeft: '44px' }} />
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-4 py-[10px] text-left hover:bg-[#2C2C2E]"
            role="menuitem"
          >
            <span className="text-[15px]">🗑</span>
            <span className="text-[15px]" style={{ color: '#FF3B30' }}>Удалить</span>
          </button>
        </div>
      </div>
    </div>
  );
}
