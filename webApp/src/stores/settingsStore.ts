import { create } from 'zustand';
import * as api from '@/api/client';

interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  language: 'ru' | 'en' | 'kz';
  notifications_enabled: boolean;
  notification_sound: string;
  notification_preview: 'always' | 'contacts' | 'never';
  show_online_status: 'everyone' | 'contacts' | 'nobody';
  read_receipts: boolean;
  app_lock: boolean;
  loaded: boolean;

  /** Загрузить настройки с сервера */
  fetchSettings: () => Promise<void>;
  /** Обновить одну настройку на сервере и в сторе */
  updateSetting: (key: string, value: unknown) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark',
  language: 'ru',
  notifications_enabled: true,
  notification_sound: 'default',
  notification_preview: 'always',
  show_online_status: 'everyone',
  read_receipts: true,
  app_lock: false,
  loaded: false,

  fetchSettings: async () => {
    try {
      const data = await api.getSettings();
      set({
        theme: (data.theme as SettingsState['theme']) || get().theme,
        language: (data.language as SettingsState['language']) || get().language,
        notifications_enabled:
          typeof data.notifications_enabled === 'boolean'
            ? data.notifications_enabled
            : get().notifications_enabled,
        notification_sound:
          (data.notification_sound as string) || get().notification_sound,
        notification_preview:
          (data.notification_preview as SettingsState['notification_preview']) ||
          get().notification_preview,
        show_online_status:
          (data.show_online_status as SettingsState['show_online_status']) ||
          get().show_online_status,
        read_receipts:
          typeof data.read_receipts === 'boolean'
            ? data.read_receipts
            : get().read_receipts,
        app_lock:
          typeof data.app_lock === 'boolean' ? data.app_lock : get().app_lock,
        loaded: true,
      });
    } catch (err) {
      console.warn('Не удалось загрузить настройки:', err);
      // Используем значения по умолчанию
      set({ loaded: true });
    }
  },

  updateSetting: async (key, value) => {
    // Optimistic update
    const prev = { ...get() };
    set({ [key]: value } as Partial<SettingsState>);
    try {
      await api.updateSettings({ [key]: value });
    } catch (err) {
      console.error('Ошибка обновления настройки:', err);
      // Откат при ошибке
      set({ [key]: (prev as Record<string, unknown>)[key] } as Partial<SettingsState>);
    }
  },
}));
