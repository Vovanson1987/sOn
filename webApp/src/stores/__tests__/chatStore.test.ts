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

  describe('filteredChats', () => {
    it('returns all chats sorted by date when filter is "all"', () => {
      const result = useChatStore.getState().filteredChats();
      expect(result.length).toBe(useChatStore.getState().chats.length);
      // First chat should be the most recent
      expect(new Date(result[0].updatedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(result[result.length - 1].updatedAt).getTime());
    });

    it('filters unread chats', () => {
      useChatStore.getState().setFilter('unread');
      const result = useChatStore.getState().filteredChats();
      expect(result.every((c) => c.unreadCount > 0)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('filters group chats', () => {
      useChatStore.getState().setFilter('groups');
      const result = useChatStore.getState().filteredChats();
      expect(result.every((c) => c.type === 'group')).toBe(true);
      expect(result.length).toBe(2);
    });

    it('filters secret chats', () => {
      useChatStore.getState().setFilter('secret');
      const result = useChatStore.getState().filteredChats();
      expect(result.every((c) => c.type === 'secret')).toBe(true);
      expect(result.length).toBe(1);
    });

    it('filters archived chats (none by default)', () => {
      useChatStore.getState().setFilter('archived');
      const result = useChatStore.getState().filteredChats();
      expect(result.length).toBe(0);
    });

    it('searches by chat name', () => {
      useChatStore.getState().setSearchQuery('Алексей');
      const result = useChatStore.getState().filteredChats();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('chat-secret-alexey');
    });

    it('searches by member name', () => {
      useChatStore.getState().setSearchQuery('Vladimir');
      const result = useChatStore.getState().filteredChats();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('search is case-insensitive', () => {
      useChatStore.getState().setSearchQuery('miratorg');
      const result = useChatStore.getState().filteredChats();
      expect(result.length).toBe(1);
    });

    it('empty search returns all', () => {
      useChatStore.getState().setSearchQuery('   ');
      const result = useChatStore.getState().filteredChats();
      expect(result.length).toBe(useChatStore.getState().chats.length);
    });
  });
});
