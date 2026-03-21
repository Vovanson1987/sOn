import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../chatStore';

// Мок API клиента
vi.mock('@/api/client', () => ({
  getToken: vi.fn(() => 'test-token'),
  getChats: vi.fn(() => Promise.resolve({
    chats: [
      {
        id: 'chat-1', type: 'direct', name: null, unread_count: 3,
        members: [{ id: 'u1', display_name: 'Тест', avatar_url: null, is_online: true }],
        last_message: { content: 'Привет', created_at: '2026-01-01T00:00:00Z', sender_id: 'u1' },
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'chat-2', type: 'group', name: 'Семья', unread_count: 0,
        members: [
          { id: 'u1', display_name: 'Мама', avatar_url: null, is_online: false },
          { id: 'u2', display_name: 'Папа', avatar_url: null, is_online: true },
        ],
        last_message: null,
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'chat-3', type: 'secret', name: 'Секретный', unread_count: 1,
        members: [{ id: 'u3', display_name: 'Алексей', avatar_url: null, is_online: false }],
        last_message: { content: 'Секрет', created_at: '2026-01-03T00:00:00Z', sender_id: 'u3' },
        created_at: '2026-01-03T00:00:00Z',
      },
    ],
  })),
  createChat: vi.fn(() => Promise.resolve({
    chat: { id: 'chat-new', type: 'direct', name: null, members: [], created_at: '2026-01-04T00:00:00Z' },
  })),
  deleteChat: vi.fn(() => Promise.resolve({})),
  markChatAsRead: vi.fn(() => Promise.resolve({})),
}));

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      chats: [],
      activeChatId: null,
      searchQuery: '',
      filter: 'all',
      isLoading: false,
      isOnline: false,
    });
  });

  it('начинает с пустого списка чатов', () => {
    expect(useChatStore.getState().chats).toHaveLength(0);
  });

  it('setActiveChat устанавливает активный чат', () => {
    useChatStore.getState().setActiveChat('chat-1');
    expect(useChatStore.getState().activeChatId).toBe('chat-1');
  });

  it('setActiveChat(null) очищает выбор', () => {
    useChatStore.getState().setActiveChat('chat-1');
    useChatStore.getState().setActiveChat(null);
    expect(useChatStore.getState().activeChatId).toBeNull();
  });

  it('setSearchQuery обновляет поиск', () => {
    useChatStore.getState().setSearchQuery('Алексей');
    expect(useChatStore.getState().searchQuery).toBe('Алексей');
  });

  it('setFilter обновляет фильтр', () => {
    useChatStore.getState().setFilter('unread');
    expect(useChatStore.getState().filter).toBe('unread');
  });

  it('fetchChats загружает чаты с сервера', async () => {
    await useChatStore.getState().fetchChats();
    const { chats, isOnline } = useChatStore.getState();
    expect(chats).toHaveLength(3);
    expect(isOnline).toBe(true);
    expect(chats[0].id).toBe('chat-1');
    expect(chats[0].unreadCount).toBe(3);
    expect(chats[0].lastMessage?.content).toBe('Привет');
  });

  it('fetchChats маппит участников', async () => {
    await useChatStore.getState().fetchChats();
    const group = useChatStore.getState().chats.find(c => c.id === 'chat-2');
    expect(group?.members).toHaveLength(2);
    expect(group?.members[0].displayName).toBe('Мама');
  });

  it('deleteChat удаляет чат', async () => {
    await useChatStore.getState().fetchChats();
    useChatStore.getState().deleteChat('chat-1');
    expect(useChatStore.getState().chats).toHaveLength(2);
    expect(useChatStore.getState().chats.find(c => c.id === 'chat-1')).toBeUndefined();
  });

  it('markAsRead сбрасывает счётчик', async () => {
    await useChatStore.getState().fetchChats();
    useChatStore.getState().markAsRead('chat-1');
    const chat = useChatStore.getState().chats.find(c => c.id === 'chat-1');
    expect(chat?.unreadCount).toBe(0);
  });

  it('addChat добавляет чат в начало', () => {
    useChatStore.getState().addChat({
      id: 'chat-new', type: 'direct', name: 'Новый', members: [],
      unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(useChatStore.getState().chats[0].id).toBe('chat-new');
  });

  it('addChat не дублирует существующий чат', () => {
    const chat = {
      id: 'chat-dup', type: 'direct' as const, name: 'Dup', members: [],
      unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-01-01T00:00:00Z',
    };
    useChatStore.getState().addChat(chat);
    useChatStore.getState().addChat(chat);
    expect(useChatStore.getState().chats.filter(c => c.id === 'chat-dup')).toHaveLength(1);
  });

  it('createChat создаёт чат и добавляет в список', async () => {
    const id = await useChatStore.getState().createChat(['u2']);
    expect(id).toBe('chat-new');
    expect(useChatStore.getState().chats[0].id).toBe('chat-new');
  });

  describe('данные для фильтрации', () => {
    beforeEach(async () => {
      await useChatStore.getState().fetchChats();
    });

    it('содержит непрочитанные чаты', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter(c => c.unreadCount > 0).length).toBeGreaterThan(0);
    });

    it('содержит групповые чаты', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter(c => c.type === 'group')).toHaveLength(1);
    });

    it('содержит секретные чаты', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter(c => c.type === 'secret')).toHaveLength(1);
    });

    it('нет архивированных по умолчанию', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter(c => c.isArchived)).toHaveLength(0);
    });
  });
});
