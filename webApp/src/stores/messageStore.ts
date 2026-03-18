import { create } from 'zustand';
import type { Message } from '@/types/message';
import { mockMessages } from '@mocks/messages';
import * as api from '@/api/client';
import { useAuthStore } from './authStore';

interface MessageStore {
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  loadedChats: Set<string>;

  /** Получить сообщения чата */
  getMessages: (chatId: string) => Message[];
  /** Загрузить сообщения с сервера */
  fetchMessages: (chatId: string) => Promise<void>;
  /** Отправить сообщение (через API + локально) */
  sendMessage: (chatId: string, content: string) => void;
  /** Добавить входящее сообщение (от WebSocket) */
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

/** Преобразовать API-сообщение в наш формат */
function mapApiMessage(raw: Record<string, unknown>): Message {
  return {
    id: raw.id as string,
    chatId: raw.chat_id as string,
    senderId: raw.sender_id as string,
    senderName: raw.sender_name as string || '',
    content: raw.content as string,
    type: (raw.type as Message['type']) || 'text',
    status: (raw.status as Message['status']) || 'sent',
    reactions: {},
    isDestroyed: false,
    createdAt: raw.created_at as string,
  };
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: mockMessages, // Моки как fallback
  typingUsers: {},
  loadedChats: new Set(),

  getMessages: (chatId) => {
    return get().messages[chatId] ?? [];
  },

  fetchMessages: async (chatId) => {
    // Не загружать повторно
    if (get().loadedChats.has(chatId)) return;

    try {
      const data = await api.getMessages(chatId);
      const msgs = (data.messages as Array<Record<string, unknown>>).map(mapApiMessage);
      if (msgs.length > 0) {
        set((s) => ({
          messages: { ...s.messages, [chatId]: msgs },
          loadedChats: new Set([...s.loadedChats, chatId]),
        }));
      }
    } catch {
      // Если сервер недоступен — используем моки
    }
  },

  sendMessage: async (chatId, content) => {
    const auth = useAuthStore.getState();
    const userId = auth.user?.id || 'user-me';
    const userName = auth.user?.display_name || 'Я';

    // Оптимистичное добавление (сразу в UI)
    const tempId = `msg-${Date.now()}`;
    const newMsg: Message = {
      id: tempId,
      chatId,
      senderId: userId,
      senderName: userName,
      content,
      type: 'text',
      status: 'sending',
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

    // Отправить на сервер
    try {
      const serverMsg = await api.sendMessage(chatId, content) as Record<string, unknown>;
      // Заменить временное сообщение на серверное
      set((s) => ({
        messages: {
          ...s.messages,
          [chatId]: (s.messages[chatId] ?? []).map((m) =>
            m.id === tempId ? { ...m, id: serverMsg.id as string, status: 'sent' as const } : m,
          ),
        },
      }));
    } catch {
      // При ошибке — пометить как failed
      set((s) => ({
        messages: {
          ...s.messages,
          [chatId]: (s.messages[chatId] ?? []).map((m) =>
            m.id === tempId ? { ...m, status: 'failed' as const } : m,
          ),
        },
      }));
    }
  },

  addMessage: (chatId, message) => {
    set((s) => {
      // Не добавлять дубликаты
      const existing = s.messages[chatId] ?? [];
      if (existing.find((m) => m.id === message.id)) return s;
      return {
        messages: {
          ...s.messages,
          [chatId]: [...existing, message],
        },
      };
    });
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
          return { ...m, reactions: { ...m.reactions, [emoji]: updated } };
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
