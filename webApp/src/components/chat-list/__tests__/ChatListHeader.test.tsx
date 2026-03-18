import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatListHeader } from '../ChatListHeader';

describe('ChatListHeader', () => {
  it('renders filter button', () => {
    render(<ChatListHeader />);
    expect(screen.getByLabelText('Фильтр')).toBeInTheDocument();
  });

  it('renders new message button', () => {
    render(<ChatListHeader />);
    expect(screen.getByLabelText('Новое сообщение')).toBeInTheDocument();
  });

  it('buttons are accessible', () => {
    render(<ChatListHeader />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-label');
    });
  });
});
