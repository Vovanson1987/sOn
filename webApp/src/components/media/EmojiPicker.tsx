import { useState, useEffect, useRef, useCallback } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { name: 'Smileys', icon: '😀', emojis: ['😀', '😂', '🥹', '😍', '🤔', '😴', '🥳', '🤯'] },
  { name: 'Hearts', icon: '❤️', emojis: ['❤️', '💕', '💔'] },
  { name: 'Hands', icon: '👍', emojis: ['👍', '👎', '👋', '🤝', '✌️', '🙏'] },
  { name: 'Fun', icon: '🔥', emojis: ['🔥', '⭐', '🎉', '💯', '🎶'] },
  { name: 'Animals', icon: '🐶', emojis: ['🐶', '🐱', '🦊', '🐻'] },
  { name: 'Food', icon: '☕', emojis: ['☕', '🍕', '🎂', '🍎'] },
] as const;

/** Компактный emoji-picker в стиле iMessage (без внешних зависимостей) */
export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Закрытие по клику снаружи
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Закрытие по Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
    },
    [onSelect],
  );

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 rounded-[12px] overflow-hidden z-50"
      style={{
        background: '#1C1C1E',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.08)',
        width: '300px',
        maxHeight: '250px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      {/* Category tabs */}
      <div
        className="flex items-center gap-0 px-1 py-1 overflow-x-auto"
        style={{ background: '#2C2C2E', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        {CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(idx)}
            className="flex-shrink-0 w-[40px] h-[32px] flex items-center justify-center rounded-[8px] text-[16px] transition-colors"
            style={{
              background: activeCategory === idx ? '#3A3A3C' : 'transparent',
            }}
            aria-label={cat.name}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="p-2 overflow-y-auto" style={{ maxHeight: '200px' }}>
        <div className="grid grid-cols-7 gap-[2px]">
          {CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className="w-[38px] h-[38px] flex items-center justify-center rounded-[8px] text-[22px] transition-transform hover:scale-110 active:scale-95 hover:bg-[#2C2C2E]"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
