import { create } from 'zustand';
import type { Chat } from '@/types/chat';
// Моки отключены — используем только реальные данные с сервера
import * as api from '@/api/client';

type ChatFilter = 'all' | 'unread' | 'groups' | 'secret' | 'archived';

/** HI-19: Преобразовать данные API в формат Chat с защитой от null/undefined */
function mapApiChat(raw: Record<string, unknown>): Chat {
  // Guard: ensure raw is a valid object
  if (!raw || typeof raw !== 'object') {
    throw new Error('mapApiChat: invalid API response — expected an object');
  }

  const rawMembers = raw.members;
  const members = (Array.isArray(rawMembers) ? rawMembers : [])
    .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
    .map((m) => ({
      id: (m.id as string) ?? '',
      displayName: (m.display_name as string) ?? '',
      avatarUrl: m.avatar_url as string | undefined,
      isOnline: (m.is_online as boolean) || false,
    }));

  const lastMsg = raw.last_message != null && typeof raw.last_message === 'object'
    ? (raw.last_message as Record<string, unknown>)
    : null;

  return {
    id: (raw.id as string) ?? '',
    type: (raw.type as Chat['type']) || 'direct',
    name: raw.name as string | undefined,
    members,
    unreadCount: typeof raw.unread_count === 'number' ? raw.unread_count : 0,
    isMuted: false,
    isArchived: false,
    updatedAt: (lastMsg?.created_at as string) || (raw.created_at as string) || new Date().toISOString(),
    lastMessage: lastMsg ? {
      id: 'last',
      chatId: (raw.id as string) ?? '',
      senderId: (lastMsg.sender_id as string) || '',
      senderName: '',
      content: (lastMsg.content as string) || '',
      type: 'text',
      status: 'read',
      reactions: {},
      isDestroyed: false,
      createdAt: (lastMsg.created_at as string) || '',
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
  deleteChat: (id: string) => Promise<void>;
  /** Удалить чат локально (для WS event) */
  removeChatLocal: (id: string) => void;
  markAsRead: (chatId: string) => void;
  /** Загрузить чаты с сервера */
  fetchChats: () => Promise<void>;
  /** Создать новый чат */
  createChat: (memberIds: string[], name?: string) => Promise<string | null>;
  /** Добавить чат локально (при получении через WS) */
  addChat: (chat: Chat) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [], // Реальные чаты загружаются с сервера
  activeChatId: null,
  searchQuery: '',
  filter: 'all',
  isLoading: false,
  isOnline: false,

  setActiveChat: (id) => set({ activeChatId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),

  deleteChat: async (id) => {
    // Optimistic delete
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== id),
      activeChatId: s.activeChatId === id ? null : s.activeChatId,
    }));
    try {
      await api.deleteChat(id);
    } catch (err) {
      console.error('Ошибка удаления чата:', err);
      // При ошибке — перезагрузить чаты
      get().fetchChats();
    }
  },

  removeChatLocal: (id) => set((s) => ({
    chats: s.chats.filter((c) => c.id !== id),
    activeChatId: s.activeChatId === id ? null : s.activeChatId,
  })),

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
      // Используем только реальные чаты с сервера (моки отключены)
      set({ chats: apiChats, isOnline: true });
    } catch (err) {
      console.warn('Не удалось загрузить чаты с сервера:', err);
      // При ошибке — пустой список, не моки
      set({ chats: [], isOnline: false });
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
