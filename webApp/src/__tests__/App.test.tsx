import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';

// Моки stores
vi.mock('@stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: false,
      login: vi.fn(),
      restore: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock('@stores/chatStore', () => ({
  useChatStore: vi.fn((selector) => {
    const state = {
      activeChatId: null,
      chats: [],
      setActiveChat: vi.fn(),
      fetchChats: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock('@stores/messageStore', () => ({
  useMessageStore: vi.fn((selector) => {
    const state = { addMessage: vi.fn() };
    return selector(state);
  }),
}));

vi.mock('@stores/callStore', () => ({
  useCallStore: vi.fn((selector) => {
    const state = { activeCall: null };
    return selector(state);
  }),
}));

vi.mock('@/api/client', () => ({
  connectWS: vi.fn(),
  disconnectWS: vi.fn(),
  onWS: vi.fn(() => vi.fn()),
}));

vi.mock('@/utils/webrtc', () => ({
  handleSignaling: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('показывает AuthScreen когда не авторизован', async () => {
    await act(async () => {
      render(<App />);
    });
    // AuthScreen загружается lazy — ждём загрузки
    // Если не авторизован, не должно быть TabBar
    expect(screen.queryByText('Чаты')).toBeNull();
  });
});
