import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewChatModal } from '../NewChatModal';

const mockSearchUsers = vi.fn();
const mockCreateChat = vi.fn();

vi.mock('@/api/client', () => ({
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
}));

vi.mock('@stores/chatStore', () => ({
  useChatStore: vi.fn((selector) => {
    const state = { createChat: mockCreateChat };
    return selector(state);
  }),
}));

describe('NewChatModal', () => {
  const mockOnClose = vi.fn();
  const mockOnChatCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateChat.mockResolvedValue('chat-new');
  });

  it('рендерит заголовок "Новый чат"', () => {
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    expect(screen.getByText('Новый чат')).toBeTruthy();
  });

  it('рендерит поле поиска с автофокусом', () => {
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    const input = screen.getByPlaceholderText('Поиск по email или имени');
    expect(input).toBeTruthy();
    expect(input).toHaveFocus();
  });

  it('показывает подсказку при коротком запросе', () => {
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    expect(screen.getByText('Введите email или имя для поиска')).toBeTruthy();
  });

  it('скрывает подсказку при вводе 2+ символов', async () => {
    mockSearchUsers.mockResolvedValue({ users: [] });
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 'te' } });
    await waitFor(() => {
      expect(screen.queryByText('Введите email или имя для поиска')).toBeNull();
    });
  });

  it('вызывает searchUsers при вводе 2+ символов', async () => {
    mockSearchUsers.mockResolvedValue({ users: [] });
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 'test' } });
    await waitFor(() => {
      expect(mockSearchUsers).toHaveBeenCalledWith('test');
    });
  });

  it('не вызывает searchUsers при вводе 1 символа', () => {
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 't' } });
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('отображает результаты поиска', async () => {
    mockSearchUsers.mockResolvedValue({
      users: [
        { id: 'u1', display_name: 'Алексей', email: 'alex@test.com', is_online: true },
        { id: 'u2', display_name: 'Мария', email: 'maria@test.com', is_online: false },
      ],
    });
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Алексей')).toBeTruthy();
      expect(screen.getByText('alex@test.com')).toBeTruthy();
      expect(screen.getByText('Мария')).toBeTruthy();
    });
  });

  it('показывает "Пользователи не найдены" при пустом результате', async () => {
    mockSearchUsers.mockResolvedValue({ users: [] });
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 'zzz' } });

    await waitFor(() => {
      expect(screen.getByText('Пользователи не найдены')).toBeTruthy();
    });
  });

  it('создаёт чат при выборе пользователя', async () => {
    mockSearchUsers.mockResolvedValue({
      users: [{ id: 'u1', display_name: 'Алексей', email: 'alex@test.com', is_online: false }],
    });
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 'alex' } });

    await waitFor(() => screen.getByText('Алексей'));
    fireEvent.click(screen.getByText('Алексей'));

    await waitFor(() => {
      expect(mockCreateChat).toHaveBeenCalledWith(['u1']);
      expect(mockOnChatCreated).toHaveBeenCalledWith('chat-new');
    });
  });

  it('закрывается по клику на бэкдроп', () => {
    const { container } = render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    // Клик по внешнему overlay
    fireEvent.click(container.firstElementChild!);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('не закрывается по клику внутри модального окна', () => {
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.click(screen.getByText('Новый чат'));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('имеет role="dialog" и aria-modal="true"', () => {
    const { container } = render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('закрывается по Escape', () => {
    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('показывает "Поиск..." во время загрузки', async () => {
    let resolveSearch: (v: unknown) => void;
    mockSearchUsers.mockReturnValue(new Promise((r) => { resolveSearch = r; }));

    render(<NewChatModal onClose={mockOnClose} onChatCreated={mockOnChatCreated} />);
    fireEvent.change(screen.getByPlaceholderText('Поиск по email или имени'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Поиск...')).toBeTruthy();
    });

    resolveSearch!({ users: [] });
    await waitFor(() => {
      expect(screen.queryByText('Поиск...')).toBeNull();
    });
  });
});
