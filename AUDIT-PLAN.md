# Полный аудит и план доработки sOn Messenger

> **Дата аудита:** 2026-03-23
> **Ветка:** master
> **Домен:** chat.sonchat.uk (Cloudflare Tunnel)
> **Цель:** довести мессенджер до production-качества по всем направлениям

---

## Текущее состояние проекта

### Стек технологий

| Компонент | Технологии | Статус |
|-----------|-----------|--------|
| **Фронтенд** | React 19.2 + TypeScript 5.9 + Vite 6.4 + Zustand 4.5 + Tailwind CSS 4.2 | РАБОТАЕТ |
| **Бэкенд (рабочий)** | Node.js + Express 5.2 + PostgreSQL 16 + ws 8.19 | РАБОТАЕТ |
| **Бэкенд (заброшенный)** | Elixir/Phoenix gateway, Rust crypto-service, Go push-service | СКЕЛЕТ |
| **Хранилище файлов** | MinIO (S3-compatible) | РАБОТАЕТ |
| **PWA** | manifest.json + sw.js | МИНИМАЛЬНЫЙ |
| **Android** | Kotlin/Jetpack Compose (KMP shared module) | СКЕЛЕТ |
| **iOS** | Нет Xcode проекта | НЕ СУЩЕСТВУЕТ |

### Docker Compose конфигурации

| Файл | Сервисы | Назначение |
|------|---------|-----------|
| `docker-compose.yml` | postgres, redis, scylladb, minio, zookeeper, kafka, coturn, gateway, crypto-service, push-service, web | Полный стек (dev) с Elixir/Rust/Go — **НЕ ИСПОЛЬЗУЕТСЯ** |
| `docker-compose.prod.yml` | postgres, redis, minio, api (Node.js), web (nginx) | **РАБОЧИЙ** production стек |
| `docker-compose.local.yml` | postgres, redis, minio | Только базы для локальной разработки |

### Критический факт

Весь бэкенд — **один файл** `server/index.js` (~945 строк). Elixir gateway, Rust crypto-service и Go push-service — это **заброшенные скелеты**, не подключённые к фронтенду.

---

## Результаты аудита по областям

---

### 1. Бэкенд (server/index.js)

#### 1.1 Все HTTP эндпоинты (19 шт.)

| # | Метод | Путь | Статус | Описание |
|---|-------|------|--------|----------|
| 1 | POST | `/api/auth/register` | РАБОТАЕТ | Регистрация (email + password + display_name) |
| 2 | POST | `/api/auth/login` | РАБОТАЕТ | Вход (email + password), ставит httpOnly cookie |
| 3 | POST | `/api/auth/logout` | РАБОТАЕТ | Очистка httpOnly cookie |
| 4 | GET | `/api/users/me` | РАБОТАЕТ | Текущий пользователь |
| 5 | GET | `/api/users/search?q=` | РАБОТАЕТ | Поиск пользователей по имени/email |
| 6 | GET | `/api/chats` | РАБОТАЕТ | Список чатов пользователя с last_message |
| 7 | POST | `/api/chats` | РАБОТАЕТ | Создать чат (direct/group/secret) |
| 8 | DELETE | `/api/chats/:chatId` | РАБОТАЕТ | Удалить чат (group — только создатель) |
| 9 | GET | `/api/chats/:chatId/messages` | РАБОТАЕТ | Сообщения чата с курсорной пагинацией |
| 10 | POST | `/api/chats/:chatId/messages` | РАБОТАЕТ | Отправка сообщения (text/image/file/audio/video/system) |
| 11 | POST | `/api/chats/:chatId/read` | РАБОТАЕТ | Сброс unread_count |
| 12 | DELETE | `/api/chats/:chatId/messages/:id` | РАБОТАЕТ | Удалить своё сообщение |
| 13 | PUT | `/api/keys/bundle` | РАБОТАЕТ | Загрузить prekey bundle (E2EE) |
| 14 | GET | `/api/keys/bundle/:userId` | РАБОТАЕТ | Получить prekey bundle собеседника |
| 15 | GET | `/api/keys/count` | РАБОТАЕТ | Количество оставшихся OPK |
| 16 | POST | `/api/media/upload` | РАБОТАЕТ | Загрузка файла (multipart) → MinIO |
| 17 | POST | `/api/media/download` | РАБОТАЕТ | Pre-signed URL для скачивания |
| 18 | POST | `/api/media/upload-url` | РАБОТАЕТ | Pre-signed URL для прямой загрузки |
| 19 | GET | `/health` | РАБОТАЕТ | Health check (PostgreSQL) |

#### 1.2 Отсутствующие эндпоинты (нужны для полноценного мессенджера)

| # | Метод | Путь | Назначение | Приоритет |
|---|-------|------|-----------|-----------|
| 1 | PATCH | `/api/users/me` | Обновить профиль (display_name, avatar_url) | P0 |
| 2 | PATCH | `/api/users/me/password` | Смена пароля | P1 |
| 3 | POST | `/api/users/me/avatar` | Загрузка аватара | P0 |
| 4 | GET | `/api/contacts` | Список контактов | P0 |
| 5 | POST | `/api/contacts` | Добавить контакт | P0 |
| 6 | DELETE | `/api/contacts/:id` | Удалить контакт | P0 |
| 7 | PATCH | `/api/contacts/:id` | Изменить контакт (имя, избранное) | P1 |
| 8 | GET | `/api/users/:id/settings` | Получить настройки | P1 |
| 9 | PATCH | `/api/users/me/settings` | Обновить настройки | P1 |
| 10 | PATCH | `/api/chats/:chatId/messages/:id` | Редактирование сообщения | P1 |
| 11 | POST | `/api/chats/:chatId/messages/:id/reactions` | Добавить реакцию | P1 |
| 12 | DELETE | `/api/chats/:chatId/messages/:id/reactions/:emoji` | Удалить реакцию | P1 |
| 13 | POST | `/api/chats/:chatId/members` | Добавить участника группы | P1 |
| 14 | DELETE | `/api/chats/:chatId/members/:userId` | Удалить участника группы | P1 |
| 15 | PATCH | `/api/chats/:chatId` | Обновить группу (имя, аватар, описание) | P1 |
| 16 | GET | `/api/calls/history` | История звонков | P2 |
| 17 | POST | `/api/devices/push-token` | Регистрация push-токена | P2 |

#### 1.3 WebSocket типы сообщений

**Серверные обработчики (handleWsMessage):**

| Тип | Направление | Статус | Описание |
|-----|-------------|--------|----------|
| `auth` | клиент → сервер | РАБОТАЕТ | Аутентификация по JWT |
| `auth_success` | сервер → клиент | РАБОТАЕТ | Подтверждение аутентификации |
| `typing` | клиент → сервер → broadcast | РАБОТАЕТ | Индикатор набора текста |
| `stop_typing` | клиент → сервер → broadcast | РАБОТАЕТ | Остановка индикатора |
| `read` | клиент → сервер → broadcast | РАБОТАЕТ | Отметка о прочтении |
| `new_message` | сервер → broadcast | РАБОТАЕТ | Новое сообщение (broadcast при POST) |
| `message_deleted` | сервер → broadcast | РАБОТАЕТ | Удаление сообщения |
| `chat_deleted` | сервер → broadcast | РАБОТАЕТ | Удаление чата |
| `call_offer` | клиент → target user | РАБОТАЕТ | SDP offer для звонка |
| `call_answer` | клиент → target user | РАБОТАЕТ | SDP answer |
| `ice_candidate` | клиент → target user | РАБОТАЕТ | ICE candidate |
| `call_end` | клиент → target user | РАБОТАЕТ | Завершение звонка |
| `call_reject` | клиент → target user | РАБОТАЕТ | Отклонение звонка |

**Проблема:** `call_offer` обрабатывается на сервере (relay), но **в App.tsx НЕ обрабатывается входящий `call_offer`** — только `call_answer`, `ice_candidate`, `call_end`, `call_reject`.

#### 1.4 Таблицы базы данных

**Существующие (7 таблиц, определены в db.js):**

| # | Таблица | Колонки | Статус |
|---|---------|---------|--------|
| 1 | `users` | id, phone, email, display_name, avatar_url, password_hash, is_online, last_seen_at, created_at | РАБОТАЕТ |
| 2 | `chats` | id, type, name, description, avatar_url, created_by, last_message_at, created_at | РАБОТАЕТ |
| 3 | `chat_members` | id, chat_id, user_id, role, unread_count, joined_at | РАБОТАЕТ |
| 4 | `messages` | id, chat_id, sender_id, content, type, reply_to, status, self_destruct_at, e2ee_nonce, e2ee_header, e2ee_algorithm, created_at | РАБОТАЕТ |
| 5 | `attachments` | id, message_id, uploader_id, file_name, file_size, mime_type, url, object_name, duration, width, height, created_at | РАБОТАЕТ |
| 6 | `prekeys` | id, user_id, identity_key, signing_key, signed_prekey, signed_prekey_id, signed_prekey_signature, created_at | РАБОТАЕТ |
| 7 | `one_time_prekeys` | id, user_id, key_id, public_key, used, created_at | РАБОТАЕТ |

**Отсутствующие таблицы (нужны):**

| # | Таблица | Назначение | Приоритет |
|---|---------|-----------|-----------|
| 1 | `contacts` | Список контактов пользователя | P0 |
| 2 | `user_settings` | Настройки (тема, уведомления, приватность) | P1 |
| 3 | `reactions` | Реакции на сообщения (emoji + user_id) | P1 |
| 4 | `call_history` | Журнал звонков | P2 |
| 5 | `push_tokens` | Токены push-уведомлений (FCM/APNs/Web Push) | P2 |
| 6 | `blocked_users` | Заблокированные пользователи | P2 |
| 7 | `message_edits` | История редактирования сообщений | P2 |

---

### 2. Фронтенд (webApp/src/)

#### 2.1 Все компоненты с статусом

| Компонент | Файл | Статус | Описание проблемы |
|-----------|------|--------|------------------|
| `App` | App.tsx | РАБОТАЕТ | Роутинг, WS, layout — всё ок. **НЕ обрабатывает `call_offer`** |
| `AuthScreen` | components/auth/AuthScreen.tsx | РАБОТАЕТ | Форма входа/регистрации |
| `CallScreen` | components/calls/CallScreen.tsx | PARTIAL | UI есть, но **не подключён к webrtc.ts** — нет видео, нет аудио |
| `ChatList` | components/chat-list/ChatList.tsx | РАБОТАЕТ | Список чатов с поиском |
| `ChatListHeader` | components/chat-list/ChatListHeader.tsx | РАБОТАЕТ | Шапка списка |
| `ChatListItem` | components/chat-list/ChatListItem.tsx | РАБОТАЕТ | Элемент списка |
| `NewChatModal` | components/chat-list/NewChatModal.tsx | РАБОТАЕТ | Создание чата |
| `ConversationScreen` | components/conversation/ConversationScreen.tsx | РАБОТАЕТ | Виртуализированный список, E2EE |
| `DateSeparator` | components/conversation/DateSeparator.tsx | РАБОТАЕТ | |
| `DeliveryStatus` | components/conversation/DeliveryStatus.tsx | РАБОТАЕТ | |
| `InputBar` | components/conversation/InputBar.tsx | PARTIAL | Typing работает. **onAttachment не подключён к uploadFile.** Emoji кнопка — заглушка. Голосовое — заглушка. |
| `MessageBubble` | components/conversation/MessageBubble.tsx | РАБОТАЕТ | |
| `ReplyQuote` | components/conversation/ReplyQuote.tsx | РАБОТАЕТ | |
| `TypingIndicator` | components/conversation/TypingIndicator.tsx | РАБОТАЕТ | |
| `TabBar` | components/layout/TabBar.tsx | РАБОТАЕТ | |
| `AttachmentPicker` | components/media/AttachmentPicker.tsx | PARTIAL | UI action sheet работает, но **onSelect ни к чему не подключён** |
| `FileAttachment` | components/media/FileAttachment.tsx | PARTIAL | Компонент отображения есть, **нигде не используется** |
| `ImageViewer` | components/media/ImageViewer.tsx | PARTIAL | Компонент есть, **нигде не используется** |
| `VoiceMessage` | components/media/VoiceMessage.tsx | PARTIAL | UI есть, **нет реального воспроизведения аудио** |
| `TapbackOverlay` | components/reactions/TapbackOverlay.tsx | PARTIAL | UI работает, **addReaction только в Zustand, нет API** |
| `EncryptionInfo` | components/secret-chat/EncryptionInfo.tsx | РАБОТАЕТ | |
| `KeyExchangeAnimation` | components/secret-chat/KeyExchangeAnimation.tsx | РАБОТАЕТ | |
| `SelfDestructPicker` | components/secret-chat/SelfDestructPicker.tsx | РАБОТАЕТ | |
| `VerificationModal` | components/secret-chat/VerificationModal.tsx | РАБОТАЕТ | |
| `SettingsScreen` | components/settings/SettingsScreen.tsx | PARTIAL | **ВСЕ кнопки — alert() заглушки** кроме Выйти |
| `Avatar` | components/ui/Avatar.tsx | РАБОТАЕТ | |
| `FrostedGlassBar` | components/ui/FrostedGlassBar.tsx | РАБОТАЕТ | |
| `SearchBar` | components/ui/SearchBar.tsx | РАБОТАЕТ | |

**ОТСУТСТВУЮЩИЕ компоненты:**

| Компонент | Назначение | Приоритет |
|-----------|-----------|-----------|
| `ContactsScreen` | Экран контактов (tab "Контакты" — заглушка) | P0 |
| `CallHistoryScreen` | Экран журнала звонков (tab "Звонки" — заглушка) | P2 |
| `ProfileEditScreen` | Редактирование профиля | P0 |
| `EmojiPicker` | Выбор эмодзи при вводе сообщения | P1 |
| `GroupInfoScreen` | Информация о группе, управление участниками | P1 |
| `MediaGallery` | Галерея медиафайлов чата | P2 |

#### 2.2 Все сторы (stores) с статусом

| Store | Файл | Статус | Проблема |
|-------|------|--------|----------|
| `authStore` | stores/authStore.ts | РАБОТАЕТ | Хранит токен в localStorage (httpOnly cookie тоже используется) |
| `chatStore` | stores/chatStore.ts | РАБОТАЕТ | Загрузка/создание/удаление чатов |
| `messageStore` | stores/messageStore.ts | РАБОТАЕТ | Отправка/получение, E2EE дешифровка, typing |
| `callStore` | stores/callStore.ts | BROKEN | **Имитация звонков с setTimeout**. НЕ подключён к webrtc.ts. startCall — фейковый таймер 2.5с |
| `secretChatStore` | stores/secretChatStore.ts | РАБОТАЕТ | X3DH + Double Ratchet, persist в IndexedDB |
| `uiStore` | stores/uiStore.ts | МЁРТВЫЙ КОД | **Нигде не используется**. Дублирует логику App.tsx |

#### 2.3 Все функции API клиента (api/client.ts)

| Функция | Подключена | Работает |
|---------|-----------|----------|
| `register()` | Да (AuthScreen) | Да |
| `login()` | Да (AuthScreen) | Да |
| `getMe()` | Нет (не используется для restore) | Да |
| `getChats()` | Да (chatStore.fetchChats) | Да |
| `createChat()` | Да (chatStore.createChat) | Да |
| `deleteChat()` | Да (chatStore.deleteChat) | Да |
| `getMessages()` | Да (messageStore.fetchMessages) | Да |
| `sendMessage()` | Да (messageStore.sendMessage) | Да |
| `markChatAsRead()` | Да (chatStore.markAsRead) | Да |
| `deleteMessage()` | Да (messageStore.deleteMessage) | Да |
| `uploadPreKeyBundle()` | Да (secretChatStore) | Да |
| `getPreKeyBundle()` | Да (secretChatStore) | Да |
| `getPreKeyCount()` | Нет (определена, не вызывается) | Да |
| `searchUsers()` | Да (NewChatModal) | Да |
| `connectWS()` | Да (App.tsx) | Да |
| `sendWS()` | Да (InputBar, webrtc.ts) | Да |
| `onWS()` | Да (App.tsx) | Да |
| `disconnectWS()` | Да (App.tsx, SettingsScreen) | Да |

#### 2.4 Утилиты

| Файл | Статус | Проблема |
|------|--------|----------|
| `utils/fileUpload.ts` | МЁРТВЫЙ КОД | uploadFile, compressImage, uploadImage, uploadVoice, createVoiceRecorder — **НИ ОДНА функция не вызывается из UI** |
| `utils/webrtc.ts` | PARTIAL | startCall, acceptCall, endCall, handleSignaling — определены, **startCall/acceptCall нигде не вызываются**. handleSignaling вызывается из App.tsx для 4 из 5 типов |
| `utils/dateFormat.ts` | РАБОТАЕТ | Форматирование дат |
| `utils/colors.ts` | РАБОТАЕТ | Генерация цвета аватара |
| `utils/indexedDB.ts` | РАБОТАЕТ | Обёртка для IndexedDB (E2EE ключи) |
| `hooks/useAutoReply.ts` | МЁРТВЫЙ КОД | Хук для авто-ответов — **нигде не используется** |
| `hooks/useFocusTrap.ts` | РАБОТАЕТ | Focus trap для модалов |
| `mocks/contacts.ts` | МЁРТВЫЙ КОД | Моки контактов — **отключены, не используются** |
| `mocks/messages.ts` | МЁРТВЫЙ КОД | Моки сообщений — **отключены** |
| `i18n/` | PARTIAL | Определены ru/en/kz, **нигде не используется функция `t()`** — все строки захардкожены |
| `crypto/` | РАБОТАЕТ | X3DH, Double Ratchet, keyStore, fingerprint, encrypt — полностью подключено |

---

### 3. Настройки (SettingsScreen.tsx)

Каждая строка настроек:

| Настройка | Значение | Реализация | Бэкенд |
|-----------|----------|-----------|--------|
| Профиль → "Изменить" | — | `alert()` заглушка | Нет PATCH /api/users/me |
| Тема | "Тёмная" | `alert()` заглушка | Нет таблицы user_settings |
| Уведомления | "Включены" | `alert()` заглушка | Нет настроек |
| Звук | "По умолчанию" | `alert()` заглушка | Нет настроек |
| Предпросмотр | "Всегда" | `alert()` заглушка | Нет настроек |
| Онлайн-статус | "Все" | `alert()` заглушка | Нет настроек приватности |
| Отчёты о прочтении | "Включены" | `alert()` заглушка | Нет настроек |
| Блокировка приложения | "Выкл" | `alert()` заглушка | Нет |
| Хранилище | "1.2 ГБ" (хардкод) | `alert()` заглушка | Нет подсчёта |
| Шифрование | "Signal Protocol" | `alert()` заглушка | Инфо |
| Версия | "1.0.0 (Sprint 6)" | Статичный текст | — |
| **Выйти** | — | **РАБОТАЕТ** | POST /api/auth/logout |

**Что нужно для бэкенда:**

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'dark',       -- 'dark' | 'light' | 'system'
  language VARCHAR(5) DEFAULT 'ru',       -- 'ru' | 'en' | 'kz'
  notifications_enabled BOOLEAN DEFAULT true,
  notification_sound VARCHAR(50) DEFAULT 'default',
  notification_preview VARCHAR(20) DEFAULT 'always', -- 'always' | 'contacts' | 'never'
  show_online_status VARCHAR(20) DEFAULT 'everyone', -- 'everyone' | 'contacts' | 'nobody'
  read_receipts BOOLEAN DEFAULT true,
  app_lock BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Что нужно на фронтенде:**
- Создать `settingsStore.ts` (загрузка/сохранение настроек)
- Переписать каждый `alert()` → вызов API → обновление store

---

### 4. Звонки и видеозвонки

#### 4.1 webrtc.ts — что работает

- `ICE_CONFIG` — только STUN (Google), **TURN закомментирован**
- `startCall()` — создаёт PeerConnection, получает MediaStream, отправляет SDP offer через WS
- `acceptCall()` — принимает offer, отправляет answer
- `endCall()` — закрывает PC, останавливает треки
- `rejectCall()` — отправляет call_reject через WS
- `handleSignaling()` — обрабатывает call_answer, ice_candidate, call_end, call_reject
- `onCallEvent()` — подписка на события (remote_stream, call_connected, etc.)

#### 4.2 CallScreen.tsx — что НЕ работает

- **Нет `<video>` элементов** — вместо видео показывается "PiP" текст-заглушка
- **Не получает localStream / remoteStream** из webrtc.ts
- **Кнопки toggleMic/toggleCamera** управляют только callStore state, **не вызывают webrtc.toggleMic/toggleCamera**
- **Нет рингтона** — при входящем звонке нет звукового уведомления

#### 4.3 callStore.ts — полностью отключён от webrtc.ts

```
callStore.startCall() → устанавливает status: 'ringing' → через 2.5с ФЕЙКОВЫЙ setTimeout → status: 'active'
```

Должно быть:
```
callStore.startCall() → webrtc.startCall() → WS call_offer → ждёт call_answer → status: 'active'
```

#### 4.4 App.tsx — входящие звонки НЕ обрабатываются

Строка 191 в App.tsx:
```typescript
if (['call_answer', 'ice_candidate', 'call_end', 'call_reject'].includes(msg.type as string)) {
  handleSignaling(msg as Record<string, unknown>);
}
```

**`call_offer` НЕ в списке!** Входящий звонок никогда не дойдёт до пользователя.

#### 4.5 TURN сервер

- В `docker-compose.yml` есть `coturn` сервис (порты 3478, 5349, 49152-49200)
- В `docker-compose.prod.yml` **coturn отсутствует**
- В `webrtc.ts` TURN закомментирован:
  ```typescript
  // { urls: 'turn:turn.son-messenger.com:3478', username: 'son', credential: 'secret' },
  ```

#### 4.6 Точные шаги для исправления звонков

**Шаг 1: App.tsx — добавить обработку call_offer:**
```typescript
// Добавить в WS обработчик:
if (msg.type === 'call_offer') {
  const callerName = msg.caller_name as string;
  const chatId = msg.chat_id as string;
  const isVideo = msg.is_video as boolean;
  useCallStore.getState().incomingCall(chatId, callerName, isVideo);
  // Сохранить SDP offer для acceptCall
  pendingOffer = { sdp: msg.sdp, callerId: msg.caller_id, chatId, isVideo };
}
```

**Шаг 2: Переписать callStore — подключить к webrtc.ts:**
```typescript
import * as webrtc from '@/utils/webrtc';

startCall: async (chatId, contactName, isVideo, contactAvatar) => {
  const targetUserId = /* получить из chat.members */;
  set({ activeCall: { chatId, contactName, contactAvatar, isVideo, isIncoming: false, status: 'ringing', ... } });
  await webrtc.startCall(chatId, targetUserId, isVideo);
},

acceptCall: async () => {
  const offer = pendingOffer; // сохранённый SDP offer
  if (offer) {
    await webrtc.acceptCall(offer.chatId, offer.callerId, offer.sdp, offer.isVideo);
    set(s => ({ activeCall: { ...s.activeCall!, status: 'active', startedAt: Date.now() } }));
  }
},

endCall: () => {
  webrtc.endCall();
  set(s => ({ activeCall: { ...s.activeCall!, status: 'ended' } }));
  setTimeout(() => set({ activeCall: null }), 500);
},
```

**Шаг 3: CallScreen — добавить video элементы:**
```tsx
const localVideoRef = useRef<HTMLVideoElement>(null);
const remoteVideoRef = useRef<HTMLVideoElement>(null);

useEffect(() => {
  const unsub = webrtc.onCallEvent((event, data) => {
    if (event === 'call_started' || event === 'call_accepted') {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = (data as any).localStream;
      }
    }
    if (event === 'remote_stream') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = (data as any).stream;
      }
    }
  });
  return unsub;
}, []);
```

**Шаг 4: TURN в docker-compose.prod.yml:**
```yaml
coturn:
  image: coturn/coturn:4.6
  container_name: son-coturn
  restart: always
  command: >
    turnserver
    --listening-port=3478
    --tls-listening-port=5349
    --realm=chat.sonchat.uk
    --use-auth-secret
    --static-auth-secret=${TURN_SECRET:?required}
    --no-cli
    --min-port=49152
    --max-port=49200
  ports:
    - "3478:3478/udp"
    - "3478:3478/tcp"
    - "5349:5349/udp"
    - "5349:5349/tcp"
    - "49152-49200:49152-49200/udp"
  networks:
    - son-internal
```

**Шаг 5: webrtc.ts — раскомментировать и настроить TURN:**
```typescript
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: ['turn:chat.sonchat.uk:3478?transport=udp', 'turn:chat.sonchat.uk:3478?transport=tcp'],
      username: 'son',
      credential: process.env.VITE_TURN_SECRET || 'son-turn-secret',
    },
  ],
};
```

---

### 5. Контакты

#### 5.1 Текущее состояние: ПОЛНОСТЬЮ ОТСУТСТВУЮТ

- Нет таблицы `contacts` в БД
- Нет API эндпоинтов
- Нет компонента `ContactsScreen` (заглушка в App.tsx: "Нет контактов")
- Есть `mocks/contacts.ts` но он отключён

#### 5.2 Схема таблицы

```sql
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),  -- Пользовательское имя контакта
  is_favorite BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(user_id, is_favorite) WHERE is_favorite = true;
```

#### 5.3 API эндпоинты

```
GET    /api/contacts                 → { contacts: [{ id, contact_user_id, nickname, is_favorite, is_blocked, user: { id, display_name, avatar_url, is_online } }] }
POST   /api/contacts                 → body: { contact_user_id } → { contact }
DELETE /api/contacts/:id             → 204
PATCH  /api/contacts/:id             → body: { nickname?, is_favorite?, is_blocked? } → { contact }
```

#### 5.4 Фронтенд компоненты

Создать:
- `stores/contactStore.ts` — CRUD, fetchContacts, addContact, removeContact, toggleFavorite, blockContact
- `components/contacts/ContactsScreen.tsx` — список контактов с поиском, секция "Избранные"
- `components/contacts/ContactRow.tsx` — строка контакта с аватаром и действиями
- `components/contacts/AddContactModal.tsx` — поиск и добавление контакта

---

### 6. Медиа и файлы

#### 6.1 Текущее состояние

| Утилита/Компонент | Код есть | Подключён к UI | Работает |
|-------------------|----------|----------------|----------|
| `fileUpload.ts: uploadFile()` | Да | **НЕТ** | Не тестировался |
| `fileUpload.ts: compressImage()` | Да | **НЕТ** | Не тестировался |
| `fileUpload.ts: uploadImage()` | Да | **НЕТ** | Не тестировался |
| `fileUpload.ts: createVoiceRecorder()` | Да | **НЕТ** | Не тестировался |
| `fileUpload.ts: uploadVoice()` | Да | **НЕТ** | Не тестировался |
| `AttachmentPicker` | Да | **onSelect не подключён** | UI работает |
| `FileAttachment` | Да | **Нигде не используется** | — |
| `ImageViewer` | Да | **Нигде не используется** | — |
| `VoiceMessage` | Да | **Нет аудио** | Только UI |
| `InputBar: голосовое` | Кнопка есть | **onClick пуст** | Заглушка |
| `InputBar: emoji` | Кнопка есть | **onClick пуст** | Заглушка |
| Бэкенд `POST /api/media/upload` | Да | — | Работает |

#### 6.2 Точные шаги подключения

**Шаг 1: InputBar.tsx — подключить onAttachment к ConversationScreen:**

В `ConversationScreen.tsx` добавить обработчик:
```typescript
const handleAttachment = useCallback(async (type: 'camera' | 'photo' | 'document' | 'location') => {
  if (type === 'photo' || type === 'document') {
    // Открыть file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'photo' ? 'image/*,video/*' : '*/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const result = type === 'photo'
          ? await uploadImage(file)
          : await uploadFile(file);
        // Отправить сообщение с вложением
        await api.sendMessage(chat.id, result.url, type === 'photo' ? 'image' : 'file');
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      }
    };
    input.click();
  } else if (type === 'camera') {
    // getUserMedia → сделать фото → uploadImage
    // ...
  }
}, [chat.id]);
```

И передать в `<InputBar onAttachment={handleAttachment} />`.

**Шаг 2: Голосовые сообщения — подключить createVoiceRecorder:**

В `InputBar.tsx`:
```typescript
import { createVoiceRecorder, uploadVoice } from '@/utils/fileUpload';

const recorderRef = useRef(createVoiceRecorder());
const [isRecording, setIsRecording] = useState(false);

const handleVoiceStart = async () => {
  await recorderRef.current.start();
  setIsRecording(true);
};

const handleVoiceStop = async () => {
  const blob = await recorderRef.current.stop();
  setIsRecording(false);
  const result = await uploadVoice(blob);
  await api.sendMessage(chatId, result.url, 'audio');
};
```

**Шаг 3: VoiceMessage — добавить реальное воспроизведение:**
```typescript
const audioRef = useRef<HTMLAudioElement | null>(null);

const handleTogglePlay = () => {
  if (!audioRef.current) {
    audioRef.current = new Audio(audioUrl);
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.ontimeupdate = () => {
      setProgress(audioRef.current!.currentTime / audioRef.current!.duration);
    };
  }
  if (isPlaying) {
    audioRef.current.pause();
  } else {
    audioRef.current.play();
  }
  setIsPlaying(!isPlaying);
};
```

---

### 7. Профиль пользователя

#### 7.1 Текущее состояние

- GET `/api/users/me` — есть, работает
- **Нет** PATCH `/api/users/me` — нельзя обновить профиль
- **Нет** загрузки аватара
- **Нет** смены пароля
- В SettingsScreen кнопка "Профиль" → `alert()` заглушка

#### 7.2 Бэкенд — добавить в server/index.js:

```javascript
/** PATCH /api/users/me — обновить профиль */
app.patch('/api/users/me', authMiddleware, async (req, res) => {
  const { display_name } = req.body;
  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || display_name.length < 2 || display_name.length > 50) {
      return res.status(400).json({ error: 'Имя должно быть от 2 до 50 символов' });
    }
  }
  const fields = [];
  const values = [];
  let idx = 1;
  if (display_name !== undefined) { fields.push(`display_name = $${idx++}`); values.push(display_name); }
  if (fields.length === 0) return res.status(400).json({ error: 'Нечего обновлять' });
  values.push(req.user.id);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, display_name, avatar_url`,
    values
  );
  res.json(result.rows[0]);
});

/** POST /api/users/me/avatar — загрузка аватара */
app.post('/api/users/me/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не прикреплён' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Допустимы только JPEG, PNG и WebP' });
  }
  const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'avatars');
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [result.url, req.user.id]);
  res.json({ avatar_url: result.url });
});

/** PATCH /api/users/me/password — смена пароля */
app.patch('/api/users/me/password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Оба поля обязательны' });
  }
  if (new_password.length < 8 || new_password.length > 128) {
    return res.status(400).json({ error: 'Новый пароль должен быть от 8 до 128 символов' });
  }
  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Неверный текущий пароль' });
  const hash = await bcrypt.hash(new_password, 12);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ ok: true });
});
```

#### 7.3 Фронтенд:

- Добавить `updateProfile()`, `uploadAvatar()`, `changePassword()` в `api/client.ts`
- Создать `components/settings/ProfileEditScreen.tsx`
- В `SettingsScreen.tsx` заменить `alert()` на навигацию к ProfileEditScreen

---

### 8. Групповые чаты

#### 8.1 Текущее состояние

- Создание группы — **РАБОТАЕТ** (POST /api/chats с type='group')
- Добавление участников при создании — **РАБОТАЕТ** (member_ids в теле)
- Добавление участников после создания — **НЕ РЕАЛИЗОВАНО**
- Удаление участников — **НЕ РЕАЛИЗОВАНО**
- Назначение администраторов — **НЕ РЕАЛИЗОВАНО**
- Редактирование группы (имя, аватар, описание) — **НЕ РЕАЛИЗОВАНО**

#### 8.2 API эндпоинты для добавления:

```javascript
/** POST /api/chats/:chatId/members — добавить участника */
app.post('/api/chats/:chatId/members', authMiddleware, chatMemberCheck, async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });
  // Проверить что это группа
  const chatResult = await pool.query('SELECT type FROM chats WHERE id = $1', [req.params.chatId]);
  if (chatResult.rows[0]?.type !== 'group') {
    return res.status(400).json({ error: 'Добавлять участников можно только в группу' });
  }
  // Проверить что запрашивающий — admin
  const roleResult = await pool.query(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2', [req.params.chatId, req.user.id]
  );
  if (roleResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ error: 'Только администратор может добавлять участников' });
  }
  await pool.query(
    'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.params.chatId, user_id]
  );
  broadcastToChat(req.params.chatId, { type: 'member_added', chat_id: req.params.chatId, user_id });
  res.status(201).json({ ok: true });
});

/** DELETE /api/chats/:chatId/members/:userId — удалить участника */
app.delete('/api/chats/:chatId/members/:userId', authMiddleware, chatMemberCheck, async (req, res) => {
  const { chatId, userId } = req.params;
  // Проверить права admin
  const roleResult = await pool.query(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, req.user.id]
  );
  if (roleResult.rows[0]?.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  await pool.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, userId]);
  broadcastToChat(chatId, { type: 'member_removed', chat_id: chatId, user_id: userId });
  res.json({ ok: true });
});

/** PATCH /api/chats/:chatId — обновить группу */
app.patch('/api/chats/:chatId', authMiddleware, chatMemberCheck, async (req, res) => {
  const { name, description } = req.body;
  // Только admin
  const roleResult = await pool.query(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2', [req.params.chatId, req.user.id]
  );
  if (roleResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ error: 'Только администратор может редактировать группу' });
  }
  const fields = [];
  const values = [];
  let idx = 1;
  if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
  if (fields.length === 0) return res.status(400).json({ error: 'Нечего обновлять' });
  values.push(req.params.chatId);
  const result = await pool.query(
    `UPDATE chats SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values
  );
  res.json(result.rows[0]);
});
```

---

### 9. Реакции на сообщения

#### 9.1 Текущее состояние

- `TapbackOverlay` — UI работает (6 emoji как в iMessage)
- `messageStore.addReaction()` — обновляет **только Zustand** state
- **Нет API вызова** — реакция пропадает при перезагрузке
- **Нет таблицы** в БД
- **Нет WS broadcast** — другой пользователь не видит реакцию

#### 9.2 Схема таблицы

```sql
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
```

#### 9.3 API эндпоинты

```javascript
/** POST /api/chats/:chatId/messages/:messageId/reactions */
app.post('/api/chats/:chatId/messages/:messageId/reactions', authMiddleware, chatMemberCheck, async (req, res) => {
  const { emoji } = req.body;
  const allowedEmojis = ['❤️', '👍', '👎', '😂', '‼️', '❓'];
  if (!allowedEmojis.includes(emoji)) {
    return res.status(400).json({ error: 'Недопустимая реакция' });
  }
  // Toggle: если реакция уже есть — удалить, иначе — добавить
  const existing = await pool.query(
    'SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [req.params.messageId, req.user.id, emoji]
  );
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM reactions WHERE id = $1', [existing.rows[0].id]);
  } else {
    await pool.query(
      'INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
      [req.params.messageId, req.user.id, emoji]
    );
  }
  // Broadcast
  broadcastToChat(req.params.chatId, {
    type: 'reaction_updated',
    chat_id: req.params.chatId,
    message_id: req.params.messageId,
    user_id: req.user.id,
    emoji,
    action: existing.rows.length > 0 ? 'removed' : 'added',
  });
  res.json({ ok: true });
});
```

#### 9.4 Фронтенд — обновить messageStore.addReaction:

```typescript
addReaction: async (chatId, messageId, emoji, userId) => {
  // Optimistic update
  set((s) => ({
    messages: {
      ...s.messages,
      [chatId]: (s.messages[chatId] ?? []).map((m) => {
        if (m.id !== messageId) return m;
        const current = m.reactions[emoji] ?? [];
        const hasReaction = current.includes(userId);
        const updated = hasReaction ? current.filter((id) => id !== userId) : [...current, userId];
        return { ...m, reactions: { ...m.reactions, [emoji]: updated } };
      }),
    },
  }));
  // API вызов
  try {
    await api.addReaction(chatId, messageId, emoji);
  } catch (err) {
    console.error('Ошибка реакции:', err);
  }
},
```

---

### 10. Push-уведомления

#### 10.1 Текущее состояние: НОЛЬ реализации

| Платформа | Статус |
|-----------|--------|
| **Web Push** | Нет реализации. Service worker не обрабатывает push events. |
| **Android FCM** | `FcmService.kt` существует (скелет), но **нет google-services.json** |
| **iOS APNs** | Нет Xcode проекта, нет сертификатов |
| **Push service (Go)** | Скелет — только health check и логирование. **Нет интеграции с FCM/APNs/Web Push API** |

#### 10.2 Что нужно для Web Push:

1. Сгенерировать VAPID ключи: `npx web-push generate-vapid-keys`
2. В `sw.js` добавить:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'sOn', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { chatId: data.chat_id },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  event.waitUntil(
    clients.openWindow(chatId ? `/chat/${chatId}` : '/')
  );
});
```

3. На бэкенде — добавить `web-push` npm пакет и таблицу `push_tokens`

---

### 11. PWA и мобильные приложения

#### 11.1 PWA — текущее состояние

| Элемент | Статус | Проблема |
|---------|--------|----------|
| `manifest.json` | МИНИМАЛЬНЫЙ | Только SVG иконка — **Android/iOS не поддерживают SVG в manifest** |
| `sw.js` | МИНИМАЛЬНЫЙ | Кэширует только `/` и `/index.html`. Нет precache, нет push, нет offline |
| Иконки | ОТСУТСТВУЮТ | Нужны PNG: 192x192, 512x512, apple-touch-icon 180x180, maskable |
| Splash screen | ОТСУТСТВУЕТ | Нет apple-mobile-web-app-* мета-тегов |

**manifest.json — исправленный:**
```json
{
  "name": "sOn Messenger",
  "short_name": "sOn",
  "description": "Защищённый семейный мессенджер с end-to-end шифрованием",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#007AFF",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ],
  "categories": ["social", "communication"],
  "lang": "ru"
}
```

#### 11.2 Android — текущее состояние

- Есть `androidApp/` с Kotlin/Compose
- Файлы: `MainActivity.kt`, `SonApp.kt`, `SonMessengerApp.kt`, `ChatListScreen.kt`, `SettingsScreen.kt`, `CallService.kt`, `FcmService.kt`
- **Нет** `google-services.json` — FCM не работает
- **Нет** файла `local.properties` — не скомпилируется
- Это KMP (Kotlin Multiplatform) с `shared/` модулем
- **Не имеет почти никакой логики** — скелет с базовой структурой

#### 11.3 iOS — текущее состояние

- **НЕТ** Xcode проекта
- В `shared/` есть `iosMain/kotlin/com/son/ios/` — пустая KMP структура
- Для iOS нужно создать Xcode проект с нуля или использовать KMP iOS target

---

### 12. Инфраструктура 24/7

#### 12.1 Jenkins конфликт порта 8080

В `docker-compose.yml` crypto-service использует порт 8080:
```yaml
crypto-service:
  ports:
    - "8080:8080"
```

Если Jenkins запущен на том же сервере — **конфликт порта**. Решение: сменить порт crypto-service на 8081 или убрать crypto-service (он скелет и не используется).

#### 12.2 Dev секреты в production

| Файл | Проблема |
|------|----------|
| `.env` | Содержит dev-секреты |
| `docker-compose.yml` | `POSTGRES_PASSWORD: postgres` захардкожен |
| `docker-compose.prod.yml` | Правильно использует `${POSTGRES_PASSWORD:?required}` |
| `server/storage.js` | `accessKey: 'minioadmin'` в fallback |

**Решение:** убедиться что `.env.production` содержит уникальные секреты и не содержит `minioadmin`/`postgres`.

#### 12.3 Автобэкап PostgreSQL

**Нет никакой системы бэкапов.** Нужен cron-job:

```bash
#!/bin/bash
# /opt/son/scripts/backup-postgres.sh
BACKUP_DIR="/opt/son/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker exec son-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$BACKUP_DIR/son_${TIMESTAMP}.sql.gz"

# Удалить бэкапы старше 30 дней
find "$BACKUP_DIR" -name "son_*.sql.gz" -mtime +30 -delete
```

Crontab: `0 3 * * * /opt/son/scripts/backup-postgres.sh`

#### 12.4 Мониторинг и алертинг

**Ноль мониторинга.** Рекомендации:

1. **Uptime monitoring:** Uptime Kuma (Docker) → проверять `/health` каждые 60 сек
2. **Логирование:** docker logging driver уже настроен в prod compose
3. **Алертинг:** Telegram бот для критических алертов

#### 12.5 macOS sleep prevention

Если сервер на Mac mini — нужно предотвратить сон:

```bash
# Запускать при старте:
caffeinate -s &

# Или через launchd (LaunchDaemon):
# /Library/LaunchDaemons/com.son.caffeinate.plist
```

#### 12.6 Docker auto-start

В `docker-compose.prod.yml` уже есть `restart: always` для всех сервисов.
Нужно убедиться что Docker сам стартует при перезагрузке:

```bash
sudo systemctl enable docker
```

На macOS Docker Desktop стартует автоматически если включен "Start Docker Desktop when you log in".

---

## Подробный план реализации

---

### Фаза 1: Базовая функциональность (2-3 недели)

---

#### 1.1 Профиль пользователя

**Файлы для изменения:**
- `server/index.js` — добавить PATCH /api/users/me, POST /api/users/me/avatar, PATCH /api/users/me/password
- `webApp/src/api/client.ts` — добавить updateProfile(), uploadAvatar(), changePassword()
- `webApp/src/components/settings/ProfileEditScreen.tsx` — СОЗДАТЬ
- `webApp/src/components/settings/SettingsScreen.tsx` — заменить alert() на навигацию

**БД:** Не нужны новые таблицы (avatar_url уже есть в users).

**API:**
```
PATCH  /api/users/me         → body: { display_name? } → { id, email, display_name, avatar_url }
POST   /api/users/me/avatar  → multipart (avatar) → { avatar_url }
PATCH  /api/users/me/password → body: { current_password, new_password } → { ok: true }
```

**Тестирование:** supertest для бэкенда, vitest + testing-library для фронтенда.

---

#### 1.2 Настройки (user_settings)

**Файлы для изменения:**
- `server/db.js` — добавить CREATE TABLE user_settings
- `server/index.js` — добавить GET/PATCH /api/users/me/settings
- `webApp/src/stores/settingsStore.ts` — СОЗДАТЬ
- `webApp/src/components/settings/SettingsScreen.tsx` — подключить к store

**БД:**
```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'dark',
  language VARCHAR(5) DEFAULT 'ru',
  notifications_enabled BOOLEAN DEFAULT true,
  notification_sound VARCHAR(50) DEFAULT 'default',
  notification_preview VARCHAR(20) DEFAULT 'always',
  show_online_status VARCHAR(20) DEFAULT 'everyone',
  read_receipts BOOLEAN DEFAULT true,
  app_lock BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API:**
```
GET    /api/users/me/settings  → { theme, language, notifications_enabled, ... }
PATCH  /api/users/me/settings  → body: { theme?, language?, ... } → { ...updated_settings }
```

**Фронтенд store:**
```typescript
// stores/settingsStore.ts
interface SettingsStore {
  settings: UserSettings | null;
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
}
```

---

#### 1.3 Контакты

Полное описание — см. раздел 5 выше.

**Файлы:**
- `server/db.js` — CREATE TABLE contacts
- `server/index.js` — 4 новых эндпоинта
- `webApp/src/api/client.ts` — getContacts, addContact, deleteContact, updateContact
- `webApp/src/stores/contactStore.ts` — СОЗДАТЬ
- `webApp/src/components/contacts/ContactsScreen.tsx` — СОЗДАТЬ
- `webApp/src/components/contacts/ContactRow.tsx` — СОЗДАТЬ
- `webApp/src/components/contacts/AddContactModal.tsx` — СОЗДАТЬ
- `webApp/src/App.tsx` — заменить заглушку на ContactsScreen

---

#### 1.4 Медиа — подключить загрузку файлов/фото

**Файлы для изменения:**
- `webApp/src/components/conversation/ConversationScreen.tsx` — добавить handleAttachment
- `webApp/src/components/conversation/InputBar.tsx` — передать onAttachment
- `webApp/src/components/conversation/MessageBubble.tsx` — рендерить image/file attachment
- `webApp/src/components/media/ImageViewer.tsx` — подключить к MessageBubble
- `webApp/src/components/media/FileAttachment.tsx` — подключить к MessageBubble

**Логика:**
1. Пользователь нажимает "+" → AttachmentPicker → выбирает "Фото" или "Документ"
2. Открывается file input → выбор файла
3. Вызов `uploadImage()` или `uploadFile()` из `fileUpload.ts`
4. Получение URL → отправка сообщения с type='image'/'file' и URL в content
5. MessageBubble рендерит ImageViewer или FileAttachment в зависимости от type

---

#### 1.5 Emoji-пикер

**Файлы:**
- `webApp/src/components/media/EmojiPicker.tsx` — СОЗДАТЬ
- `webApp/src/components/conversation/InputBar.tsx` — подключить

**Реализация:** использовать lightweight emoji picker (например `emoji-mart` или свой простой Grid). Вставка эмодзи в позицию курсора textarea.

---

#### 1.6 Голосовые сообщения

**Файлы для изменения:**
- `webApp/src/components/conversation/InputBar.tsx` — подключить createVoiceRecorder
- `webApp/src/components/media/VoiceMessage.tsx` — добавить реальное Audio API
- `webApp/src/components/conversation/MessageBubble.tsx` — рендерить VoiceMessage для type='audio'

**Логика:**
1. Долгое нажатие на кнопку AudioLines → начать запись (createVoiceRecorder().start())
2. Отпуск → остановить запись (stop()) → получить Blob
3. uploadVoice(blob) → получить URL
4. sendMessage(chatId, url, 'audio')

---

#### 1.7 Реакции — бэкенд persistence

Полное описание — см. раздел 9.

**Файлы:**
- `server/db.js` — CREATE TABLE reactions
- `server/index.js` — POST /api/chats/:chatId/messages/:messageId/reactions
- `webApp/src/api/client.ts` — addReaction()
- `webApp/src/stores/messageStore.ts` — обновить addReaction (добавить API вызов)
- `webApp/src/App.tsx` — обработка WS event 'reaction_updated'

Также: при загрузке сообщений через GET /api/chats/:chatId/messages — присоединять реакции из таблицы reactions.

---

#### 1.8 Редактирование сообщений

**Файлы:**
- `server/index.js` — PATCH /api/chats/:chatId/messages/:id
- `webApp/src/api/client.ts` — editMessage()
- `webApp/src/stores/messageStore.ts` — editMessage()
- `webApp/src/components/reactions/TapbackOverlay.tsx` — добавить кнопку "Редактировать"
- `webApp/src/components/conversation/InputBar.tsx` — режим редактирования

**БД (опционально):**
```sql
CREATE TABLE IF NOT EXISTS message_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  old_content TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API:**
```javascript
app.patch('/api/chats/:chatId/messages/:id', authMiddleware, chatMemberCheck, async (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.length > 10000) {
    return res.status(400).json({ error: 'Некорректное содержимое' });
  }
  // Сохранить оригинал в историю
  const original = await pool.query('SELECT content FROM messages WHERE id = $1 AND sender_id = $2', [req.params.id, req.user.id]);
  if (original.rows.length === 0) {
    return res.status(403).json({ error: 'Нельзя редактировать чужое сообщение' });
  }
  await pool.query('UPDATE messages SET content = $1 WHERE id = $2', [content, req.params.id]);
  broadcastToChat(req.params.chatId, {
    type: 'message_edited', chat_id: req.params.chatId, message_id: req.params.id, content,
  });
  res.json({ ok: true });
});
```

---

### Фаза 2: Звонки (1-2 недели)

---

#### 2.1 TURN сервер (coturn в Docker Compose)

Добавить в `docker-compose.prod.yml` сервис coturn (см. раздел 4.6).

#### 2.2 Исправить входящие звонки

В `App.tsx` — добавить обработку `call_offer` в WS listener (см. раздел 4.6 шаг 1).

#### 2.3 Подключить callStore к webrtc.ts

Переписать `callStore.ts` — убрать все фейковые setTimeout, вызывать webrtc.startCall, webrtc.acceptCall, webrtc.endCall (см. раздел 4.6 шаг 2).

#### 2.4 Рендерить видео в CallScreen

Добавить `<video>` элементы, подписаться на webrtc.onCallEvent для получения streams (см. раздел 4.6 шаг 3).

#### 2.5 История звонков

**БД:**
```sql
CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES users(id),
  callee_id UUID REFERENCES users(id),
  type VARCHAR(10) NOT NULL DEFAULT 'audio', -- 'audio' | 'video'
  status VARCHAR(20) NOT NULL, -- 'completed' | 'missed' | 'rejected' | 'failed'
  duration INT DEFAULT 0, -- в секундах
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calls_user ON call_history(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON call_history(callee_id);
```

**API:**
```
GET /api/calls/history?limit=50 → { calls: [...] }
```

---

### Фаза 3: Инфраструктура (1 неделя)

---

#### 3.1 Убрать Jenkins конфликт

Удалить crypto-service из `docker-compose.yml` (или сменить порт с 8080 на 8081). Crypto-service — скелет на Rust, не используется.

#### 3.2 Production секреты

Проверить `.env.production`:
```bash
JWT_SECRET=<сгенерировать: openssl rand -base64 48>
POSTGRES_USER=son
POSTGRES_PASSWORD=<сгенерировать: openssl rand -base64 32>
POSTGRES_DB=son_prod
MINIO_ACCESS_KEY=<сгенерировать>
MINIO_SECRET_KEY=<сгенерировать>
TURN_SECRET=<сгенерировать>
```

#### 3.3 Автобэкап PostgreSQL

Создать `scripts/backup-postgres.sh` (см. раздел 12.3). Добавить в crontab.

#### 3.4 Мониторинг и алертинг

Добавить Uptime Kuma в docker-compose.prod.yml:
```yaml
uptime-kuma:
  image: louislam/uptime-kuma:1
  container_name: son-uptime
  restart: always
  volumes:
    - uptime_data:/app/data
  ports:
    - "3001:3001"
  networks:
    - son-internal
```

#### 3.5 macOS sleep prevention

Если хост — macOS, добавить LaunchDaemon для caffeinate.

#### 3.6 PWA иконки и service worker

1. Сгенерировать PNG иконки из favicon.svg (192x192, 512x512, maskable)
2. Обновить `manifest.json` (см. раздел 11.1)
3. Обновить `sw.js` — добавить precache для Vite build hash, push events, offline fallback

---

### Фаза 4: Мобильные приложения (2-4 недели)

---

#### 4.1 PWA доработка

- Precache через workbox или vite-plugin-pwa
- Push notifications (Web Push API + VAPID)
- Offline fallback page
- Install prompt
- Apple-specific meta tags

#### 4.2 Android — сборка и push

1. Добавить `google-services.json` для FCM
2. Реализовать WebView обёртку для PWA (или нативную навигацию)
3. Подключить FCM в `FcmService.kt`
4. Сборка APK/AAB
5. Публикация в Google Play (или Telegram APK)

#### 4.3 iOS — Xcode проект и push

1. Создать Xcode проект (WKWebView обёртка для PWA)
2. Получить APNs сертификаты
3. Реализовать push через UNUserNotificationCenter
4. Или: KMP iOS target из shared/ модуля
5. Публикация в TestFlight

---

## Ключевые файлы проекта (карта)

```
Son/
├── server/                          # Бэкенд (Node.js + Express)
│   ├── index.js                     # ВСЕ эндпоинты + WebSocket (~945 строк)
│   ├── db.js                        # PostgreSQL pool + initDB (7 таблиц)
│   ├── storage.js                   # MinIO (S3) — upload/download файлов
│   ├── package.json                 # bcryptjs, cors, express, helmet, ws, pg, minio, multer
│   └── Dockerfile                   # Node.js prod image
│
├── webApp/                          # Фронтенд (React + TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx                  # Главный компонент, WS подключение, роутинг
│   │   ├── main.tsx                 # Entry point
│   │   ├── api/
│   │   │   ├── client.ts            # HTTP/WS клиент (все API функции)
│   │   │   └── config.ts            # API_URL, WS_URL
│   │   ├── stores/
│   │   │   ├── authStore.ts         # Аутентификация
│   │   │   ├── chatStore.ts         # Чаты (список, создание, удаление)
│   │   │   ├── messageStore.ts      # Сообщения (CRUD, typing, E2EE)
│   │   │   ├── callStore.ts         # Звонки (BROKEN — фейковый)
│   │   │   ├── secretChatStore.ts   # E2EE сессии (X3DH + Double Ratchet)
│   │   │   └── uiStore.ts           # МЁРТВЫЙ КОД
│   │   ├── components/
│   │   │   ├── auth/AuthScreen.tsx
│   │   │   ├── calls/CallScreen.tsx           # PARTIAL — нет видео
│   │   │   ├── chat-list/                     # ChatList, ChatListHeader, ChatListItem, NewChatModal
│   │   │   ├── conversation/                  # ConversationScreen, InputBar, MessageBubble, DateSeparator, DeliveryStatus, ReplyQuote, TypingIndicator
│   │   │   ├── layout/TabBar.tsx
│   │   │   ├── media/                         # AttachmentPicker, FileAttachment, ImageViewer, VoiceMessage
│   │   │   ├── reactions/TapbackOverlay.tsx
│   │   │   ├── secret-chat/                   # EncryptionInfo, KeyExchangeAnimation, SelfDestructPicker, VerificationModal
│   │   │   ├── settings/SettingsScreen.tsx     # ВСЕ кроме Logout — alert() заглушки
│   │   │   └── ui/                            # Avatar, FrostedGlassBar, SearchBar
│   │   ├── crypto/                            # X3DH, Double Ratchet, keyPair, encrypt, fingerprint, keyStore, secretTransport
│   │   ├── hooks/                             # useFocusTrap, useAutoReply (мёртвый)
│   │   ├── i18n/                              # ru, en, kz — не подключены к UI
│   │   ├── mocks/                             # contacts, messages — отключены
│   │   ├── types/                             # chat.ts, message.ts, user.ts
│   │   └── utils/
│   │       ├── webrtc.ts                      # WebRTC (startCall, acceptCall, endCall, handleSignaling)
│   │       ├── fileUpload.ts                  # МЁРТВЫЙ КОД (upload, compress, voice recorder)
│   │       ├── dateFormat.ts
│   │       ├── colors.ts
│   │       └── indexedDB.ts
│   ├── public/
│   │   ├── manifest.json                      # PWA manifest (только SVG иконка)
│   │   └── sw.js                              # Service worker (минимальный)
│   ├── package.json                           # react 19, vite 6, zustand, tailwindcss 4
│   └── Dockerfile                             # nginx + SPA
│
├── backend/                                   # Заброшенные микросервисы
│   ├── gateway/                               # Elixir/Phoenix — СКЕЛЕТ
│   ├── crypto_service/                        # Rust — СКЕЛЕТ
│   └── push_service/                          # Go — СКЕЛЕТ (только health + log)
│
├── androidApp/                                # Android (Kotlin/Compose) — СКЕЛЕТ
├── shared/                                    # KMP shared module
│
├── docker-compose.yml                         # Dev (полный стек, не используется)
├── docker-compose.prod.yml                    # PRODUCTION (postgres, redis, minio, api, web)
├── docker-compose.local.yml                   # Только БД для локальной разработки
│
├── .env                                       # Dev секреты
├── .env.production                            # Prod секреты
└── .env.example                               # Шаблон переменных окружения
```

---

## Текущие известные баги

| # | Баг | Файл | Приоритет | Описание |
|---|-----|------|-----------|----------|
| 1 | Входящие звонки не работают | App.tsx:191 | P0 | `call_offer` не в списке обрабатываемых WS типов |
| 2 | callStore — фейковый | stores/callStore.ts | P0 | setTimeout имитирует звонок, не подключён к WebRTC |
| 3 | CallScreen — нет видео | components/calls/CallScreen.tsx | P0 | Нет `<video>` элементов, нет подписки на MediaStream |
| 4 | Реакции не сохраняются | stores/messageStore.ts:276 | P1 | addReaction — только Zustand, нет API/DB |
| 5 | Все настройки — alert() | components/settings/SettingsScreen.tsx | P1 | Кроме "Выйти" — всё заглушки |
| 6 | Вложения не работают | components/conversation/InputBar.tsx | P1 | onAttachment не подключён к uploadFile |
| 7 | Голосовые не работают | components/conversation/InputBar.tsx | P1 | Кнопка AudioLines — пустой onClick |
| 8 | VoiceMessage — нет аудио | components/media/VoiceMessage.tsx | P1 | Только визуальная волна, нет Audio API |
| 9 | Emoji — заглушка | components/conversation/InputBar.tsx | P2 | Кнопка Smile — пустой onClick |
| 10 | Контакты — заглушка | App.tsx:260-267 | P1 | Tab "Контакты" → "Нет контактов" (хардкод) |
| 11 | Звонки — заглушка | App.tsx:251-258 | P2 | Tab "Звонки" → "Нет звонков" (хардкод) |
| 12 | TURN закомментирован | utils/webrtc.ts:14 | P0 | Звонки через NAT не будут работать |
| 13 | Хранилище "1.2 ГБ" хардкод | SettingsScreen.tsx:130 | P2 | Фейковое значение |
| 14 | i18n не используется | i18n/ | P2 | Все строки захардкожены на русском |
| 15 | PWA — только SVG иконка | manifest.json | P1 | Android/iOS не установят PWA |
| 16 | SW — минимальный | sw.js | P2 | Нет precache, нет push, нет offline |

---

## Мёртвый код (для очистки или подключения)

| # | Файл/Модуль | Тип | Действие |
|---|------------|-----|---------|
| 1 | `stores/uiStore.ts` | Store | **УДАЛИТЬ** — нигде не используется, дублирует App.tsx |
| 2 | `hooks/useAutoReply.ts` | Hook | **УДАЛИТЬ** — нигде не используется |
| 3 | `mocks/contacts.ts` | Mock data | **УДАЛИТЬ** (или оставить для тестов) — моки отключены |
| 4 | `mocks/messages.ts` | Mock data | **УДАЛИТЬ** (или оставить для тестов) — моки отключены |
| 5 | `utils/fileUpload.ts` | Утилиты | **ПОДКЛЮЧИТЬ** — все функции готовы, ни одна не вызывается из UI |
| 6 | `components/media/FileAttachment.tsx` | Компонент | **ПОДКЛЮЧИТЬ** — нигде не рендерится |
| 7 | `components/media/ImageViewer.tsx` | Компонент | **ПОДКЛЮЧИТЬ** — нигде не рендерится |
| 8 | `api/client.ts: getMe()` | API функция | **ПОДКЛЮЧИТЬ** — не используется при restore (вместо этого localStorage) |
| 9 | `api/client.ts: getPreKeyCount()` | API функция | Может понадобиться для replenish OPK |
| 10 | `i18n/` (ru.ts, en.ts, kz.ts, index.ts) | Локализация | **ПОДКЛЮЧИТЬ** — система готова, но `t()` нигде не вызывается |
| 11 | `backend/gateway/` | Elixir сервис | **УДАЛИТЬ** или **ЗАМОРОЗИТЬ** — скелет, не подключён |
| 12 | `backend/crypto_service/` | Rust сервис | **УДАЛИТЬ** или **ЗАМОРОЗИТЬ** — скелет, не подключён |
| 13 | `backend/push_service/` | Go сервис | **ПОДКЛЮЧИТЬ** (если будет push) или **УДАЛИТЬ** |

---

## Приоритеты реализации (сводная таблица)

| Приоритет | Задача | Сложность | Время |
|-----------|--------|-----------|-------|
| **P0** | Исправить входящие звонки (App.tsx + callStore + webrtc) | Средняя | 2-3 дня |
| **P0** | Добавить TURN в prod compose + webrtc.ts | Лёгкая | 0.5 дня |
| **P0** | Профиль пользователя (PATCH + avatar) | Средняя | 1-2 дня |
| **P0** | Контакты (таблица + API + UI) | Средняя | 2-3 дня |
| **P1** | Подключить загрузку файлов/фото | Средняя | 1-2 дня |
| **P1** | Голосовые сообщения | Средняя | 1-2 дня |
| **P1** | Реакции — persistence | Лёгкая | 1 день |
| **P1** | Настройки — user_settings таблица + API + UI | Средняя | 2 дня |
| **P1** | PWA иконки + улучшенный SW | Лёгкая | 0.5 дня |
| **P1** | Редактирование сообщений | Средняя | 1 день |
| **P2** | Emoji-пикер | Лёгкая | 0.5 дня |
| **P2** | Групповые чаты — управление участниками | Средняя | 1-2 дня |
| **P2** | История звонков | Средняя | 1-2 дня |
| **P2** | Автобэкап PostgreSQL | Лёгкая | 0.5 дня |
| **P2** | Мониторинг (Uptime Kuma) | Лёгкая | 0.5 дня |
| **P2** | Push-уведомления (Web Push) | Высокая | 3-4 дня |
| **P2** | Подключить i18n | Средняя | 1 день |
| **P3** | Android сборка | Высокая | 1-2 недели |
| **P3** | iOS проект | Высокая | 2-3 недели |

---

> **Общая оценка:** проект имеет солидную основу (аутентификация, чаты, сообщения, E2EE, виртуализация). Основные проблемы — незавершённые фичи (звонки, контакты, настройки, медиа) и мёртвый код. При последовательной реализации по фазам, мессенджер может быть доведён до production-качества за 4-6 недель.
