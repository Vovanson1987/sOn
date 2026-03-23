/** API клиент для подключения к реальному бэкенду */

import { API_URL, WS_URL } from './config';

/** HI-18: JWT хранится в памяти, НЕ в localStorage (защита от XSS) */
let memoryToken: string | null = null;

/** Получить JWT токен (из памяти — только для WebSocket auth) */
export function getToken(): string | null {
  return memoryToken;
}

/** Сохранить JWT токен в памяти */
export function setToken(token: string): void {
  memoryToken = token;
  // Миграция: убрать из localStorage если остался
  localStorage.removeItem('son-token');
}

/** Удалить токен из памяти */
export function removeToken(): void {
  memoryToken = null;
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
        // HI-18: HTTP авторизация через httpOnly cookie (credentials: 'include').
        // Authorization header используется только как fallback для обратной совместимости.
        ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
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

/** Обновить группу (имя, описание, аватар) */
export function updateChat(chatId: string, data: { name?: string; description?: string; avatar_url?: string }) {
  return request<Record<string, unknown>>(`/api/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ==================== MESSAGES ====================

export async function getMessages(chatId: string) {
  return request<{ messages: unknown[] }>(`/api/chats/${chatId}/messages`);
}

export interface SecretPayloadForSend {
  nonce: string;
  algorithm: 'XSalsa20-Poly1305';
  header: {
    dh_public_key: string;
    previous_count: number;
    message_number: number;
  };
}

export async function sendMessage(
  chatId: string,
  content: string,
  type = 'text',
  selfDestructSeconds?: number,
  secretPayload?: SecretPayloadForSend,
) {
  return request<unknown>(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      type,
      ...(selfDestructSeconds ? { self_destruct_seconds: selfDestructSeconds } : {}),
      ...(secretPayload ? { e2ee: secretPayload } : {}),
    }),
  });
}

/** Сбросить счётчик непрочитанных */
export async function markChatAsRead(chatId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/read`, { method: 'POST' });
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
  if (ws?.readyState === WebSocket.OPEN) return;

  intentionalClose = false;

  // Подключение без токена в URL.
  // При наличии memory-token отправляем auth-сообщение.
  // Иначе сервер попробует аутентифицировать по httpOnly cookie.
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReconnectAttempt = 0; // Сброс backoff при успешном подключении
    if (token) {
      // Отправить токен в первом сообщении (безопасный способ)
      ws?.send(JSON.stringify({ type: 'auth', token }));
    }
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
    // Переподключение пока не было явного disconnect().
    // Это поддерживает сценарий cookie-auth без memory-token.
    setTimeout(connectWS, delay);
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

// ==================== PROFILE ====================

export function updateProfile(data: { display_name?: string; avatar_url?: string }) {
  return request<{ id: string; email: string; display_name: string; avatar_url: string | null }>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json() as Promise<{ avatar_url: string }>;
}

export function changePassword(current_password: string, new_password: string) {
  return request<{ ok: boolean }>('/api/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ current_password, new_password }),
  });
}

// ==================== SETTINGS ====================

export function getSettings() {
  return request<Record<string, unknown>>('/api/settings');
}

export function updateSettings(data: Record<string, unknown>) {
  return request<Record<string, unknown>>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ==================== CONTACTS ====================

export function getContacts() {
  return request<{
    contacts: Array<{
      id: string;
      nickname: string | null;
      is_favorite: boolean;
      user_id: string;
      display_name: string;
      email: string;
      avatar_url: string | null;
      is_online: boolean;
    }>;
  }>('/api/contacts');
}

export function addContact(contact_id: string, nickname?: string) {
  return request<{ id: string; user_id: string; display_name: string }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ contact_id, nickname }),
  });
}

export function deleteContact(id: string) {
  return request<undefined>(`/api/contacts/${id}`, { method: 'DELETE' });
}

export function updateContact(id: string, data: { nickname?: string; is_favorite?: boolean }) {
  return request<Record<string, unknown>>(`/api/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ==================== CALL HISTORY ====================

export interface CallHistoryEntry {
  id: string;
  chat_id: string | null;
  caller_id: string;
  callee_id: string;
  is_video: boolean;
  status: 'missed' | 'answered' | 'declined' | 'no_answer';
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
  caller_name: string;
  caller_avatar: string | null;
  callee_name: string;
  callee_avatar: string | null;
}

export function getCallHistory() {
  return request<{ calls: CallHistoryEntry[] }>('/api/calls/history');
}

export function logCall(data: {
  chat_id?: string;
  callee_id: string;
  is_video?: boolean;
  status?: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
}) {
  return request<{ call: CallHistoryEntry }>('/api/calls/log', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== MESSAGE SEARCH ====================

export function searchMessages(q: string, chatId?: string) {
  const params = new URLSearchParams({ q });
  if (chatId) params.set('chat_id', chatId);
  return request<{ messages: Array<Record<string, unknown>> }>(`/api/messages/search?${params}`);
}

// ==================== BLOCKING ====================

export function blockUser(userId: string) {
  return request<{ ok: boolean }>(`/api/users/${userId}/block`, { method: 'POST' });
}

export function unblockUser(userId: string) {
  return request<{ ok: boolean }>(`/api/users/${userId}/block`, { method: 'DELETE' });
}

export function getBlockedUsers() {
  return request<{ blocked: Array<{ id: string; blocked_id: string; display_name: string; email: string; avatar_url: string | null; created_at: string }> }>('/api/users/blocked');
}

// ==================== REACTIONS ====================

export function toggleReaction(chatId: string, messageId: string, emoji: string) {
  return request<{ action: string; reactions: Array<{ emoji: string; user_id: string }> }>(
    `/api/chats/${chatId}/messages/${messageId}/reactions`,
    { method: 'POST', body: JSON.stringify({ emoji }) },
  );
}

// ==================== EDIT MESSAGE ====================

export function editMessage(chatId: string, messageId: string, content: string) {
  return request<Record<string, unknown>>(`/api/chats/${chatId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

// ==================== GROUP MANAGEMENT ====================

export function addGroupMember(chatId: string, user_id: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id }),
  });
}

export function removeGroupMember(chatId: string, userId: string) {
  return request<undefined>(`/api/chats/${chatId}/members/${userId}`, { method: 'DELETE' });
}
