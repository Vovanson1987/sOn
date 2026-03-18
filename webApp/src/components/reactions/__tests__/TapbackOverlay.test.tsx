import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TapbackOverlay } from '../TapbackOverlay';
import type { Message } from '@/types/message';

const mockMsg: Message = {
  id: 'msg-1', chatId: 'chat-1', senderId: 'user-2', senderName: 'Vladimir',
  content: 'Тестовое сообщение', type: 'text', status: 'read',
  reactions: {}, isDestroyed: false, createdAt: '2026-03-18T10:00:00Z',
};

describe('TapbackOverlay', () => {
  const defaultProps = {
    message: mockMsg,
    isOwn: false,
    onReact: vi.fn(),
    onReply: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };

  it('отображает текст сообщения', () => {
    render(<TapbackOverlay {...defaultProps} />);
    expect(screen.getByText('Тестовое сообщение')).toBeInTheDocument();
  });

  it('отображает 6 реакций', () => {
    render(<TapbackOverlay {...defaultProps} />);
    expect(screen.getByLabelText('Реакция ❤️')).toBeInTheDocument();
    expect(screen.getByLabelText('Реакция 👍')).toBeInTheDocument();
    expect(screen.getByLabelText('Реакция 👎')).toBeInTheDocument();
    expect(screen.getByLabelText('Реакция 😂')).toBeInTheDocument();
    expect(screen.getByLabelText('Реакция ‼️')).toBeInTheDocument();
    expect(screen.getByLabelText('Реакция ❓')).toBeInTheDocument();
  });

  it('вызывает onReact при клике на реакцию', () => {
    const onReact = vi.fn();
    render(<TapbackOverlay {...defaultProps} onReact={onReact} />);
    fireEvent.click(screen.getByLabelText('Реакция ❤️'));
    expect(onReact).toHaveBeenCalledWith('❤️');
  });

  it('отображает пункты контекстного меню', () => {
    render(<TapbackOverlay {...defaultProps} />);
    expect(screen.getByText('Ответить')).toBeInTheDocument();
    expect(screen.getByText('Копировать')).toBeInTheDocument();
    expect(screen.getByText('Удалить')).toBeInTheDocument();
  });

  it('вызывает onReply при клике на "Ответить"', () => {
    const onReply = vi.fn();
    render(<TapbackOverlay {...defaultProps} onReply={onReply} />);
    fireEvent.click(screen.getByText('Ответить'));
    expect(onReply).toHaveBeenCalled();
  });

  it('вызывает onCopy при клике на "Копировать"', () => {
    const onCopy = vi.fn();
    render(<TapbackOverlay {...defaultProps} onCopy={onCopy} />);
    fireEvent.click(screen.getByText('Копировать'));
    expect(onCopy).toHaveBeenCalled();
  });

  it('вызывает onDelete при клике на "Удалить"', () => {
    const onDelete = vi.fn();
    render(<TapbackOverlay {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Удалить'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('вызывает onClose при клике на фон', () => {
    const onClose = vi.fn();
    const { container } = render(<TapbackOverlay {...defaultProps} onClose={onClose} />);
    const backdrop = container.querySelector('[role="dialog"]');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('"Удалить" отображается красным', () => {
    render(<TapbackOverlay {...defaultProps} />);
    const deleteBtn = screen.getByText('Удалить');
    expect(deleteBtn).toHaveStyle({ color: '#FF3B30' });
  });
});
