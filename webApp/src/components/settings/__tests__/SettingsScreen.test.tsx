import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
const mockSetMcpConfig = vi.fn();
const mockSetMcpLastProbe = vi.fn();
const mockResetMcpConfig = vi.fn();
const mockProbeMcpConnection = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  backend: 'claude',
  toolCount: 24,
  serverName: 'bridge',
  serverVersion: '0.2.0',
  message: 'ok',
});

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

vi.mock('@stores/mcpStore', () => ({
  useMcpStore: vi.fn((selector) => {
    const state = {
      url: 'https://chat.sonchat.uk/mcp',
      token: 'mcp-token',
      backend: 'claude',
      lastProbe: null,
      setConfig: mockSetMcpConfig,
      setLastProbe: mockSetMcpLastProbe,
      resetConfig: mockResetMcpConfig,
    };
    return selector(state);
  }),
}));

vi.mock('@/utils/desktopMcp', () => ({
  isDesktopRuntime: () => true,
  probeMcpConnection: (...args: unknown[]) => mockProbeMcpConnection(...args),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('отображает desktop секцию MCP integration', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('MCP Gateway')).toBeInTheDocument();
    expect(screen.getByText('MCP integration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://chat.sonchat.uk/mcp')).toBeInTheDocument();
  });

  it('сохраняет MCP конфиг по кнопке', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByText('Сохранить'));
    expect(mockSetMcpConfig).toHaveBeenCalledWith({
      url: 'https://chat.sonchat.uk/mcp',
      token: 'mcp-token',
      backend: 'claude',
    });
  });

  it('запускает native MCP probe по кнопке проверки', async () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByText('Проверить соединение'));

    await waitFor(() => {
      expect(mockProbeMcpConnection).toHaveBeenCalledWith({
        url: 'https://chat.sonchat.uk/mcp',
        token: 'mcp-token',
        backend: 'claude',
      });
    });

    await waitFor(() => {
      expect(mockSetMcpLastProbe).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        toolCount: 24,
        backend: 'claude',
      }));
    });
  });

  it('вызывает logout при клике на "Выйти"', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByText('Выйти'));
    expect(mockLogout).toHaveBeenCalled();
  });
});
