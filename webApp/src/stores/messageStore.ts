import { create } from 'zustand';
import type { Message } from '@/types/message';
import * as api from '@/api/client';
import { useAuthStore } from './authStore';
import { useSecretChatStore } from './secretChatStore';

interface MessageStore {
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  /** HI-37: Use Record instead of Set for Zustand serialization compatibility */
  loadedChats: Record<string, boolean>;
  fetchError: string | null;

  /** Получить сообщения чата */
  getMessages: (chatId: string) => Message[];
  /** Загрузить сообщения с сервера */
  fetchMessages: (chatId: string) => Promise<void>;
  /** Отправить сообщение (через API + локально) */
  sendMessage: (chatId: string, content: string, replyTo?: { id: string; senderName: string; preview: string }) => Promise<void>;
  /** Добавить входящее сообщение (от WebSocket) */
  addMessage: (chatId: string, message: Message) => void;
  /** Удалить сообщение (через API + локально) */
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  /** Удалить сообщение локально (для WS event) */
  removeMessageLocal: (chatId: string, messageId: string) => void;
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
    selfDestructAt: raw.self_destruct_at as string | undefined,
    createdAt: raw.created_at as string,
  };
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: {},
  typingUsers: {},
  loadedChats: {},
  fetchError: null,

  getMessages: (chatId) => {
    return get().messages[chatId] ?? [];
  },

  fetchMessages: async (chatId) => {
    // Не загружать повторно
    if (get().loadedChats[chatId]) return;

    try {
      const data = await api.getMessages(chatId);
      const msgs = (data.messages as Array<Record<string, unknown>>).map(mapApiMessage);
      // HI-38: Always mark chat as loaded after successful fetch (even if empty)
      set((s) => ({
        messages: { ...s.messages, [chatId]: msgs },
        loadedChats: { ...s.loadedChats, [chatId]: true },
        fetchError: null,
      }));
    } catch (err) {
      // HI-12: Log error instead of silently ignoring
      console.error(`Failed to fetch messages for chat ${chatId}:`, err);
      set({ fetchError: `Failed to load messages for chat ${chatId}` });
    }
  },

  sendMessage: async (chatId, content, replyTo) => {
    const auth = useAuthStore.getState();
    const userId = auth.user?.id || 'user-me';
    const userName = auth.user?.display_name || 'Я';

    // Уникальный ID с random-суффиксом для защиты от двойной отправки
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMsg: Message = {
      id: tempId,
      chatId,
      senderId: userId,
      senderName: userName,
      content,
      type: 'text',
      status: 'sending',
      reactions: {},
      replyTo,
      isDestroyed: false,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] ?? []), newMsg],
      },
    }));

    // ME-19: Получить self-destruct timer для секретных чатов
    const secretSession = useSecretChatStore.getState().getSession(chatId);
    const selfDestructSeconds = secretSession?.selfDestructTimer ?? undefined;

    // Отправить на сервер
    try {
      const serverMsg = await api.sendMessage(chatId, content, 'text', selfDestructSeconds) as Record<string, unknown>;
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

  deleteMessage: async (chatId, messageId) => {
    // Optimistic: удалить локально сразу
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).filter((m) => m.id !== messageId),
      },
    }));
    // CR-07: Отправить на сервер
    try {
      await api.deleteMessage(chatId, messageId);
    } catch (err) {
      console.error('Ошибка удаления сообщения:', err);
    }
  },

  removeMessageLocal: (chatId, messageId) => {
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
    // ME-15: Автоматически очистить typing через 5 сек (если stop_typing не пришёл)
    setTimeout(() => {
      get().clearTyping(chatId, userName);
    }, 5000);
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
