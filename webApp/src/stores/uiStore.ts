import { create } from 'zustand';

type Screen = 'chatList' | 'conversation' | 'settings' | 'contacts' | 'calls';

interface UIStore {
  currentScreen: Screen;
  showInfoPanel: boolean;
  theme: 'dark' | 'light' | 'system';
  navigate: (screen: Screen) => void;
  toggleInfoPanel: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'chatList',
  showInfoPanel: false,
  theme: 'dark',
  navigate: (screen) => set({ currentScreen: screen }),
  toggleInfoPanel: () => set((s) => ({ showInfoPanel: !s.showInfoPanel })),
  setTheme: (theme) => set({ theme }),
}));
