import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Plus, AudioLines, ArrowUp, Smile } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

/** Панель ввода сообщения в стиле iMessage Mac */
export function InputBar({ onSend, placeholder = 'iMessage' }: InputBarProps) {
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
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  const hasText = text.trim().length > 0;

  return (
    <footer
      className="flex items-end gap-2 px-3 py-2 border-t"
      style={{
        borderColor: '#38383A',
        background: '#000',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Кнопка вложений */}
      <button
        className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 mb-[3px]"
        style={{ background: '#636366' }}
        aria-label="Вложения"
      >
        <Plus size={16} color="white" />
      </button>

      {/* Поле ввода */}
      <div
        className="flex-1 flex items-end rounded-[18px] px-3 py-[6px]"
        style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
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
          className="flex-1 bg-transparent text-[15px] text-white placeholder-[#8E8E93] outline-none resize-none leading-[1.35]"
          style={{ maxHeight: '100px' }}
        />
      </div>

      {/* Аудио-волны / отправка */}
      {hasText ? (
        <button
          onClick={handleSend}
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 mb-[3px]"
          style={{ background: '#007AFF' }}
          aria-label="Отправить"
        >
          <ArrowUp size={16} color="white" strokeWidth={3} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center flex-shrink-0 mb-[3px]"
          aria-label="Голосовое сообщение"
        >
          <AudioLines size={20} color="#8E8E93" />
        </button>
      )}

      {/* Эмодзи */}
      <button
        className="flex items-center justify-center flex-shrink-0 mb-[3px]"
        aria-label="Эмодзи"
      >
        <Smile size={20} color="#8E8E93" />
      </button>
    </footer>
  );
}
