import { useEffect, useRef } from 'react';
import { useMessageStore } from '@stores/messageStore';
import { useAuthStore } from '@stores/authStore';
import type { Chat } from '@/types/chat';

/** Пул автоответов */
const AUTO_REPLIES = [
  'Ок',
  'Хорошо, принял',
  '👍',
  'Понял, спасибо!',
  'Перезвоню позже',
  'Сейчас занят',
  'Да, всё верно',
  'Нет, давай обсудим завтра',
];

/**
 * Хук для имитации автоответов собеседника.
 * Через 1-3 сек после отправки показывает "печатает...",
 * затем через 1-2 сек отправляет случайный ответ.
 */
export function useAutoReply(chat: Chat) {
  const messages = useMessageStore((s) => s.messages[chat.id] ?? []);
  const addMessage = useMessageStore((s) => s.addMessage);
  const setTyping = useMessageStore((s) => s.setTyping);
  const clearTyping = useMessageStore((s) => s.clearTyping);
  const myUserId = useAuthStore((s) => s.user?.id) || 'user-me';
  const prevLengthRef = useRef(messages.length);

  const other = chat.members.find((m) => m.id !== myUserId);
  const otherName = other?.displayName ?? 'Собеседник';
  const otherId = other?.id ?? 'user-unknown';

  useEffect(() => {
    // Реагировать только на новые исходящие сообщения
    if (messages.length <= prevLengthRef.current) {
      prevLengthRef.current = messages.length;
      return;
    }
    prevLengthRef.current = messages.length;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.senderId !== myUserId || lastMsg.type === 'system') return;

    // Не отвечать в секретных чатах с самоуничтожением и для спама
    if (chat.id === 'chat-900') return;

    const replyDelay = 1000 + Math.random() * 2000; // 1-3 сек
    const typingDuration = 1000 + Math.random() * 1000; // 1-2 сек

    const typingTimer = setTimeout(() => {
      setTyping(chat.id, otherName);
    }, replyDelay);

    const replyTimer = setTimeout(() => {
      clearTyping(chat.id, otherName);
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      addMessage(chat.id, {
        id: `msg-auto-${Date.now()}`,
        chatId: chat.id,
        senderId: otherId,
        senderName: otherName,
        content: reply,
        type: 'text',
        status: 'delivered',
        reactions: {},
        isDestroyed: false,
        createdAt: new Date().toISOString(),
      });
    }, replyDelay + typingDuration);

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(replyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, chat.id, otherName, otherId, addMessage, setTyping, clearTyping]);
}
