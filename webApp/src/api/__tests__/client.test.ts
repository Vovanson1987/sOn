import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToken, setToken, removeToken, register, login, getChats, getMessages, sendMessage, searchUsers, onWS } from '../client';

// Мок localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Мок fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('API client — токен', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('getToken возвращает null без токена', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken сохраняет токен', () => {
    setToken('test-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('son-token', 'test-token');
  });

  it('getToken возвращает сохранённый токен', () => {
    localStorageMock.setItem('son-token', 'my-token');
    expect(getToken()).toBe('my-token');
  });

  it('removeToken удаляет токен', () => {
    removeToken();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('son-token');
  });
});

describe('API client — HTTP запросы', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('register отправляет POST /api/auth/register', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 't', user: { id: '1', email: 'e', display_name: 'n' } }),
    });

    const result = await register('test@test.com', 'Тест', 'pass123');
    expect(result.token).toBe('t');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('login отправляет POST /api/auth/login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 't', user: { id: '1', email: 'e', display_name: 'n' } }),
    });

    const result = await login('test@test.com', 'pass123');
    expect(result.token).toBe('t');
  });

  it('getChats отправляет GET /api/chats', async () => {
    localStorageMock.setItem('son-token', 'jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ chats: [] }),
    });

    const result = await getChats();
    expect(result.chats).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chats'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt' }),
      }),
    );
  });

  it('getMessages отправляет GET /api/chats/:id/messages', async () => {
    localStorageMock.setItem('son-token', 'jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    });

    await getMessages('chat-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chats/chat-1/messages'),
      expect.anything(),
    );
  });

  it('sendMessage отправляет POST с контентом', async () => {
    localStorageMock.setItem('son-token', 'jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-1' }),
    });

    await sendMessage('chat-1', 'Привет');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.content).toBe('Привет');
    expect(body.type).toBe('text');
  });

  it('searchUsers передаёт query в URL', async () => {
    localStorageMock.setItem('son-token', 'jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ users: [] }),
    });

    await searchUsers('Алексей');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/search?q=%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B5%D0%B9'),
      expect.anything(),
    );
  });

  it('бросает ошибку при !res.ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Неверный пароль' }),
    });

    await expect(login('e', 'p')).rejects.toThrow('Неверный пароль');
  });

  it('бросает HTTP ошибку при невалидном JSON в ответе ошибки', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
    });

    await expect(login('e', 'p')).rejects.toThrow('Ошибка сервера');
  });
});

describe('API client — WebSocket подписки', () => {
  it('onWS подписывает и отписывает', () => {
    const callback = vi.fn();
    const unsubscribe = onWS(callback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
