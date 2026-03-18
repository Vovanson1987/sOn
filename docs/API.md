# sOn Messenger — API Specification

## Base URL

```
Production:  https://api.son-messenger.com
Development: http://localhost:4000
```

## Аутентификация

Все запросы (кроме auth/*) требуют заголовок:
```
Authorization: Bearer <access_token>
```

Access token: JWT, срок жизни 15 минут.
Refresh token: httpOnly cookie, срок жизни 30 дней.

---

## 1. Auth

### POST /api/auth/register

Регистрация нового пользователя.

**Request:**
```json
{
  "phone": "+79001234567",
  "display_name": "Владимир",
  "password": "securePassword123!",
  "identity_key": "base64_encoded_curve25519_public_key",
  "signed_prekey": "base64_encoded_signed_prekey",
  "signed_prekey_signature": "base64_encoded_signature",
  "one_time_prekeys": [
    "base64_key_1",
    "base64_key_2"
  ]
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "phone": "+79001234567",
    "display_name": "Владимир",
    "created_at": "2026-03-18T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900
}
```

### POST /api/auth/login

**Request:**
```json
{
  "phone": "+79001234567",
  "password": "securePassword123!",
  "device_name": "Chrome on macOS",
  "platform": "web"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "phone": "+79001234567",
    "display_name": "Владимир",
    "avatar_url": "https://...",
    "status_text": "Available"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900,
  "device_id": "uuid"
}
```

**Response 401:**
```json
{
  "error": "invalid_credentials",
  "message": "Неверный номер телефона или пароль"
}
```

**Response 429:**
```json
{
  "error": "rate_limited",
  "message": "Слишком много попыток. Повторите через 60 секунд",
  "retry_after": 60
}
```

### POST /api/auth/refresh

Обновление access token с помощью refresh token (из httpOnly cookie).

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900
}
```

### DELETE /api/auth/logout

Инвалидация текущей сессии.

**Response 204:** No Content

---

## 2. Users

### GET /api/users/me

**Response 200:**
```json
{
  "id": "uuid",
  "phone": "+79001234567",
  "username": "vladimir",
  "display_name": "Владимир",
  "avatar_url": "https://...",
  "status_text": "Available",
  "settings": {
    "show_online": "everyone",
    "read_receipts": true,
    "theme": "dark"
  },
  "created_at": "2026-01-15T12:00:00Z"
}
```

### PATCH /api/users/me

**Request:**
```json
{
  "display_name": "Владимир Н.",
  "status_text": "На работе",
  "settings": {
    "show_online": "contacts"
  }
}
```

**Response 200:** Обновлённый объект пользователя.

### GET /api/users/search?q={query}

Поиск по имени, username или номеру телефона.

**Response 200:**
```json
{
  "users": [
    {
      "id": "uuid",
      "display_name": "Алексей",
      "username": "alex",
      "avatar_url": "https://...",
      "is_contact": true
    }
  ]
}
```

---

## 3. Contacts

### GET /api/contacts

**Response 200:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "display_name": "Ксенька",
      "phone": "+79001111111",
      "avatar_url": "https://...",
      "is_online": true,
      "last_seen_at": "2026-03-18T09:45:00Z",
      "nickname": "Доч"
    }
  ]
}
```

### POST /api/contacts

**Request:**
```json
{
  "user_id": "uuid",
  "nickname": "Доч"
}
```

### DELETE /api/contacts/:id

**Response 204:** No Content

---

## 4. Chats

### GET /api/chats

Список чатов с последним сообщением, отсортированный по дате.

**Query params:**
- `limit` (default: 50)
- `offset` (default: 0)
- `type` (optional): direct | group | secret

**Response 200:**
```json
{
  "chats": [
    {
      "id": "uuid",
      "type": "direct",
      "name": null,
      "members": [
        {
          "id": "uuid",
          "display_name": "900",
          "avatar_url": null
        }
      ],
      "last_message": {
        "id": "uuid",
        "content_preview": "Владимир Николаевич, вы можете получить до 2 987 р. н...",
        "sender_id": "uuid",
        "created_at": "2026-03-17T14:30:00Z",
        "type": "text"
      },
      "unread_count": 1,
      "is_muted": false,
      "is_archived": false,
      "updated_at": "2026-03-17T14:30:00Z"
    },
    {
      "id": "uuid",
      "type": "secret",
      "name": "Алексей",
      "is_verified": true,
      "self_destruct": 30,
      "last_message": {
        "content_preview": "🔒 Зашифрованное сообщение",
        "created_at": "2026-03-18T10:15:00Z"
      },
      "unread_count": 0,
      "updated_at": "2026-03-18T10:15:00Z"
    }
  ],
  "total": 10,
  "has_more": false
}
```

### POST /api/chats

Создание нового чата.

**Request (direct):**
```json
{
  "type": "direct",
  "member_ids": ["uuid"]
}
```

**Request (group):**
```json
{
  "type": "group",
  "name": "Семья",
  "member_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Request (secret):**
```json
{
  "type": "secret",
  "member_id": "uuid",
  "ephemeral_key": "base64_encoded_ephemeral_public_key",
  "used_prekey_id": 42
}
```

### DELETE /api/chats/:id

**Response 204:** No Content

---

## 5. Messages

### GET /api/chats/:chat_id/messages

Пагинированная загрузка сообщений (cursor-based).

**Query params:**
- `before` (cursor): message_id — загрузить сообщения ДО этого
- `limit` (default: 50, max: 100)

**Response 200:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "sender_id": "uuid",
      "sender_name": "Владимир",
      "encrypted_content": "base64...",
      "content_type": "text",
      "status": "read",
      "reply_to": {
        "id": "uuid",
        "sender_name": "Алексей",
        "preview": "Привет, как дела?"
      },
      "reactions": {
        "❤️": ["uuid1"],
        "👍": ["uuid2", "uuid3"]
      },
      "attachment": null,
      "self_destruct_at": null,
      "is_destroyed": false,
      "created_at": "2026-03-18T10:30:00Z",
      "delivered_at": "2026-03-18T10:30:01Z",
      "read_at": "2026-03-18T10:30:05Z"
    }
  ],
  "has_more": true,
  "next_cursor": "uuid_of_last_message"
}
```

### POST /api/chats/:chat_id/messages

**Request:**
```json
{
  "encrypted_content": "base64_encoded_aes256gcm_ciphertext",
  "content_iv": "base64_encoded_12byte_iv",
  "content_type": "text",
  "reply_to_id": null,
  "attachment_ids": [],
  "self_destruct": null
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "status": "sent",
  "created_at": "2026-03-18T10:30:00Z"
}
```

### POST /api/chats/:chat_id/messages/:msg_id/react

**Request:**
```json
{
  "emoji": "❤️"
}
```

### DELETE /api/chats/:chat_id/messages/:msg_id

**Response 204:** No Content

---

## 6. Groups

### POST /api/groups

**Request:**
```json
{
  "name": "Работа SCIF",
  "member_ids": ["uuid1", "uuid2", "uuid3", "uuid4"],
  "avatar_url": null
}
```

### PATCH /api/groups/:id

**Request:**
```json
{
  "name": "Работа SCIF (обновлено)",
  "description": "Рабочий чат"
}
```

### POST /api/groups/:id/members

**Request:**
```json
{
  "user_ids": ["uuid5"]
}
```

### DELETE /api/groups/:id/members/:user_id

Удаление участника (admin) или выход из группы (self).

---

## 7. Keys (E2E Encryption)

### POST /api/keys/prekey-bundle

Загрузка нового набора one-time prekeys.

**Request:**
```json
{
  "one_time_prekeys": [
    {"key_id": 1, "public_key": "base64..."},
    {"key_id": 2, "public_key": "base64..."}
  ]
}
```

### GET /api/keys/:user_id/prekey-bundle

Получение prekey bundle для начала E2E-сессии (X3DH).

**Response 200:**
```json
{
  "identity_key": "base64_encoded_identity_public_key",
  "signed_prekey": "base64_encoded_signed_prekey",
  "signed_prekey_signature": "base64_encoded_signature",
  "one_time_prekey": {
    "key_id": 42,
    "public_key": "base64..."
  }
}
```

### PUT /api/keys/signed-prekey

Ротация signed prekey (каждые 7 дней).

**Request:**
```json
{
  "signed_prekey": "base64_new_signed_prekey",
  "signature": "base64_signature"
}
```

---

## 8. Media

### POST /api/media/upload

Получение pre-signed URL для загрузки файла.

**Request:**
```json
{
  "chat_id": "uuid",
  "file_name": "photo.jpg",
  "file_size": 2048576,
  "mime_type": "image/jpeg",
  "type": "image"
}
```

**Response 200:**
```json
{
  "attachment_id": "uuid",
  "upload_url": "https://minio.../presigned-put-url",
  "expires_at": "2026-03-18T11:30:00Z"
}
```

### GET /api/media/:attachment_id

Получение pre-signed URL для скачивания.

**Response 200:**
```json
{
  "download_url": "https://minio.../presigned-get-url",
  "file_name": "photo.jpg",
  "file_size": 2048576,
  "mime_type": "image/jpeg",
  "thumbnail_url": "https://minio.../thumb-url",
  "expires_at": "2026-03-18T11:30:00Z"
}
```

---

## 9. WebSocket Events

### Подключение

```
wss://api.son-messenger.com/socket/websocket?token=<access_token>
```

### Каналы (Phoenix Channels)

| Channel | Описание |
|---------|----------|
| `user:{user_id}` | Личный канал (presence, уведомления) |
| `chat:{chat_id}` | Канал чата (сообщения, typing, reactions) |
| `call:{call_id}` | Канал звонка (signaling) |

### События

**Отправка сообщения:**
```json
{"topic": "chat:uuid", "event": "send_message", "payload": {
  "encrypted_content": "base64...",
  "content_iv": "base64...",
  "content_type": "text",
  "reply_to_id": null
}}
```

**Получение сообщения:**
```json
{"topic": "chat:uuid", "event": "new_message", "payload": {
  "id": "uuid",
  "sender_id": "uuid",
  "sender_name": "Алексей",
  "encrypted_content": "base64...",
  "content_type": "text",
  "created_at": "2026-03-18T10:30:00Z"
}}
```

**Typing indicator:**
```json
{"topic": "chat:uuid", "event": "user_typing", "payload": {
  "user_id": "uuid",
  "display_name": "Алексей"
}}
```

**Delivery receipt:**
```json
{"topic": "chat:uuid", "event": "message_delivered", "payload": {
  "message_id": "uuid",
  "delivered_at": "2026-03-18T10:30:01Z"
}}
```

**Read receipt:**
```json
{"topic": "chat:uuid", "event": "message_read", "payload": {
  "message_id": "uuid",
  "reader_id": "uuid",
  "read_at": "2026-03-18T10:30:05Z"
}}
```

**Reaction:**
```json
{"topic": "chat:uuid", "event": "reaction_added", "payload": {
  "message_id": "uuid",
  "user_id": "uuid",
  "emoji": "❤️"
}}
```

**Presence:**
```json
{"topic": "user:uuid", "event": "presence_state", "payload": {
  "user_123": {"is_online": true, "last_seen_at": "..."},
  "user_456": {"is_online": false, "last_seen_at": "..."}
}}
```

**Call signaling:**
```json
{"topic": "call:uuid", "event": "call_offer", "payload": {
  "caller_id": "uuid",
  "type": "video",
  "sdp_offer": "..."
}}

{"topic": "call:uuid", "event": "call_answer", "payload": {
  "sdp_answer": "..."
}}

{"topic": "call:uuid", "event": "ice_candidate", "payload": {
  "candidate": "..."
}}

{"topic": "call:uuid", "event": "call_ended", "payload": {
  "reason": "hangup",
  "duration": 125
}}
```

---

## 10. Error Codes

| HTTP | Code | Описание |
|------|------|----------|
| 400 | `bad_request` | Невалидные параметры |
| 401 | `unauthorized` | Невалидный или истёкший токен |
| 403 | `forbidden` | Нет прав доступа |
| 404 | `not_found` | Ресурс не найден |
| 409 | `conflict` | Дубликат (телефон, username) |
| 413 | `payload_too_large` | Файл превышает лимит (50MB) |
| 422 | `unprocessable` | Валидация не пройдена |
| 429 | `rate_limited` | Превышен лимит запросов |
| 500 | `internal_error` | Внутренняя ошибка сервера |

**Формат ошибки:**
```json
{
  "error": "error_code",
  "message": "Человеко-читаемое описание",
  "details": {}
}
```
