import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatListHeader } from '../ChatListHeader';

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'nav.chats': 'Чаты',
    };
    return map[key] || key;
  },
  getLocale: () => 'ru',
  setLocale: vi.fn(),
}));

describe('ChatListHeader (MAX redesign)', () => {
  it('отображает заголовок "Чаты"', () => {
    render(<ChatListHeader />);
    expect(screen.getByText('Чаты')).toBeInTheDocument();
  });

  it('отображает кнопку [+] для создания', () => {
    render(<ChatListHeader />);
    expect(screen.getByLabelText('Создать')).toBeInTheDocument();
  });

  it('показывает dropdown при клике на [+]', () => {
    render(<ChatListHeader />);
    fireEvent.click(screen.getByLabelText('Создать'));
    expect(screen.getByText('Создать группу')).toBeInTheDocument();
    expect(screen.getByText('Создать приватный канал')).toBeInTheDocument();
  });
});
