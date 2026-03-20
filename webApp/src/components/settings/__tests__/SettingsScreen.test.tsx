import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsScreen } from '../SettingsScreen';

const mockLogout = vi.fn();

vi.mock('@stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: { id: 'u1', email: 'test@test.com', display_name: 'Тестов', avatar_url: null },
      logout: mockLogout,
    };
    return selector(state);
  }),
}));

vi.mock('@/api/client', () => ({
  disconnectWS: vi.fn(),
}));

describe('SettingsScreen', () => {
  it('отображает имя пользователя из authStore', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Тестов')).toBeInTheDocument();
  });

  it('отображает email пользователя', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
  });

  it('отображает секцию "Профиль"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Профиль')).toBeInTheDocument();
  });

  it('отображает секцию "Тема"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Тема')).toBeInTheDocument();
    expect(screen.getByText('Тёмная')).toBeInTheDocument();
  });

  it('отображает секцию "Уведомления"', () => {
    render(<SettingsScreen />);
    const items = screen.getAllByText('Уведомления');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('отображает секцию "Конфиденциальность"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Конфиденциальность')).toBeInTheDocument();
    expect(screen.getByText('Онлайн-статус')).toBeInTheDocument();
    expect(screen.getByText('Отчёты о прочтении')).toBeInTheDocument();
  });

  it('отображает версию приложения', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('1.0.0 (Sprint 6)')).toBeInTheDocument();
  });

  it('отображает шифрование Signal Protocol', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Signal Protocol')).toBeInTheDocument();
  });

  it('отображает кнопку "Выйти"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Выйти')).toBeInTheDocument();
  });

  it('вызывает logout при клике на "Выйти"', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByText('Выйти'));
    expect(mockLogout).toHaveBeenCalled();
  });
});
