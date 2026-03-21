import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('@stores/chatStore', () => {
  const state = {
    activeChatId: null,
    chats: [],
    setActiveChat: vi.fn(),
    fetchChats: vi.fn(),
    removeChatLocal: vi.fn(),
  };
  const useChatStore = Object.assign(
    vi.fn((selector: (s: typeof state) => unknown) => selector(state)),
    { getState: () => state },
  );
  return { useChatStore };
});

vi.mock('@stores/messageStore', () => {
  const state = {
    addServerMessage: vi.fn(),
    removeMessageLocal: vi.fn(),
    setTyping: vi.fn(),
    clearTyping: vi.fn(),
    messages: {},
  };
  const useMessageStore = Object.assign(
    vi.fn((selector: (s: typeof state) => unknown) => selector(state)),
    { getState: () => state },
  );
  return { useMessageStore };
});

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
      render(<MemoryRouter><App /></MemoryRouter>);
    });
    // AuthScreen загружается lazy — ждём загрузки
    // Если не авторизован, не должно быть TabBar
    expect(screen.queryByText('Чаты')).toBeNull();
  });
});
