import { create } from 'zustand';
import type { Chat } from '@/types/chat';
import { mockChats } from '@mocks/contacts';

type ChatFilter = 'all' | 'unread' | 'groups' | 'secret' | 'archived';

interface ChatStore {
  chats: Chat[];
  activeChatId: string | null;
  searchQuery: string;
  filter: ChatFilter;
  setActiveChat: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFilter: (f: ChatFilter) => void;
  deleteChat: (id: string) => void;
  markAsRead: (chatId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: mockChats,
  activeChatId: null,
  searchQuery: '',
  filter: 'all',

  setActiveChat: (id) => set({ activeChatId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),

  deleteChat: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id) })),

  markAsRead: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    })),
}));
