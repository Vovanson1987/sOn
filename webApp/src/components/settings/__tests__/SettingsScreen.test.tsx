import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsScreen } from '../SettingsScreen';

// Mock i18n to return proper Russian translations in test environment
vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'settings.profile': 'Профиль',
      'settings.theme': 'Тема',
      'settings.notifications': 'Уведомления',
      'settings.privacy': 'Конфиденциальность',
      'settings.storage': 'Хранилище',
      'settings.encryption': 'Шифрование',
      'settings.about': 'О приложении',
      'settings.version': 'Версия',
    };
    return map[key] || key;
  },
  getLocale: () => 'ru' as const,
  setLocale: vi.fn(),
}));

const mockLogout = vi.fn();

vi.mock('@stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: { id: 'u1', email: 'test@test.com', display_name: 'Тестов', avatar_url: null },
      token: 'fake-token',
      logout: mockLogout,
      login: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock('@/api/client', () => ({
  disconnectWS: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  updateSettings: vi.fn().mockResolvedValue({}),
  updateProfile: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com', display_name: 'Тестов', avatar_url: null }),
  uploadAvatar: vi.fn().mockResolvedValue({ avatar_url: 'http://example.com/avatar.png' }),
  changePassword: vi.fn().mockResolvedValue({ ok: true }),
  toggleReaction: vi.fn().mockResolvedValue({ action: 'added', reactions: [] }),
}));

vi.mock('@stores/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      theme: 'dark',
      language: 'ru',
      notifications_enabled: true,
      notification_sound: 'default',
      notification_preview: 'always',
      show_online_status: 'everyone',
      read_receipts: true,
      app_lock: false,
      loaded: true,
      fetchSettings: vi.fn(),
      updateSetting: vi.fn(),
    };
    return selector(state);
  }),
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
