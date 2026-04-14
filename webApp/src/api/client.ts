/** API клиент для подключения к реальному бэкенду */

import { API_URL, WS_URL } from './config';

/**
 * SEC-1: JWT хранится ТОЛЬКО в памяти. Никакого fallback на localStorage —
 * иначе любой XSS получает токен и использует его 7 дней.
 * Основной механизм аутентификации — httpOnly cookie, выставляется сервером.
 * Это значение используется как дополнительный Authorization header
 * только пока текущая вкладка жива — после reload токен получается заново
 * через GET /api/users/me (cookie) в authStore.restore().
 */
let memoryToken: string | null = null;

/** Получить JWT токен из памяти (для WebSocket auth и Bearer fallback) */
export function getToken(): string | null {
  return memoryToken;
}

/** Сохранить JWT токен в памяти */
export function setToken(token: string): void {
  memoryToken = token;
}

/** Удалить токен из памяти */
export function removeToken(): void {
  memoryToken = null;
  // Чистим старое значение из localStorage для юзеров со старой версией,
  // чтобы оно не продолжало висеть после обновления приложения.
  try {
    localStorage.removeItem('son-token');
  } catch {
    // localStorage может быть недоступен (private mode, security error)
  }
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
  const token = getToken();

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

/** Получить чаты с marker-пагинацией (паттерн из MAX) */
export async function getChats(options?: { marker?: string; count?: number }) {
  const params = new URLSearchParams();
  if (options?.marker) params.set('marker', options.marker);
  if (options?.count) params.set('count', String(options.count));
  const qs = params.toString();
  return request<{ chats: unknown[]; marker: string | null }>(`/api/chats${qs ? `?${qs}` : ''}`);
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

/** Список админов чата (паттерн из MAX) */
export function getChatAdmins(chatId: string) {
  return request<{ members: unknown[] }>(`/api/chats/${chatId}/admins`);
}

/** Мой статус в чате (паттерн из MAX) */
export function getChatMembership(chatId: string) {
  return request<Record<string, unknown>>(`/api/chats/${chatId}/membership`);
}

/** Покинуть чат (паттерн из MAX) */
export function leaveChat(chatId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/members/me`, { method: 'DELETE' });
}

// ==================== MESSAGES ====================

/** Получить сообщения с marker-пагинацией (паттерн из MAX) */
export async function getMessages(chatId: string, options?: { marker?: string; count?: number }) {
  const params = new URLSearchParams();
  if (options?.marker) params.set('marker', options.marker);
  if (options?.count) params.set('count', String(options.count));
  const qs = params.toString();
  return request<{ messages: unknown[]; marker: string | null; has_more: boolean }>(
    `/api/chats/${chatId}/messages${qs ? `?${qs}` : ''}`,
  );
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
  attachment?: { url: string; fileName: string; fileSize: number; mimeType: string },
) {
  return request<unknown>(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      type,
      ...(selfDestructSeconds ? { self_destruct_seconds: selfDestructSeconds } : {}),
      ...(secretPayload ? { e2ee: secretPayload } : {}),
      ...(attachment ? { attachment } : {}),
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
// H9: generation counter предотвращает reconnect после disconnectWS
let wsGeneration = 0;

// ---- WS status: подписка для UI-индикаторов (reconnect-баннер и т.п.) ----
export type WSStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
let wsStatus: WSStatus = 'idle';
const wsStatusListeners = new Set<(s: WSStatus) => void>();
function setWSStatus(s: WSStatus) {
  if (wsStatus === s) return;
  wsStatus = s;
  wsStatusListeners.forEach((fn) => fn(s));
}
export function onWSStatus(cb: (s: WSStatus) => void): () => void {
  wsStatusListeners.add(cb);
  cb(wsStatus);
  return () => { wsStatusListeners.delete(cb); };
}
export function getWSStatus(): WSStatus { return wsStatus; }

/** Подключиться к WebSocket */
export function connectWS(): void {
  const token = getToken();
  if (ws?.readyState === WebSocket.OPEN) return;

  intentionalClose = false;
  setWSStatus(wsReconnectAttempt > 0 ? 'reconnecting' : 'connecting');

  // Подключение без токена в URL.
  // При наличии memory-token отправляем auth-сообщение.
  // Иначе сервер попробует аутентифицировать по httpOnly cookie.
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReconnectAttempt = 0; // Сброс backoff при успешном подключении
    setWSStatus('open');
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
    if (intentionalClose) {
      setWSStatus('closed');
      return;
    }
    setWSStatus('reconnecting');
    const delay = Math.min(3000 * Math.pow(2, wsReconnectAttempt), 60000);
    wsReconnectAttempt++;
    // H9: запоминаем generation на момент планирования reconnect.
    // Если disconnectWS() вызовется до срабатывания таймера,
    // generation изменится и reconnect не произойдёт.
    const gen = wsGeneration;
    if (import.meta.env.DEV) console.log(`WebSocket отключён, переподключение через ${delay / 1000}с...`);
    setTimeout(() => {
      if (intentionalClose || wsGeneration !== gen) return;
      connectWS();
    }, delay);
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
  wsGeneration++; // H9: отменить запланированные reconnect
  ws?.close();
  ws = null;
  setWSStatus('closed');
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

// ==================== P2.1: Invite Links ====================

export function createInviteLink(chatId: string, opts?: { expires_hours?: number; max_uses?: number }) {
  return request<{ id: string; token: string; expires_at: string | null; max_uses: number | null }>(`/api/chats/${chatId}/invite`, {
    method: 'POST',
    body: JSON.stringify(opts || {}),
  });
}

export function getInviteInfo(token: string) {
  return request<{ chat_name: string; chat_avatar: string | null; member_count: number }>(`/api/invite/${token}`);
}

export function joinByInvite(token: string) {
  return request<{ ok: boolean; chat_id: string }>(`/api/invite/${token}/join`, { method: 'POST' });
}

export function revokeInvite(chatId: string, inviteId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/invite/${inviteId}`, { method: 'DELETE' });
}

export function getInvites(chatId: string) {
  return request<{ invites: Array<{ id: string; token: string; expires_at: string | null; max_uses: number | null; uses_count: number }> }>(`/api/chats/${chatId}/invites`);
}

// ==================== P2.4: Pinned Messages ====================

export function pinMessage(chatId: string, messageId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/pin`, {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
}

export function unpinMessage(chatId: string) {
  return request<{ ok: boolean }>(`/api/chats/${chatId}/pin`, { method: 'DELETE' });
}

// ==================== P2.3: Forward ====================

export function forwardMessage(targetChatId: string, sourceChatId: string, sourceMessageId: string) {
  return request<Record<string, unknown>>(`/api/chats/${targetChatId}/forward`, {
    method: 'POST',
    body: JSON.stringify({ source_chat_id: sourceChatId, source_message_id: sourceMessageId }),
  });
}

// ==================== P2.6: @Mentions ====================

export function searchChatMembers(chatId: string, query: string) {
  return request<{ members: Array<{ id: string; display_name: string; avatar_url: string | null }> }>(`/api/chats/${chatId}/members/search?q=${encodeURIComponent(query)}`);
}

// ==================== P2.7: Channels ====================

export function createChannel(name: string, description?: string, is_public = true) {
  return request<Record<string, unknown>>('/api/channels', {
    method: 'POST',
    body: JSON.stringify({ name, description, is_public }),
  });
}

export function getChannels() {
  return request<{ channels: Array<Record<string, unknown>> }>('/api/channels');
}

export function getChannel(id: string) {
  return request<Record<string, unknown>>(`/api/channels/${id}`);
}

export function subscribeChannel(id: string) {
  return request<{ ok: boolean }>(`/api/channels/${id}/subscribe`, { method: 'POST' });
}

export function unsubscribeChannel(id: string) {
  return request<{ ok: boolean }>(`/api/channels/${id}/subscribe`, { method: 'DELETE' });
}

export function createChannelPost(channelId: string, content: string, type = 'text', attachment_url?: string) {
  return request<Record<string, unknown>>(`/api/channels/${channelId}/posts`, {
    method: 'POST',
    body: JSON.stringify({ content, type, attachment_url }),
  });
}

export function getChannelPosts(channelId: string, before?: string) {
  const params = before ? `?before=${encodeURIComponent(before)}` : '';
  return request<{ posts: Array<Record<string, unknown>>; has_more: boolean }>(`/api/channels/${channelId}/posts${params}`);
}

// ==================== P2.11: Stories ====================

export function createStory(media_url: string, media_type = 'image', caption?: string) {
  return request<Record<string, unknown>>('/api/stories', {
    method: 'POST',
    body: JSON.stringify({ media_url, media_type, caption }),
  });
}

export function getStories() {
  return request<{ users: Array<Record<string, unknown>> }>('/api/stories');
}

export function viewStory(storyId: string) {
  return request<{ ok: boolean }>(`/api/stories/${storyId}/view`, { method: 'POST' });
}

export function deleteStory(storyId: string) {
  return request<{ ok: boolean }>(`/api/stories/${storyId}`, { method: 'DELETE' });
}

// ==================== P2.12: LiveKit Group Calls ====================

export function getLiveKitToken(chatId: string, isVideo = false) {
  return request<{ token: string; url: string; room: string }>('/api/calls/token', {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, is_video: isVideo }),
  });
}

export function startGroupCall(chatId: string, isVideo = false) {
  return request<{ ok: boolean; room: string }>('/api/calls/group-start', {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, is_video: isVideo }),
  });
}

// ==================== P2.8: Stickers ====================

export function getStickerPacks() {
  return request<{ packs: Array<Record<string, unknown>> }>('/api/sticker-packs');
}

export function getMyStickerPacks() {
  return request<{ packs: Array<Record<string, unknown>> }>('/api/sticker-packs/my');
}

export function getStickers(packId: string) {
  return request<{ stickers: Array<{ id: string; emoji: string; file_url: string; file_type: string }> }>(`/api/sticker-packs/${packId}/stickers`);
}

export function addStickerPack(packId: string) {
  return request<{ ok: boolean }>(`/api/sticker-packs/${packId}/add`, { method: 'POST' });
}

export function removeStickerPack(packId: string) {
  return request<{ ok: boolean }>(`/api/sticker-packs/${packId}/add`, { method: 'DELETE' });
}

export function createStickerPack(name: string, description?: string, cover_url?: string) {
  return request<Record<string, unknown>>('/api/sticker-packs', {
    method: 'POST',
    body: JSON.stringify({ name, description, cover_url }),
  });
}

// ==================== P2.10: URL Preview ====================

export function getOgPreview(url: string) {
  return request<{ title: string | null; description: string | null; image: string | null; site_name: string | null; url: string }>(`/api/og?url=${encodeURIComponent(url)}`);
}
