import { create } from 'zustand';
import type { Message } from '@/types/message';
import { mockMessages } from '@mocks/messages';

interface MessageStore {
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;

  /** Получить сообщения чата */
  getMessages: (chatId: string) => Message[];
  /** Отправить сообщение */
  sendMessage: (chatId: string, content: string) => void;
  /** Добавить входящее сообщение */
  addMessage: (chatId: string, message: Message) => void;
  /** Удалить сообщение */
  deleteMessage: (chatId: string, messageId: string) => void;
  /** Добавить реакцию */
  addReaction: (chatId: string, messageId: string, emoji: string, userId: string) => void;
  /** Установить "печатает..." */
  setTyping: (chatId: string, userName: string) => void;
  /** Убрать "печатает..." */
  clearTyping: (chatId: string, userName: string) => void;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: mockMessages,
  typingUsers: {},

  getMessages: (chatId) => {
    return get().messages[chatId] ?? [];
  },

  sendMessage: (chatId, content) => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      chatId,
      senderId: 'user-me',
      senderName: 'Владимир',
      content,
      type: 'text',
      status: 'sent',
      reactions: {},
      isDestroyed: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] ?? []), newMsg],
      },
    }));

    // Имитация доставки через 500мс
    setTimeout(() => {
      set((s) => ({
        messages: {
          ...s.messages,
          [chatId]: (s.messages[chatId] ?? []).map((m) =>
            m.id === newMsg.id ? { ...m, status: 'delivered' as const, deliveredAt: new Date().toISOString() } : m,
          ),
        },
      }));
    }, 500);
  },

  addMessage: (chatId, message) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] ?? []), message],
      },
    }));
  },

  deleteMessage: (chatId, messageId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).filter((m) => m.id !== messageId),
      },
    }));
  },

  addReaction: (chatId, messageId, emoji, userId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          const current = m.reactions[emoji] ?? [];
          const hasReaction = current.includes(userId);
          const updated = hasReaction
            ? current.filter((id) => id !== userId)
            : [...current, userId];
          return {
            ...m,
            reactions: { ...m.reactions, [emoji]: updated },
          };
        }),
      },
    }));
  },

  setTyping: (chatId, userName) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [chatId]: [...new Set([...(s.typingUsers[chatId] ?? []), userName])],
      },
    }));
  },

  clearTyping: (chatId, userName) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [chatId]: (s.typingUsers[chatId] ?? []).filter((n) => n !== userName),
      },
    }));
  },
}));
