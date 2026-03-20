import { useCallback, useEffect, useRef } from 'react';
import { useFocusTrap } from '@hooks/useFocusTrap';
import { Reply, Copy, Trash2 } from 'lucide-react';
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
  const focusTrapRef = useFocusTrap();
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /** Arrow-key navigation inside toolbar and menu */
  const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'));
    const idx = buttons.indexOf(e.target as HTMLButtonElement);
    if (idx === -1) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
    }
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div
      ref={focusTrapRef}
      className={`fixed inset-0 z-50 flex items-end ${isOwn ? 'justify-end' : 'justify-start'} pb-[20%] px-4`}
      style={{
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        animation: 'fadeIn 0.2s ease forwards',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Реакции и действия"
    >
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Панель реакций */}
        <div
          ref={toolbarRef}
          className="flex items-center gap-1 px-2 py-1 rounded-full mb-2"
          style={{
            background: '#1C1C1E',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'springBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          }}
          role="toolbar"
          aria-label="Реакции"
          onKeyDown={handleToolbarKeyDown}
        >
          {TAPBACK_EMOJIS.map((emoji) => {
            const isActive = (message.reactions[emoji] ?? []).includes('user-me');
            return (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="w-[44px] h-[44px] flex items-center justify-center rounded-full text-[22px] transition-transform active:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007AFF]"
                style={{ background: isActive ? '#38383A' : 'transparent' }}
                aria-label={`Реакция ${emoji}`}
                aria-pressed={isActive}
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
            background: isOwn ? '#007AFF' : '#3A3A3C',
            transform: 'scale(1.05)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <p className="text-[17px] leading-[1.3] text-white whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Контекстное меню */}
        <div
          className="rounded-[12px] overflow-hidden min-w-[200px]"
          style={{ background: '#1C1C1E', boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.08)' }}
          role="menu"
          aria-label="Действия с сообщением"
        >
          <button
            onClick={onReply}
            className="w-full flex items-center gap-3 px-4 py-[12px] text-left active:bg-[#2C2C2E] focus-visible:bg-[#2C2C2E] focus-visible:outline-none"
            role="menuitem"
          >
            <Reply size={18} color="#fff" aria-hidden="true" />
            <span className="text-[15px] text-white">Ответить</span>
          </button>
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.1)', marginLeft: '44px' }} />
          <button
            onClick={onCopy}
            className="w-full flex items-center gap-3 px-4 py-[12px] text-left active:bg-[#2C2C2E] focus-visible:bg-[#2C2C2E] focus-visible:outline-none"
            role="menuitem"
          >
            <Copy size={18} color="#fff" aria-hidden="true" />
            <span className="text-[15px] text-white">Копировать</span>
          </button>
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.1)', marginLeft: '44px' }} />
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-4 py-[12px] text-left active:bg-[#2C2C2E] focus-visible:bg-[#2C2C2E] focus-visible:outline-none"
            role="menuitem"
          >
            <Trash2 size={18} color="#FF453A" aria-hidden="true" />
            <span className="text-[15px]" style={{ color: '#FF453A' }}>Удалить</span>
          </button>
        </div>
      </div>
    </div>
  );
}
