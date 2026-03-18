import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Plus, Mic, ArrowUp } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

/** Панель ввода сообщения в стиле iOS Messages */
export function InputBar({ onSend, placeholder = 'Текстовое сообщение...' }: InputBarProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Максимум 5 строк (~20px на строку)
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  const hasText = text.trim().length > 0;

  return (
    <footer
      className="flex items-end gap-2 px-3 py-2 border-t"
      style={{
        borderColor: '#38383A',
        backgroundColor: '#000',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Кнопка вложений */}
      <button
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mb-[2px]"
        style={{ backgroundColor: '#636366' }}
        aria-label="Вложения"
      >
        <Plus size={18} color="white" />
      </button>

      {/* Поле ввода */}
      <div
        className="flex-1 flex items-end rounded-[18px] px-3 py-[6px]"
        style={{ backgroundColor: '#1C1C1E', border: '0.5px solid #38383A' }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          rows={1}
          aria-label="Написать сообщение"
          className="flex-1 bg-transparent text-[17px] text-white placeholder-[#8E8E93] outline-none resize-none leading-[1.3]"
          style={{ maxHeight: '100px' }}
        />
      </div>

      {/* Кнопка отправки / микрофон */}
      {hasText ? (
        <button
          onClick={handleSend}
          className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mb-[2px]"
          style={{ backgroundColor: '#007AFF' }}
          aria-label="Отправить"
        >
          <ArrowUp size={18} color="white" strokeWidth={3} />
        </button>
      ) : (
        <button
          className="w-[30px] h-[30px] flex items-center justify-center flex-shrink-0 mb-[2px]"
          aria-label="Голосовое сообщение"
        >
          <Mic size={22} color="#8E8E93" />
        </button>
      )}
    </footer>
  );
}
