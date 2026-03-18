import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatListItem } from '../ChatListItem';
import type { Chat } from '@/types/chat';

const mockDirectChat: Chat = {
  id: 'chat-1',
  type: 'direct',
  members: [
    { id: 'user-me', phone: '+7900', displayName: 'Me', statusText: '', isOnline: true, lastSeenAt: '' },
    { id: 'user-2', phone: '+7901', displayName: 'Алексей', statusText: '', isOnline: true, lastSeenAt: '' },
  ],
  lastMessage: {
    id: 'msg-1', chatId: 'chat-1', senderId: 'user-2', senderName: 'Алексей',
    content: 'Привет!', type: 'text', status: 'read', reactions: {},
    isDestroyed: false, createdAt: '2026-03-18T10:00:00Z',
  },
  unreadCount: 2,
  isMuted: false,
  isArchived: false,
  updatedAt: '2026-03-18T10:00:00Z',
};

const mockSecretChat: Chat = {
  id: 'chat-secret',
  type: 'secret',
  name: 'Алексей',
  members: [
    { id: 'user-me', phone: '+7900', displayName: 'Me', statusText: '', isOnline: true, lastSeenAt: '' },
    { id: 'user-2', phone: '+7901', displayName: 'Алексей', statusText: '', isOnline: true, lastSeenAt: '' },
  ],
  lastMessage: {
    id: 'msg-2', chatId: 'chat-secret', senderId: 'user-2', senderName: 'Алексей',
    content: '🔒 Зашифрованное сообщение', type: 'text', status: 'read', reactions: {},
    isDestroyed: false, createdAt: '2026-03-18T10:15:00Z',
  },
  unreadCount: 0,
  isMuted: false,
  isArchived: false,
  isVerified: true,
  selfDestruct: 30,
  updatedAt: '2026-03-18T10:15:00Z',
};

const mockGroupChat: Chat = {
  id: 'chat-group',
  type: 'group',
  name: '💼 Работа SCIF',
  members: [
    { id: 'user-me', phone: '+7900', displayName: 'Me', statusText: '', isOnline: true, lastSeenAt: '' },
    { id: 'user-2', phone: '+7901', displayName: 'Дмитрий', statusText: '', isOnline: true, lastSeenAt: '' },
  ],
  lastMessage: {
    id: 'msg-3', chatId: 'chat-group', senderId: 'user-2', senderName: 'Дмитрий',
    content: 'Совещание перенесено', type: 'text', status: 'delivered', reactions: {},
    isDestroyed: false, createdAt: '2026-03-18T08:30:00Z',
  },
  unreadCount: 1,
  isMuted: false,
  isArchived: false,
  updatedAt: '2026-03-18T08:30:00Z',
};

describe('ChatListItem', () => {
  it('renders chat name', () => {
    render(<ChatListItem chat={mockDirectChat} isActive={false} onSelect={() => {}} />);
    expect(screen.getByText('Алексей')).toBeInTheDocument();
  });

  it('renders message preview', () => {
    render(<ChatListItem chat={mockDirectChat} isActive={false} onSelect={() => {}} />);
    expect(screen.getByText('Привет!')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<ChatListItem chat={mockDirectChat} isActive={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('listitem'));
    expect(onSelect).toHaveBeenCalledWith('chat-1');
  });

  it('shows lock icon for secret chats', () => {
    render(<ChatListItem chat={mockSecretChat} isActive={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('Секретный чат')).toBeInTheDocument();
  });

  it('does not show lock icon for direct chats', () => {
    render(<ChatListItem chat={mockDirectChat} isActive={false} onSelect={() => {}} />);
    expect(screen.queryByLabelText('Секретный чат')).not.toBeInTheDocument();
  });

  it('applies active styling when isActive is true', () => {
    render(<ChatListItem chat={mockDirectChat} isActive={true} onSelect={() => {}} />);
    const item = screen.getByRole('listitem');
    expect(item).toHaveStyle({ backgroundColor: '#007AFF' });
  });

  it('renders group chat name correctly', () => {
    render(<ChatListItem chat={mockGroupChat} isActive={false} onSelect={() => {}} />);
    expect(screen.getByText('💼 Работа SCIF')).toBeInTheDocument();
  });

  it('has accessible label with unread count', () => {
    render(<ChatListItem chat={mockDirectChat} isActive={false} onSelect={() => {}} />);
    const item = screen.getByRole('listitem');
    expect(item.getAttribute('aria-label')).toContain('2 непрочитанных');
  });

  it('has accessible label without unread when count is 0', () => {
    render(<ChatListItem chat={mockSecretChat} isActive={false} onSelect={() => {}} />);
    const item = screen.getByRole('listitem');
    expect(item.getAttribute('aria-label')).not.toContain('непрочитанных');
  });
});
