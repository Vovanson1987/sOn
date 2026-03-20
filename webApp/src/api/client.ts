/** API клиент для подключения к реальному бэкенду */

import { API_URL, WS_URL } from './config';

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

/** Callback для обработки 401 (устанавливается из authStore) */
let onUnauthorized: (() => void) | null = null;

/** Установить обработчик 401 (вызывается из authStore при инициализации) */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/** Обработка 401: очистить токен и выбросить ошибку */
function handleUnauthorized(): never {
  removeToken();
  onUnauthorized?.();
  throw new Error('Сессия истекла. Войдите заново.');
}

/** HTTP запрос с авторизацией и таймаутом */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include', // HI-18: Send httpOnly cookies
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа от сервера');
    }
    throw err;
  }
  clearTimeout(timeoutId);
  if (res.status === 401) {
    handleUnauthorized();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
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

/** Удалить чат */
export async function deleteChat(chatId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}`, {
    method: 'DELETE',
  });
}

// ==================== MESSAGES ====================

export async function getMessages(chatId: string) {
  return request<{ messages: unknown[] }>(`/api/chats/${chatId}/messages`);
}

export async function sendMessage(chatId: string, content: string, type = 'text', selfDestructSeconds?: number) {
  return request<unknown>(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      type,
      ...(selfDestructSeconds ? { self_destruct_seconds: selfDestructSeconds } : {}),
    }),
  });
}

/** CR-07: Удалить сообщение через API */
export async function deleteMessage(chatId: string, messageId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

// ==================== E2EE KEYS ====================

/** Загрузить свой prekey bundle на сервер */
export async function uploadPreKeyBundle(bundle: {
  identity_key: string;
  signing_key: string;
  signed_prekey: string;
  signed_prekey_id: number;
  signed_prekey_signature: string;
  one_time_prekeys?: Array<{ key_id: number; public_key: string }>;
}) {
  return request<{ ok: boolean }>('/api/keys/bundle', {
    method: 'PUT',
    body: JSON.stringify(bundle),
  });
}

/** Получить prekey bundle собеседника */
export async function getPreKeyBundle(userId: string) {
  return request<{
    identity_key: string;
    signing_key: string;
    signed_prekey: string;
    signed_prekey_id: number;
    signed_prekey_signature: string;
    one_time_prekey?: string;
    one_time_prekey_id?: number;
  }>(`/api/keys/bundle/${userId}`);
}

/** Проверить количество оставшихся OPK */
export async function getPreKeyCount() {
  return request<{ remaining_one_time_prekeys: number }>('/api/keys/count');
}

// ==================== USERS ====================

export async function searchUsers(query: string) {
  return request<{ users: unknown[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

// ==================== WEBSOCKET ====================

let ws: WebSocket | null = null;
let wsListeners: Array<(data: unknown) => void> = [];
let intentionalClose = false;
let wsReconnectAttempt = 0;

/** Подключиться к WebSocket */
export function connectWS(): void {
  const token = getToken();
  if (!token || ws?.readyState === WebSocket.OPEN) return;

  intentionalClose = false;

  // Подключение без токена в URL — аутентификация через первое сообщение
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReconnectAttempt = 0; // Сброс backoff при успешном подключении
    // Отправить токен в первом сообщении (безопасный способ)
    ws?.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      // Защита от DoS: ограничение размера WS-сообщения (1 МБ)
      if (typeof event.data === 'string' && event.data.length > 1_000_000) return;
      const data = JSON.parse(event.data);
      if (data.type === 'auth_success') {
        if (import.meta.env.DEV) console.log('WebSocket аутентифицирован');
        return;
      }
      if (data.type === 'auth_error' || (data.type === 'error' && data.code === 401)) {
        handleUnauthorized();
      }
      if (data.type === 'error') {
        if (import.meta.env.DEV) console.error('WebSocket ошибка:', data.message);
        return;
      }
      wsListeners.forEach((fn) => fn(data));
    } catch {
      // Игнорируем невалидный JSON
    }
  };

  ws.onclose = () => {
    if (intentionalClose) return;
    // Exponential backoff: 3с, 6с, 12с, 24с... макс 60с
    const delay = Math.min(3000 * Math.pow(2, wsReconnectAttempt), 60000);
    wsReconnectAttempt++;
    if (import.meta.env.DEV) console.log(`WebSocket отключён, переподключение через ${delay / 1000}с...`);
    // Переподключение только если токен ещё есть (пользователь не вышел)
    if (getToken()) {
      setTimeout(connectWS, delay);
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
