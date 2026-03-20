/** API клиент для подключения к реальному бэкенду */

/** URL API — относительный путь, nginx проксирует на бэкенд */
const API_URL = import.meta.env.VITE_API_URL || '';
const WS_URL = import.meta.env.VITE_WS_URL || `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws`;

/** Получить JWT токен из localStorage */
export function getToken(): string | null {
  return localStorage.getItem('son-token');
}

/** Сохранить JWT токен */
export function setToken(token: string): void {
  localStorage.setItem('son-token', token);
}

/** Удалить токен (выход) */
export function removeToken(): void {
  localStorage.removeItem('son-token');
}

/** HTTP запрос с авторизацией */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ==================== AUTH ====================

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; display_name: string; avatar_url?: string };
}

export async function register(email: string, displayName: string, password: string): Promise<AuthResponse> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, display_name: displayName, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return request<{ id: string; email: string; display_name: string; avatar_url?: string; is_online: boolean }>('/api/users/me');
}

// ==================== CHATS ====================

export async function getChats() {
  return request<{ chats: unknown[] }>('/api/chats');
}

export async function createChat(type: string, memberIds: string[], name?: string) {
  return request<{ chat: unknown }>('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ type, member_ids: memberIds, name }),
  });
}

// ==================== MESSAGES ====================

export async function getMessages(chatId: string) {
  return request<{ messages: unknown[] }>(`/api/chats/${chatId}/messages`);
}

export async function sendMessage(chatId: string, content: string, type = 'text') {
  return request<unknown>(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, type }),
  });
}

// ==================== USERS ====================

export async function searchUsers(query: string) {
  return request<{ users: unknown[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

// ==================== WEBSOCKET ====================

let ws: WebSocket | null = null;
let wsListeners: Array<(data: unknown) => void> = [];
let intentionalClose = false;

/** Подключиться к WebSocket */
export function connectWS(): void {
  const token = getToken();
  if (!token || ws?.readyState === WebSocket.OPEN) return;

  intentionalClose = false;

  // Подключение без токена в URL — аутентификация через первое сообщение
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    // Отправить токен в первом сообщении (безопасный способ)
    ws?.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'auth_success') {
        console.log('🟢 WebSocket аутентифицирован');
        return;
      }
      if (data.type === 'error') {
        console.error('WebSocket ошибка:', data.message);
        return;
      }
      wsListeners.forEach((fn) => fn(data));
    } catch {
      // Игнорируем невалидный JSON
    }
  };

  ws.onclose = () => {
    if (intentionalClose) return;
    console.log('🔴 WebSocket отключён, переподключение через 3с...');
    // Переподключение только если токен ещё есть (пользователь не вышел)
    if (getToken()) {
      setTimeout(connectWS, 3000);
    }
  };
}

/** Отправить событие через WebSocket */
export function sendWS(data: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/** Подписаться на события WebSocket */
export function onWS(callback: (data: unknown) => void): () => void {
  wsListeners.push(callback);
  return () => {
    wsListeners = wsListeners.filter((fn) => fn !== callback);
  };
}

/** Отключить WebSocket */
export function disconnectWS(): void {
  intentionalClose = true;
  ws?.close();
  ws = null;
}
