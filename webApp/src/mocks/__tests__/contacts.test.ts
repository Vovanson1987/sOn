import { describe, it, expect } from 'vitest';
import { mockChats, users, currentUser } from '../contacts';

describe('Mock data integrity', () => {
  it('has 10 chats total', () => {
    expect(mockChats.length).toBe(10);
  });

  it('has 7 direct chats', () => {
    expect(mockChats.filter((c) => c.type === 'direct').length).toBe(7);
  });

  it('has 2 group chats', () => {
    expect(mockChats.filter((c) => c.type === 'group').length).toBe(2);
  });

  it('has 1 secret chat', () => {
    expect(mockChats.filter((c) => c.type === 'secret').length).toBe(1);
  });

  it('secret chat is verified', () => {
    const secret = mockChats.find((c) => c.type === 'secret');
    expect(secret?.isVerified).toBe(true);
    expect(secret?.selfDestruct).toBe(30);
  });

  it('all chats have at least 2 members', () => {
    mockChats.forEach((chat) => {
      expect(chat.members.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('all chats include currentUser as member', () => {
    mockChats.forEach((chat) => {
      expect(chat.members.some((m) => m.id === currentUser.id)).toBe(true);
    });
  });

  it('all chats have lastMessage', () => {
    mockChats.forEach((chat) => {
      expect(chat.lastMessage).toBeDefined();
      expect(chat.lastMessage?.content).toBeTruthy();
    });
  });

  it('all chats have valid updatedAt', () => {
    mockChats.forEach((chat) => {
      expect(new Date(chat.updatedAt).getTime()).not.toBeNaN();
    });
  });

  it('users array has correct length', () => {
    expect(users.length).toBe(11);
  });

  it('all users have unique ids', () => {
    const ids = users.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('currentUser is valid', () => {
    expect(currentUser.id).toBe('user-me');
    expect(currentUser.displayName).toBe('Владимир');
    expect(currentUser.isOnline).toBe(true);
  });

  it('some users are online', () => {
    expect(users.filter((u) => u.isOnline).length).toBeGreaterThan(0);
  });

  it('chat IDs are unique', () => {
    const ids = mockChats.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('group chats have names', () => {
    mockChats.filter((c) => c.type === 'group').forEach((c) => {
      expect(c.name).toBeTruthy();
    });
  });

  it('some chats have unread messages', () => {
    expect(mockChats.filter((c) => c.unreadCount > 0).length).toBeGreaterThan(0);
  });
});
