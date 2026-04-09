import { create } from 'zustand';
import { getMe, removeToken, setToken, setUnauthorizedHandler } from '@/api/client';
import { setSentryUser } from '@/lib/sentry';

interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isRestoring: boolean;

  /** Войти (сохранить токен и пользователя) */
  login: (token: string, user: AuthUser) => void;
  /** Выйти */
  logout: () => void;
  /**
   * Восстановить сессию через cookie.
   * SEC-1: токен больше НЕ читается из localStorage.
   * Вместо этого делается GET /api/users/me с httpOnly-cookie.
   * Кеш профиля в localStorage — только для быстрого первого рендера
   * (не содержит токена, не даёт ничего атакующему через XSS).
   */
  restore: () => Promise<boolean>;
}

const USER_CACHE_KEY = 'son-user';

function loadCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch (err) {
    console.warn('[auth] loadCachedUser failed', err);
    return null;
  }
}

function saveCachedUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch (err) {
    console.warn('[auth] saveCachedUser failed (localStorage unavailable?)', err);
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isRestoring: false,

  login: (token, user) => {
    setToken(token);
    // Кешируем только профиль пользователя (без токена).
    saveCachedUser(user);
    setSentryUser({ id: user.id, email: user.email });
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    removeToken();
    saveCachedUser(null);
    setSentryUser(null);
    set({ token: null, user: null, isAuthenticated: false });
  },

  restore: async () => {
    set({ isRestoring: true });

    // Оптимистичный первый рендер из кеша профиля, если он есть.
    // Настоящая авторизация произойдёт через cookie на сервере.
    const cachedUser = loadCachedUser();

    try {
      const fresh = await getMe();
      const user: AuthUser = {
        id: fresh.id,
        email: fresh.email,
        display_name: fresh.display_name,
        avatar_url: fresh.avatar_url,
      };
      saveCachedUser(user);
      setSentryUser({ id: user.id, email: user.email });
      set({ token: null, user, isAuthenticated: true, isRestoring: false });
      return true;
    } catch {
      // 401 / network error / сервер недоступен — пользователь не
      // авторизован. Убираем всё.
      if (cachedUser) {
        saveCachedUser(null);
      }
      setSentryUser(null);
      set({ token: null, user: null, isAuthenticated: false, isRestoring: false });
      return false;
    }
  },
}));

// Зарегистрировать обработчик 401 для API клиента
setUnauthorizedHandler(() => useAuthStore.getState().logout());
