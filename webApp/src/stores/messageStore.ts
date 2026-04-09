import { create } from 'zustand';
import type { Message } from '@/types/message';
import * as api from '@/api/client';
import type { ChatType } from '@/types/chat';
import {
  isSecretMessagePayload,
  fromSecretMessagePayload,
  toSecretMessagePayload,
  type SecretMessagePayload,
} from '@/crypto/secretTransport';
import { useAuthStore } from './authStore';
import { useSecretChatStore } from './secretChatStore';
import { useChatStore } from './chatStore';

/** Информация об ошибке дешифровки в секретном чате */
export interface DecryptError {
  chatId: string;
  error: string;
  timestamp: number;
}

interface MessageStore {
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  /** HI-37: Use Record instead of Set for Zustand serialization compatibility */
  loadedChats: Record<string, boolean>;
  fetchError: string | null;
  /** Marker-based пагинация (паттерн из MAX) */
  messageMarkers: Record<string, string | null>;
  hasMoreMessages: Record<string, boolean>;
  /**
   * ERR-3: ошибки дешифровки по чатам. Хранятся до clearDecryptErrors.
   * Используется UI для показа предупреждения о рассинхроне/возможном MITM.
   */
  decryptErrors: Record<string, DecryptError[]>;
  /** Сообщение в режиме редактирования */
  editingMessage: Message | null;

  /** Получить сообщения чата */
  getMessages: (chatId: string) => Message[];
  /** Загрузить сообщения с сервера */
  fetchMessages: (chatId: string) => Promise<void>;
  /** Загрузить старые сообщения (подгрузка при скролле вверх) */
  fetchOlderMessages: (chatId: string) => Promise<boolean>;
  /** Отправить сообщение (через API + локально) */
  sendMessage: (chatId: string, content: string, replyTo?: { id: string; senderName: string; preview: string }) => Promise<void>;
  /** Добавить входящее сообщение от сервера с E2EE-дешифровкой */
  addServerMessage: (rawMessage: Record<string, unknown>) => Promise<void>;
  /** Добавить входящее сообщение (от WebSocket) */
  addMessage: (chatId: string, message: Message) => void;
  /** Удалить сообщение (через API + локально) */
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  /** Удалить сообщение локально (для WS event) */
  removeMessageLocal: (chatId: string, messageId: string) => void;
  /** Добавить реакцию (optimistic + API call) */
  addReaction: (chatId: string, messageId: string, emoji: string, userId: string, skipApi?: boolean) => void;
  /** Установить "печатает..." */
  setTyping: (chatId: string, userName: string) => void;
  /** Убрать "печатает..." */
  clearTyping: (chatId: string, userName: string) => void;
  /** Установить сообщение для редактирования */
  setEditingMessage: (message: Message) => void;
  /** Очистить редактируемое сообщение */
  clearEditingMessage: () => void;
  /** Редактировать сообщение (API + локально) */
  updateMessage: (chatId: string, messageId: string, content: string) => Promise<void>;
  /** Обновить сообщение локально (для WS event) */
  updateMessageLocal: (chatId: string, messageId: string, content: string, editedAt: string) => void;
  /**
   * ERR-3: зафиксировать ошибку дешифровки секретного сообщения.
   * Вызывается из secretChatStore.decryptReceived при Poly1305/ratchet fail.
   */
  reportDecryptError: (chatId: string, error: string) => void;
  /** Очистить все ошибки дешифровки в чате */
  clearDecryptErrors: (chatId: string) => void;
}

const SECRET_LOCKED_PREVIEW = '🔒 Зашифрованное сообщение';

function mapApiMessageBase(raw: Record<string, unknown>): Message {
  // Map reactions from API response: { "emoji": ["userId1", "userId2"] }
  const rawReactions = raw.reactions as Record<string, string[]> | undefined;
  const reactions: Record<string, string[]> = rawReactions && typeof rawReactions === 'object'
    ? rawReactions
    : {};

  return {
    id: raw.id as string,
    chatId: raw.chat_id as string,
    senderId: raw.sender_id as string,
    senderName: raw.sender_name as string || '',
    content: (raw.content as string) || '',
    type: (raw.type as Message['type']) || 'text',
    status: (raw.status as Message['status']) || 'sent',
    reactions,
    isDestroyed: false,
    selfDestructAt: raw.self_destruct_at as string | undefined,
    editedAt: raw.edited_at as string | undefined,
    createdAt: raw.created_at as string,
    // P2.3: forwarded messages
    forwardedFromId: raw.forwarded_from_id as string | undefined,
    forwardedFromChatName: raw.forwarded_from_chat_name as string | undefined,
    forwardedFromSenderName: raw.forwarded_from_sender_name as string | undefined,
    // P2.6: mentions
    mentionedUserIds: raw.mentioned_user_ids as string[] | undefined,
  };
}

function resolveChatType(chatId: string): ChatType {
  const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
  return chat?.type || 'direct';
}

function getSecretPayload(raw: Record<string, unknown>): SecretMessagePayload | null {
  const header = raw.e2ee_header;
  const payloadFromFields: unknown = {
    ciphertext: raw.content,
    nonce: raw.e2ee_nonce,
    algorithm: raw.e2ee_algorithm,
    header,
  };

  if (isSecretMessagePayload(payloadFromFields)) {
    return payloadFromFields;
  }

  if (typeof raw.content === 'string') {
    try {
      const parsed = JSON.parse(raw.content) as unknown;
      if (isSecretMessagePayload(parsed)) return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

async function decryptSecretMessage(chatId: string, payload: SecretMessagePayload): Promise<string | null> {
  const decoded = fromSecretMessagePayload(payload);
  if (!decoded) return null;
  return useSecretChatStore.getState().decryptReceived(chatId, decoded.encrypted, decoded.header);
}

async function mapServerMessage(raw: Record<string, unknown>, myUserId: string): Promise<Message> {
  const message = mapApiMessageBase(raw);
  if (resolveChatType(message.chatId) !== 'secret' || message.type !== 'text') return message;

  // Текст собственных секретных сообщений не возвращается с сервера в открытом виде.
  if (message.senderId === myUserId) {
    return { ...message, content: SECRET_LOCKED_PREVIEW };
  }

  const payload = getSecretPayload(raw);
  if (!payload) return { ...message, content: SECRET_LOCKED_PREVIEW };

  const decrypted = await decryptSecretMessage(message.chatId, payload);
  return { ...message, content: decrypted ?? SECRET_LOCKED_PREVIEW };
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: {},
  typingUsers: {},
  loadedChats: {},
  fetchError: null,
  messageMarkers: {},
  hasMoreMessages: {},
  decryptErrors: {},
  editingMessage: null,

  getMessages: (chatId) => {
    return get().messages[chatId] ?? [];
  },

  fetchMessages: async (chatId) => {
    if (get().loadedChats[chatId]) return;

    try {
      const data = await api.getMessages(chatId, { count: 50 });
      const myUserId = useAuthStore.getState().user?.id || 'user-me';
      const msgs: Message[] = [];
      for (const raw of data.messages as Array<Record<string, unknown>>) {
        msgs.push(await mapServerMessage(raw, myUserId));
      }
      set((s) => ({
        messages: { ...s.messages, [chatId]: msgs },
        loadedChats: { ...s.loadedChats, [chatId]: true },
        messageMarkers: { ...s.messageMarkers, [chatId]: data.marker ?? null },
        hasMoreMessages: { ...s.hasMoreMessages, [chatId]: data.has_more },
        fetchError: null,
      }));
    } catch (err) {
      console.error(`Failed to fetch messages for chat ${chatId}:`, err);
      set({ fetchError: `Failed to load messages for chat ${chatId}` });
    }
  },

  fetchOlderMessages: async (chatId) => {
    const { messageMarkers, hasMoreMessages } = get();
    if (!hasMoreMessages[chatId] || !messageMarkers[chatId]) return false;

    try {
      const data = await api.getMessages(chatId, { marker: messageMarkers[chatId]!, count: 50 });
      const myUserId = useAuthStore.getState().user?.id || 'user-me';
      const older: Message[] = [];
      for (const raw of data.messages as Array<Record<string, unknown>>) {
        older.push(await mapServerMessage(raw, myUserId));
      }
      set((s) => ({
        messages: { ...s.messages, [chatId]: [...older, ...(s.messages[chatId] || [])] },
        messageMarkers: { ...s.messageMarkers, [chatId]: data.marker ?? null },
        hasMoreMessages: { ...s.hasMoreMessages, [chatId]: data.has_more },
      }));
      return older.length > 0;
    } catch (err) {
      console.error(`Failed to fetch older messages for chat ${chatId}:`, err);
      return false;
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
      replyTo: replyTo ? { type: 'reply', messageId: replyTo.id, senderName: replyTo.senderName, preview: replyTo.preview } : undefined,
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

    const chatType = resolveChatType(chatId);

    // Отправить на сервер
    try {
      let requestContent = content;
      let secretPayload: api.SecretPayloadForSend | undefined;

      if (chatType === 'secret') {
        const encryptedBundle = await useSecretChatStore.getState().encryptForSend(chatId, content);
        if (!encryptedBundle) {
          throw new Error('Нет активной секретной сессии');
        }
        const payload = toSecretMessagePayload(encryptedBundle.encrypted, encryptedBundle.header);
        requestContent = payload.ciphertext;
        secretPayload = {
          nonce: payload.nonce,
          algorithm: payload.algorithm,
          header: payload.header,
        };
      }

      const serverMsg = await api.sendMessage(
        chatId,
        requestContent,
        'text',
        selfDestructSeconds,
        secretPayload,
      ) as Record<string, unknown>;
      // Заменить временное сообщение на серверное
      set((s) => ({
        messages: {
          ...s.messages,
          [chatId]: (s.messages[chatId] ?? []).map((m) =>
            m.id === tempId ? { ...m, id: serverMsg.id as string, status: 'sent' as const } : m,
          ),
        },
      }));
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
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

  addServerMessage: async (rawMessage) => {
    const myUserId = useAuthStore.getState().user?.id || 'user-me';
    const message = await mapServerMessage(rawMessage, myUserId);
    get().addMessage(message.chatId, message);
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
    // C3: сохраняем backup для rollback при ошибке
    const backup = get().messages[chatId]?.find((m) => m.id === messageId);
    // Optimistic: удалить локально сразу
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).filter((m) => m.id !== messageId),
      },
    }));
    try {
      await api.deleteMessage(chatId, messageId);
    } catch (err) {
      console.error('Ошибка удаления сообщения:', err);
      // Rollback: восстановить сообщение
      if (backup) {
        set((s) => ({
          messages: {
            ...s.messages,
            [chatId]: [...(s.messages[chatId] ?? []), backup]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
          },
        }));
      }
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

  addReaction: (chatId, messageId, emoji, userId, skipApi) => {
    // Optimistic local update
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

    // Call API (skip for incoming WS broadcasts — they are already persisted)
    if (!skipApi) {
      api.toggleReaction(chatId, messageId, emoji).catch((err) => {
        console.error('[addReaction] failed, rolling back:', err);
        // H1: rollback — инвертируем обратно
        set((s) => ({
          messages: {
            ...s.messages,
            [chatId]: (s.messages[chatId] ?? []).map((m) => {
              if (m.id !== messageId) return m;
              const current = m.reactions[emoji] ?? [];
              const hasReaction = current.includes(userId);
              const reverted = hasReaction
                ? current.filter((id) => id !== userId)
                : [...current, userId];
              return { ...m, reactions: { ...m.reactions, [emoji]: reverted } };
            }),
          },
        }));
      });
    }
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

  setEditingMessage: (message) => {
    set({ editingMessage: message });
  },

  clearEditingMessage: () => {
    set({ editingMessage: null });
  },

  updateMessage: async (chatId, messageId, content) => {
    // C4: backup для rollback
    const original = get().messages[chatId]?.find((m) => m.id === messageId);
    const oldContent = original?.content;
    const oldEditedAt = original?.editedAt;
    // Optimistic update
    const editedAt = new Date().toISOString();
    set((s) => ({
      editingMessage: null,
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).map((m) =>
          m.id === messageId ? { ...m, content, editedAt } : m,
        ),
      },
    }));
    try {
      await api.editMessage(chatId, messageId, content);
    } catch (err) {
      console.error('Ошибка редактирования сообщения:', err);
      // Rollback: восстановить оригинальный контент
      if (oldContent !== undefined) {
        set((s) => ({
          messages: {
            ...s.messages,
            [chatId]: (s.messages[chatId] ?? []).map((m) =>
              m.id === messageId ? { ...m, content: oldContent, editedAt: oldEditedAt } : m,
            ),
          },
        }));
      }
    }
  },

  updateMessageLocal: (chatId, messageId, content, editedAt) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] ?? []).map((m) =>
          m.id === messageId ? { ...m, content, editedAt } : m,
        ),
      },
    }));
  },

  reportDecryptError: (chatId, error) => {
    const entry: DecryptError = { chatId, error, timestamp: Date.now() };
    set((s) => ({
      decryptErrors: {
        ...s.decryptErrors,
        [chatId]: [...(s.decryptErrors[chatId] ?? []), entry].slice(-10),
      },
    }));
  },

  clearDecryptErrors: (chatId) => {
    set((s) => {
      const { [chatId]: _removed, ...rest } = s.decryptErrors;
      void _removed;
      return { decryptErrors: rest };
    });
  },
}));
