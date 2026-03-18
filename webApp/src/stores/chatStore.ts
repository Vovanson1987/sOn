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
  filteredChats: () => Chat[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
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

  filteredChats: () => {
    const { chats, searchQuery, filter } = get();
    let result = chats;

    if (filter === 'unread') result = result.filter((c) => c.unreadCount > 0);
    else if (filter === 'groups') result = result.filter((c) => c.type === 'group');
    else if (filter === 'secret') result = result.filter((c) => c.type === 'secret');
    else if (filter === 'archived') result = result.filter((c) => c.isArchived);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name?.toLowerCase().includes(q) ?? false) ||
          c.members.some((m) => m.displayName.toLowerCase().includes(q)),
      );
    }

    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },
}));
