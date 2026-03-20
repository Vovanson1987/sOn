import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';

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
    });
  });

  it('начинает с неавторизованного состояния', () => {
    const { token, user, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  it('login сохраняет токен и пользователя', () => {
    const user = { id: 'u1', email: 'test@test.com', display_name: 'Тест' };
    useAuthStore.getState().login('jwt-token', user);

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('login записывает в localStorage', () => {
    const user = { id: 'u1', email: 'test@test.com', display_name: 'Тест' };
    useAuthStore.getState().login('jwt-token', user);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('son-token', 'jwt-token');
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

  it('logout удаляет из localStorage', () => {
    useAuthStore.getState().login('jwt-token', { id: 'u1', email: 'e', display_name: 'n' });
    useAuthStore.getState().logout();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('son-token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('son-user');
  });

  it('restore восстанавливает сессию из localStorage', () => {
    const user = { id: 'u1', email: 'test@test.com', display_name: 'Тест' };
    localStorageMock.setItem('son-token', 'saved-token');
    localStorageMock.setItem('son-user', JSON.stringify(user));

    const result = useAuthStore.getState().restore();
    expect(result).toBe(true);

    const state = useAuthStore.getState();
    expect(state.token).toBe('saved-token');
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('restore возвращает false без данных', () => {
    const result = useAuthStore.getState().restore();
    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('restore возвращает false при невалидном JSON', () => {
    localStorageMock.setItem('son-token', 'token');
    localStorageMock.setItem('son-user', 'not-json{');

    const result = useAuthStore.getState().restore();
    expect(result).toBe(false);
  });

  it('restore не восстанавливает если только токен без user', () => {
    localStorageMock.setItem('son-token', 'token');

    const result = useAuthStore.getState().restore();
    expect(result).toBe(false);
  });
});
