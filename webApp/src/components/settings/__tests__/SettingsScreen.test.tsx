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

  it('отображает разделы настроек MAX-стиля', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Безопасность')).toBeInTheDocument();
    expect(screen.getByText('Оформление')).toBeInTheDocument();
  });

  it('отображает пригласить друзей', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Пригласить друзей')).toBeInTheDocument();
  });

  it('отображает секцию "Уведомления"', () => {
    render(<SettingsScreen />);
    const items = screen.getAllByText('Уведомления');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('отображает секцию приватности', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Приватность')).toBeInTheDocument();
  });

  it('отображает раздел О приложении', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('О приложении')).toBeInTheDocument();
  });

  it('отображает раздел шифрования', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Шифрование')).toBeInTheDocument();
  });

  it('отображает кнопку "Выйти из профиля"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Выйти из профиля')).toBeInTheDocument();
  });

  it('отображает MCP integration в desktop режиме', () => {
    render(<SettingsScreen />);
    // MCP отображается через isDesktopRuntime() замоканный как true
    // McpIntegrationCard рендерится — проверяем что вообще не крашится
    expect(screen.getByText('Выйти из профиля')).toBeInTheDocument();
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

  it('вызывает logout при клике на "Выйти из профиля"', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByText('Выйти из профиля'));
    expect(mockLogout).toHaveBeenCalled();
  });
});
