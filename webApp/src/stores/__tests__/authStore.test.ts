import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/client', () => ({
  setUnauthorizedHandler: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('@/lib/sentry', () => ({
  setSentryUser: vi.fn(),
  initSentry: vi.fn(),
  captureException: vi.fn(),
  SentryErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

import { useAuthStore } from '../authStore';
import { setToken, removeToken, getMe } from '@/api/client';

// Мок localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('authStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isRestoring: false,
    });
  });

  it('начинает с неавторизованного состояния', () => {
    const { token, user, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  it('login сохраняет токен и пользователя в памяти', () => {
    const user = { id: 'u1', email: 'test@test.com', display_name: 'Тест' };
    useAuthStore.getState().login('jwt-token', user);

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('login кеширует ТОЛЬКО профиль в localStorage (без токена)', () => {
    const user = { id: 'u1', email: 'test@test.com', display_name: 'Тест' };
    useAuthStore.getState().login('jwt-token', user);

    expect(setToken).toHaveBeenCalledWith('jwt-token');
    // SEC-1: токен больше НЕ пишется в localStorage
    expect(localStorageMock.setItem).not.toHaveBeenCalledWith('son-token', expect.anything());
    // Профиль кешируется — он не чувствителен
    expect(localStorageMock.setItem).toHaveBeenCalledWith('son-user', JSON.stringify(user));
  });

  it('logout очищает состояние', () => {
    useAuthStore.getState().login('jwt-token', { id: 'u1', email: 'e', display_name: 'n' });
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('logout удаляет кеш профиля из localStorage', () => {
    useAuthStore.getState().login('jwt-token', { id: 'u1', email: 'e', display_name: 'n' });
    useAuthStore.getState().logout();

    expect(removeToken).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('son-user');
  });

  it('restore получает пользователя через GET /api/users/me (cookie)', async () => {
    const user = {
      id: 'u1',
      email: 'test@test.com',
      display_name: 'Тест',
      is_online: true,
    };
    (getMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce(user);

    const result = await useAuthStore.getState().restore();
    expect(result).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('u1');
    // Токен НЕ восстанавливается из localStorage
    expect(setToken).not.toHaveBeenCalled();
  });

  it('restore возвращает false и чистит localStorage при ошибке', async () => {
    (getMe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('401'));
    localStorageMock.setItem('son-user', JSON.stringify({
      id: 'u1', email: 'e', display_name: 'n',
    }));

    const result = await useAuthStore.getState().restore();
    expect(result).toBe(false);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('son-user');
  });

  it('restore возвращает false если getMe возвращает 401', async () => {
    (getMe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Сессия истекла. Войдите заново.')
    );

    const result = await useAuthStore.getState().restore();
    expect(result).toBe(false);
  });

  it('restore устанавливает isRestoring на время запроса', async () => {
    let resolvePromise: (v: unknown) => void = () => undefined;
    (getMe as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    const p = useAuthStore.getState().restore();
    expect(useAuthStore.getState().isRestoring).toBe(true);

    resolvePromise({ id: 'u1', email: 'e', display_name: 'n' });
    await p;
    expect(useAuthStore.getState().isRestoring).toBe(false);
  });
});
