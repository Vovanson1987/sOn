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

describe('API client — токен (HI-18: в памяти)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    removeToken(); // Сбросить in-memory token
    vi.clearAllMocks();
  });

  it('getToken возвращает null без токена', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken сохраняет токен в памяти', () => {
    setToken('test-token');
    // HI-18: токен в памяти, не в localStorage
    expect(getToken()).toBe('test-token');
  });

  it('getToken возвращает сохранённый в памяти токен', () => {
    setToken('my-token');
    expect(getToken()).toBe('my-token');
  });

  it('removeToken удаляет токен из памяти', () => {
    setToken('temp');
    removeToken();
    expect(getToken()).toBeNull();
  });
});

describe('API client — HTTP запросы', () => {
  beforeEach(() => {
    localStorageMock.clear();
    removeToken();
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

  it('getChats отправляет GET /api/chats с credentials', async () => {
    setToken('jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ chats: [] }),
    });

    const result = await getChats();
    expect(result.chats).toEqual([]);
    // HI-18: Авторизация через httpOnly cookie (credentials: 'include')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chats'),
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('getMessages отправляет GET /api/chats/:id/messages', async () => {
    setToken('jwt');
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
    setToken('jwt');
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

  it('sendMessage добавляет e2ee payload для секретного чата', async () => {
    setToken('jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-1' }),
    });

    await sendMessage('chat-secret', 'CIPH', 'text', 30, {
      nonce: 'NONCE',
      algorithm: 'XSalsa20-Poly1305',
      header: {
        dh_public_key: 'AQID',
        previous_count: 2,
        message_number: 3,
      },
    });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.content).toBe('CIPH');
    expect(body.e2ee).toEqual({
      nonce: 'NONCE',
      algorithm: 'XSalsa20-Poly1305',
      header: {
        dh_public_key: 'AQID',
        previous_count: 2,
        message_number: 3,
      },
    });
    expect(body.self_destruct_seconds).toBe(30);
  });

  it('searchUsers передаёт query в URL', async () => {
    setToken('jwt');
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
