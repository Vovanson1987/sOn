import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../chatStore';

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeChatId: null,
      searchQuery: '',
      filter: 'all',
    });
  });

  it('has initial mock chats loaded', () => {
    const { chats } = useChatStore.getState();
    expect(chats.length).toBe(10);
  });

  it('setActiveChat updates activeChatId', () => {
    useChatStore.getState().setActiveChat('chat-900');
    expect(useChatStore.getState().activeChatId).toBe('chat-900');
  });

  it('setActiveChat(null) clears selection', () => {
    useChatStore.getState().setActiveChat('chat-900');
    useChatStore.getState().setActiveChat(null);
    expect(useChatStore.getState().activeChatId).toBeNull();
  });

  it('setSearchQuery updates searchQuery', () => {
    useChatStore.getState().setSearchQuery('Алексей');
    expect(useChatStore.getState().searchQuery).toBe('Алексей');
  });

  it('setFilter updates filter', () => {
    useChatStore.getState().setFilter('unread');
    expect(useChatStore.getState().filter).toBe('unread');
  });

  it('deleteChat removes a chat', () => {
    const before = useChatStore.getState().chats.length;
    useChatStore.getState().deleteChat('chat-900');
    expect(useChatStore.getState().chats.length).toBe(before - 1);
    expect(useChatStore.getState().chats.find((c) => c.id === 'chat-900')).toBeUndefined();
  });

  it('markAsRead sets unreadCount to 0', () => {
    const chat = useChatStore.getState().chats.find((c) => c.id === 'chat-vladimir');
    expect(chat?.unreadCount).toBeGreaterThan(0);

    useChatStore.getState().markAsRead('chat-vladimir');
    const updated = useChatStore.getState().chats.find((c) => c.id === 'chat-vladimir');
    expect(updated?.unreadCount).toBe(0);
  });

  describe('данные для фильтрации', () => {
    it('содержит непрочитанные чаты', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter((c) => c.unreadCount > 0).length).toBeGreaterThan(0);
    });

    it('содержит групповые чаты', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter((c) => c.type === 'group').length).toBe(2);
    });

    it('содержит секретные чаты', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter((c) => c.type === 'secret').length).toBe(1);
    });

    it('нет архивированных по умолчанию', () => {
      const { chats } = useChatStore.getState();
      expect(chats.filter((c) => c.isArchived).length).toBe(0);
    });

    it('чат Алексей находится по имени', () => {
      const { chats } = useChatStore.getState();
      const found = chats.filter((c) => c.name?.toLowerCase().includes('алексей'));
      expect(found.length).toBe(1);
      expect(found[0].id).toBe('chat-secret-alexey');
    });

    it('чат MIRATORG находится по имени участника', () => {
      const { chats } = useChatStore.getState();
      const found = chats.filter((c) =>
        c.members.some((m) => m.displayName.toLowerCase().includes('miratorg')),
      );
      expect(found.length).toBe(1);
    });
  });
});
