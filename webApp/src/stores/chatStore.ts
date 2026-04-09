import { create } from 'zustand';
import type { Chat } from '@/types/chat';
import * as api from '@/api/client';

type ChatFilter = 'all' | 'unread' | 'groups' | 'secret' | 'archived';

/** HI-19: Преобразовать данные API в формат Chat с защитой от null/undefined */
function mapApiChat(raw: Record<string, unknown>): Chat {
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
  const chatType = (raw.type as Chat['type']) || 'direct';
  const preview = chatType === 'secret'
    ? '🔒 Зашифрованное сообщение'
    : ((lastMsg?.content as string) || '');

  return {
    id: (raw.id as string) ?? '',
    type: chatType,
    status: (raw.status as Chat['status']) || 'active',
    name: raw.name as string | undefined,
    description: raw.description as string | undefined,
    members,
    unreadCount: typeof raw.unread_count === 'number' ? raw.unread_count : 0,
    isMuted: false,
    isArchived: false,
    isPublic: (raw.is_public as boolean) || false,
    link: raw.link as string | undefined,
    iconUrl: raw.icon_url as string | undefined,
    participantsCount: typeof raw.participants_count === 'number' ? raw.participants_count : members.length,
    updatedAt: (lastMsg?.created_at as string) || (raw.created_at as string) || new Date().toISOString(),
    lastMessage: lastMsg ? {
      id: 'last',
      chatId: (raw.id as string) ?? '',
      senderId: (lastMsg.sender_id as string) || '',
      senderName: '',
      content: preview,
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
  fetchError: string | null;
  /** Marker-based пагинация (паттерн из MAX) */
  nextMarker: string | null;
  hasMore: boolean;

  setActiveChat: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFilter: (f: ChatFilter) => void;
  deleteChat: (id: string) => Promise<void>;
  removeChatLocal: (id: string) => void;
  markAsRead: (chatId: string) => void;
  fetchChats: () => Promise<void>;
  /** Загрузить следующую страницу чатов */
  fetchMoreChats: () => Promise<void>;
  createChat: (memberIds: string[], name?: string) => Promise<string | null>;
  addChat: (chat: Chat) => void;
  /** Покинуть чат (паттерн из MAX) */
  leaveChat: (chatId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  activeChatId: null,
  searchQuery: '',
  filter: 'all',
  isLoading: false,
  isOnline: false,
  fetchError: null,
  nextMarker: null,
  hasMore: true,

  setActiveChat: (id) => set({ activeChatId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),

  deleteChat: async (id) => {
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== id),
      activeChatId: s.activeChatId === id ? null : s.activeChatId,
    }));
    try {
      await api.deleteChat(id);
    } catch (err) {
      console.error('Ошибка удаления чата:', err);
      get().fetchChats();
    }
  },

  removeChatLocal: (id) => set((s) => ({
    chats: s.chats.filter((c) => c.id !== id),
    activeChatId: s.activeChatId === id ? null : s.activeChatId,
  })),

  markAsRead: (chatId) => {
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    }));
    api.markChatAsRead(chatId).catch((err) => console.error('[markAsRead] failed', err));
  },

  fetchChats: async () => {
    set({ isLoading: true, fetchError: null });
    try {
      const data = await api.getChats({ count: 50 });
      const apiChats = (data.chats as Array<Record<string, unknown>>).map(mapApiChat);
      set({
        chats: apiChats,
        isOnline: true,
        fetchError: null,
        nextMarker: data.marker,
        hasMore: data.marker !== null,
      });
    } catch (err) {
      console.warn('Не удалось загрузить чаты с сервера:', err);
      set({
        isOnline: false,
        fetchError: err instanceof Error ? err.message : 'Ошибка загрузки чатов',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMoreChats: async () => {
    const { nextMarker, hasMore, isLoading } = get();
    if (!hasMore || isLoading || !nextMarker) return;

    set({ isLoading: true });
    try {
      const data = await api.getChats({ marker: nextMarker, count: 50 });
      const newChats = (data.chats as Array<Record<string, unknown>>).map(mapApiChat);
      set((s) => ({
        chats: [...s.chats, ...newChats],
        nextMarker: data.marker,
        hasMore: data.marker !== null,
      }));
    } catch (err) {
      console.error('Ошибка загрузки чатов:', err);
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

  leaveChat: async (chatId) => {
    try {
      await api.leaveChat(chatId);
      set((s) => ({
        chats: s.chats.filter((c) => c.id !== chatId),
        activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
      }));
    } catch (err) {
      console.error('Ошибка выхода из чата:', err);
      throw err;
    }
  },
}));
