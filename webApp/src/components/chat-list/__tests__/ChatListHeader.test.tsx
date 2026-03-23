import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatListHeader } from '../ChatListHeader';

// Mock i18n to return proper Russian translations in test environment
vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'nav.chats': 'Чаты',
      'chatList.newMessage': 'Новое сообщение',
    };
    return map[key] || key;
  },
  getLocale: () => 'ru',
  setLocale: vi.fn(),
}));

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
