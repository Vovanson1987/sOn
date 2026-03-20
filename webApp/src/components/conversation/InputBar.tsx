import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { Plus, AudioLines, ArrowUp, Smile } from 'lucide-react';
import { AttachmentPicker } from '@components/media/AttachmentPicker';
import { sendWS } from '@/api/client';

interface InputBarProps {
  onSend: (text: string) => void;
  onAttachment?: (type: 'camera' | 'photo' | 'document' | 'location') => void;
  placeholder?: string;
  chatId?: string;
}

/** Панель ввода сообщения в стиле iMessage Mac */
export function InputBar({ onSend, onAttachment, placeholder = 'iMessage', chatId }: InputBarProps) {
  const [text, setText] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isTypingRef = useRef(false);

  // ME-16: Очистить таймер typing при размонтировании
  useEffect(() => {
    return () => {
      if (isTypingRef.current && chatId) {
        sendWS({ type: 'stop_typing', chat_id: chatId });
      }
      clearTimeout(typingTimeoutRef.current);
    };
  }, [chatId]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // ME-16: Остановить typing при отправке
    if (isTypingRef.current && chatId) {
      sendWS({ type: 'stop_typing', chat_id: chatId });
      isTypingRef.current = false;
      clearTimeout(typingTimeoutRef.current);
    }
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend, chatId]);

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
        onClick={() => setShowAttachments(true)}
        className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 mb-[1px]"
        style={{ background: '#636366' }}
        aria-label="Вложения"
      >
        <Plus size={18} color="white" />
      </button>

      {/* Picker вложений */}
      <AttachmentPicker
        isOpen={showAttachments}
        onClose={() => setShowAttachments(false)}
        onSelect={(type) => { setShowAttachments(false); onAttachment?.(type); }}
      />

      {/* Поле ввода */}
      <div
        className="flex-1 flex items-end rounded-[18px] px-3 py-[6px]"
        style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // ME-16: Отправить typing event
            if (chatId && e.target.value.trim()) {
              if (!isTypingRef.current) {
                sendWS({ type: 'typing', chat_id: chatId });
                isTypingRef.current = true;
              }
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => {
                sendWS({ type: 'stop_typing', chat_id: chatId });
                isTypingRef.current = false;
              }, 3000);
            } else if (chatId && isTypingRef.current) {
              sendWS({ type: 'stop_typing', chat_id: chatId });
              isTypingRef.current = false;
              clearTimeout(typingTimeoutRef.current);
            }
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          rows={1}
          aria-label="Написать сообщение"
          className="flex-1 bg-transparent text-[17px] text-white placeholder-[#ABABAF] outline-none resize-none leading-[1.3] focus:ring-1 focus:ring-[#007AFF] focus:rounded-[4px]"
          style={{ maxHeight: '100px' }}
        />
      </div>

      {/* Аудио-волны / отправка */}
      {hasText ? (
        <button
          onClick={handleSend}
          className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 mb-[1px]"
          style={{ background: '#007AFF' }}
          aria-label="Отправить"
        >
          <ArrowUp size={18} color="white" strokeWidth={3} />
        </button>
      ) : (
        <button
          className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0"
          aria-label="Голосовое сообщение"
        >
          <AudioLines size={22} color="#8E8E93" />
        </button>
      )}

      {/* Эмодзи */}
      <button
        className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0"
        aria-label="Эмодзи"
      >
        <Smile size={22} color="#8E8E93" />
      </button>
    </footer>
  );
}
