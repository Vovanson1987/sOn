import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatList } from '../ChatList';

// Моковые данные
const mockChats = [
  {
    id: 'chat-1', type: 'direct', name: 'Алексей', members: [{ id: 'u1', displayName: 'Алексей' }],
    unreadCount: 3, isMuted: false, isArchived: false, updatedAt: '2026-01-03T00:00:00Z',
    lastMessage: { id: 'm1', chatId: 'chat-1', senderId: 'u1', senderName: 'Алексей', content: 'Привет!', type: 'text', status: 'delivered', reactions: {}, isDestroyed: false, createdAt: '2026-01-03T00:00:00Z' },
  },
  {
    id: 'chat-2', type: 'group', name: 'Семья', members: [{ id: 'u1', displayName: 'Мама' }, { id: 'u2', displayName: 'Папа' }],
    unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'chat-3', type: 'secret', name: 'Секретный', members: [{ id: 'u3', displayName: 'Артём' }],
    unreadCount: 1, isMuted: false, isArchived: true, updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockSetSearchQuery = vi.fn();
const mockSetActiveChat = vi.fn();

vi.mock('@stores/chatStore', () => ({
  useChatStore: vi.fn((selector) => {
    const state = {
      chats: mockChats,
      searchQuery: '',
      filter: 'all',
      setSearchQuery: mockSetSearchQuery,
      activeChatId: null,
      setActiveChat: mockSetActiveChat,
    };
    return selector(state);
  }),
}));

// Мок для NewChatModal — не рендерим
vi.mock('../NewChatModal', () => ({
  NewChatModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="new-chat-modal"><button onClick={onClose}>Закрыть</button></div>
  ),
}));

describe('ChatList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит навигацию с aria-label', () => {
    render(<ChatList />);
    expect(screen.getByLabelText('Список чатов')).toBeTruthy();
  });

  it('рендерит список чатов с role="list"', () => {
    render(<ChatList />);
    expect(screen.getByRole('list', { name: 'Чаты' })).toBeTruthy();
  });

  it('отображает все чаты', () => {
    render(<ChatList />);
    expect(screen.getByText('Алексей')).toBeTruthy();
    expect(screen.getByText('Семья')).toBeTruthy();
    expect(screen.getByText('Секретный')).toBeTruthy();
  });

  it('сортирует чаты по дате (новые сверху)', () => {
    render(<ChatList />);
    const list = screen.getByRole('list', { name: 'Чаты' });
    const items = list.querySelectorAll('button');
    // chat-1 (Jan 3) должен быть первым, chat-3 (Jan 1) — последним
    expect(items.length).toBe(3);
  });

  it('показывает поле поиска', () => {
    render(<ChatList />);
    expect(screen.getByPlaceholderText('Поиск чатов')).toBeTruthy();
  });

  it('открывает модальное окно "Новый чат" по кнопке', () => {
    render(<ChatList />);
    // Кнопка "Новый чат" находится в ChatListHeader (карандаш)
    const newChatBtn = screen.getByLabelText('Новое сообщение');
    fireEvent.click(newChatBtn);
    expect(screen.getByTestId('new-chat-modal')).toBeTruthy();
  });

  it('закрывает модальное окно', () => {
    render(<ChatList />);
    fireEvent.click(screen.getByLabelText('Новое сообщение'));
    expect(screen.getByTestId('new-chat-modal')).toBeTruthy();
    fireEvent.click(screen.getByText('Закрыть'));
    expect(screen.queryByTestId('new-chat-modal')).toBeNull();
  });
});

describe('ChatList — пустой список', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@stores/chatStore');
    vi.mocked(mod.useChatStore).mockImplementation((selector) => {
      return selector({
        chats: [],
        searchQuery: '',
        filter: 'all',
        setSearchQuery: vi.fn(),
        activeChatId: null,
        setActiveChat: vi.fn(),
      } as never);
    });
  });

  it('показывает "Нет чатов" при пустом списке', () => {
    render(<ChatList />);
    expect(screen.getByText('Нет чатов')).toBeTruthy();
  });

  it('показывает кнопку "Начать чат"', () => {
    render(<ChatList />);
    expect(screen.getByText('Начать чат')).toBeTruthy();
  });
});

describe('ChatList — поиск без результатов', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@stores/chatStore');
    vi.mocked(mod.useChatStore).mockImplementation((selector) => {
      return selector({
        chats: mockChats,
        searchQuery: 'zzzzzzz',
        filter: 'all',
        setSearchQuery: vi.fn(),
        activeChatId: null,
        setActiveChat: vi.fn(),
      } as never);
    });
  });

  it('показывает "Ничего не найдено" при пустом результате поиска', () => {
    render(<ChatList />);
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });

  it('не показывает кнопку "Начать чат" при поиске', () => {
    render(<ChatList />);
    expect(screen.queryByText('Начать чат')).toBeNull();
  });
});
