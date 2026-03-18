import { create } from 'zustand';
import type { Chat } from '@/types/chat';
import { mockChats } from '@mocks/contacts';
import * as api from '@/api/client';

type ChatFilter = 'all' | 'unread' | 'groups' | 'secret' | 'archived';

/** Преобразовать данные API в формат Chat */
function mapApiChat(raw: Record<string, unknown>): Chat {
  const members = (raw.members as Array<Record<string, unknown>> || []).map((m) => ({
    id: m.id as string,
    displayName: m.display_name as string,
    avatarUrl: m.avatar_url as string | undefined,
    isOnline: m.is_online as boolean || false,
  }));

  const lastMsg = raw.last_message as Record<string, unknown> | null;

  return {
    id: raw.id as string,
    type: (raw.type as Chat['type']) || 'direct',
    name: raw.name as string | undefined,
    members,
    unreadCount: (raw.unread_count as number) || 0,
    isMuted: false,
    isArchived: false,
    updatedAt: lastMsg?.created_at as string || raw.created_at as string || new Date().toISOString(),
    lastMessage: lastMsg ? {
      id: 'last',
      chatId: raw.id as string,
      senderId: lastMsg.sender_id as string || '',
      senderName: '',
      content: lastMsg.content as string || '',
      type: 'text',
      status: 'read',
      reactions: {},
      isDestroyed: false,
      createdAt: lastMsg.created_at as string || '',
    } : undefined,
  };
}

interface ChatStore {
  chats: Chat[];
  activeChatId: string | null;
  searchQuery: string;
  filter: ChatFilter;
  isLoading: boolean;
  isOnline: boolean;

  setActiveChat: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFilter: (f: ChatFilter) => void;
  deleteChat: (id: string) => void;
  markAsRead: (chatId: string) => void;
  /** Загрузить чаты с сервера */
  fetchChats: () => Promise<void>;
  /** Создать новый чат */
  createChat: (memberIds: string[], name?: string) => Promise<string | null>;
  /** Добавить чат локально (при получении через WS) */
  addChat: (chat: Chat) => void;
}

export const useChatStore = create<ChatStore>((set, _get) => ({
  chats: mockChats, // Моки как fallback пока нет чатов с сервера
  activeChatId: null,
  searchQuery: '',
  filter: 'all',
  isLoading: false,
  isOnline: false,

  setActiveChat: (id) => set({ activeChatId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),

  deleteChat: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id) })),

  markAsRead: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    })),

  fetchChats: async () => {
    const token = api.getToken();
    if (!token) return;

    set({ isLoading: true });
    try {
      const data = await api.getChats();
      const apiChats = (data.chats as Array<Record<string, unknown>>).map(mapApiChat);
      // Если есть чаты с сервера — используем их, иначе оставляем моки
      if (apiChats.length > 0) {
        set({ chats: apiChats, isOnline: true });
      } else {
        set({ isOnline: true });
      }
    } catch (err) {
      console.warn('Не удалось загрузить чаты с сервера, используем моки:', err);
      set({ isOnline: false });
    } finally {
      set({ isLoading: false });
    }
  },

  createChat: async (memberIds, name) => {
    try {
      const data = await api.createChat('direct', memberIds, name);
      const raw = data.chat as Record<string, unknown>;
      const chat = mapApiChat(raw);
      set((s) => ({ chats: [chat, ...s.chats] }));
      return chat.id;
    } catch (err) {
      console.error('Ошибка создания чата:', err);
      return null;
    }
  },

  addChat: (chat) => {
    set((s) => {
      if (s.chats.find((c) => c.id === chat.id)) return s;
      return { chats: [chat, ...s.chats] };
    });
  },
}));
