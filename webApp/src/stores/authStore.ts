import { create } from 'zustand';
import { setUnauthorizedHandler } from '@/api/client';

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

  /** Войти (сохранить токен и пользователя) */
  login: (token: string, user: AuthUser) => void;
  /** Выйти */
  logout: () => void;
  /** Восстановить сессию из localStorage */
  restore: () => boolean;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (token, user) => {
    localStorage.setItem('son-token', token);
    localStorage.setItem('son-user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('son-token');
    localStorage.removeItem('son-user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  restore: () => {
    const token = localStorage.getItem('son-token');
    const userStr = localStorage.getItem('son-user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
}));

// Зарегистрировать обработчик 401 для API клиента
setUnauthorizedHandler(() => useAuthStore.getState().logout());
