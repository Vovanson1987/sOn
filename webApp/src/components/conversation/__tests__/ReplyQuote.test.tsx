import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplyQuote } from '../ReplyQuote';

describe('ReplyQuote', () => {
  it('отображает имя отправителя', () => {
    render(<ReplyQuote senderName="Vladimir" preview="Привет!" onCancel={() => {}} />);
    expect(screen.getByText('Vladimir')).toBeInTheDocument();
  });

  it('отображает превью сообщения', () => {
    render(<ReplyQuote senderName="Vladimir" preview="Привет, как дела?" onCancel={() => {}} />);
    expect(screen.getByText('Привет, как дела?')).toBeInTheDocument();
  });

  it('вызывает onCancel при клике на ✕', () => {
    const onCancel = vi.fn();
    render(<ReplyQuote senderName="Vladimir" preview="Привет!" onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText('Отменить ответ'));
    expect(onCancel).toHaveBeenCalled();
  });
});
