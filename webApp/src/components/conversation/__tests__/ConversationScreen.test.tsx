import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConversationScreen } from '../ConversationScreen';
import type { Chat } from '@/types/chat';
import type { Message } from '@/types/message';

// Моковые сообщения
const mockMessages: Message[] = [
  {
    id: 'msg-1', chatId: 'chat-1', senderId: 'u1', senderName: 'Алексей',
    content: 'Привет!', type: 'text', status: 'delivered', reactions: {},
    isDestroyed: false, createdAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'msg-2', chatId: 'chat-1', senderId: 'user-me', senderName: 'Я',
    content: 'Привет, как дела?', type: 'text', status: 'read', reactions: {},
    isDestroyed: false, createdAt: '2026-01-01T10:01:00Z',
  },
];

const mockSendMessage = vi.fn();
const mockFetchMessages = vi.fn();
const mockAddReaction = vi.fn();
const mockDeleteMessage = vi.fn();

vi.mock('@stores/messageStore', () => ({
  useMessageStore: vi.fn((selector) => {
    const state = {
      messages: { 'chat-1': mockMessages, 'secret-1': mockMessages },
      sendMessage: mockSendMessage,
      fetchMessages: mockFetchMessages,
      addReaction: mockAddReaction,
      deleteMessage: mockDeleteMessage,
      typingUsers: {},
    };
    return selector(state);
  }),
}));

vi.mock('@stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { user: { id: 'user-me', email: 'me@test.com', display_name: 'Я' } };
    return selector(state);
  }),
}));

vi.mock('@stores/secretChatStore', () => ({
  useSecretChatStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        sessions: {},
        initSession: vi.fn(),
        verifySession: vi.fn(),
        setSelfDestruct: vi.fn(),
        endSession: vi.fn(),
      };
      return selector(state);
    }),
    { getState: vi.fn(() => ({ endSession: vi.fn(), initSession: vi.fn() })) },
  ),
}));

// Мок scrollIntoView (отсутствует в jsdom)
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/api/client', () => ({
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
  sendWS: vi.fn(),
  markChatAsRead: vi.fn(() => Promise.resolve({})),
}));

const directChat: Chat = {
  id: 'chat-1',
  type: 'direct',
  name: undefined,
  members: [
    { id: 'u1', displayName: 'Алексей', isOnline: true },
    { id: 'user-me', displayName: 'Я' },
  ],
  unreadCount: 0,
  isMuted: false,
  isArchived: false,
  updatedAt: '2026-01-01T10:01:00Z',
};

const groupChat: Chat = {
  id: 'chat-1',
  type: 'group',
  name: 'Семья',
  members: [
    { id: 'u1', displayName: 'Мама' },
    { id: 'u2', displayName: 'Папа' },
    { id: 'user-me', displayName: 'Я' },
  ],
  unreadCount: 0,
  isMuted: false,
  isArchived: false,
  updatedAt: '2026-01-01T00:00:00Z',
};

const secretChat: Chat = {
  id: 'secret-1',
  type: 'secret',
  name: 'Секретный',
  members: [
    { id: 'u1', displayName: 'Алексей' },
    { id: 'user-me', displayName: 'Я' },
  ],
  unreadCount: 0,
  isMuted: false,
  isArchived: false,
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ConversationScreen — прямой чат', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отображает имя собеседника', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(screen.getByText('Алексей')).toBeTruthy();
  });

  it('отображает подтип "iMessage"', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(screen.getByText('iMessage')).toBeTruthy();
  });

  it('отображает сообщения', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(screen.getByText('Привет!')).toBeTruthy();
    expect(screen.getByText('Привет, как дела?')).toBeTruthy();
  });

  it('вызывает fetchMessages при монтировании', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(mockFetchMessages).toHaveBeenCalledWith('chat-1');
  });

  it('отображает кнопку видеозвонка', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(screen.getByLabelText('Видеозвонок')).toBeTruthy();
  });

  it('отображает поле ввода с плейсхолдером "iMessage"', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(screen.getByPlaceholderText('iMessage')).toBeTruthy();
  });

  it('не отображает кнопки секретного чата', () => {
    render(<ConversationScreen chat={directChat} onBack={mockOnBack} />);
    expect(screen.queryByLabelText('Таймер самоуничтожения')).toBeNull();
    expect(screen.queryByLabelText('Информация о шифровании')).toBeNull();
  });
});

describe('ConversationScreen — групповой чат', () => {
  it('отображает название группы', () => {
    render(<ConversationScreen chat={groupChat} onBack={vi.fn()} />);
    expect(screen.getByText('Семья')).toBeTruthy();
  });
});

describe('ConversationScreen — секретный чат', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отображает подтип "Секретный чат"', () => {
    render(<ConversationScreen chat={secretChat} onBack={vi.fn()} />);
    expect(screen.getByText('Секретный чат')).toBeTruthy();
  });

  it('отображает кнопку таймера самоуничтожения', () => {
    render(<ConversationScreen chat={secretChat} onBack={vi.fn()} />);
    expect(screen.getByLabelText('Таймер самоуничтожения')).toBeTruthy();
  });

  it('отображает кнопку информации о шифровании', () => {
    render(<ConversationScreen chat={secretChat} onBack={vi.fn()} />);
    expect(screen.getByLabelText('Информация о шифровании')).toBeTruthy();
  });

  it('показывает плейсхолдер "Секретное сообщение..."', () => {
    render(<ConversationScreen chat={secretChat} onBack={vi.fn()} />);
    expect(screen.getByPlaceholderText('Секретное сообщение...')).toBeTruthy();
  });

  it('показывает анимацию обмена ключами для нового секретного чата', () => {
    render(<ConversationScreen chat={secretChat} onBack={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Установка защищённого соединения' })).toBeTruthy();
  });
});

describe('ConversationScreen — отправка сообщения', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отправляет сообщение по вводу и Enter', async () => {
    render(<ConversationScreen chat={directChat} onBack={vi.fn()} />);
    const input = screen.getByPlaceholderText('iMessage');
    fireEvent.change(input, { target: { value: 'Тестовое сообщение' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('chat-1', 'Тестовое сообщение', undefined);
    });
  });
});
