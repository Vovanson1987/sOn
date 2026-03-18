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

### POST /api/auth/logout

Инвалидация текущей сессии.

**Response 204:** No Content

### GET /api/auth/sessions

Список активных устройств / сессий текущего пользователя.

**Response 200:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "device_name": "Chrome on macOS",
      "platform": "web",
      "last_active_at": "2026-03-18T09:00:00Z"
    }
  ]
}
```

### DELETE /api/auth/sessions/:device_id

Завершение конкретной сессии (выход с устройства).

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

**Response 200:**
```json
{
  "id": "uuid",
  "phone": "+79001234567",
  "username": "vladimir",
  "display_name": "Владимир Н.",
  "avatar_url": "https://...",
  "status_text": "На работе",
  "settings": {
    "show_online": "contacts",
    "read_receipts": true,
    "theme": "dark"
  },
  "created_at": "2026-01-15T12:00:00Z"
}
```

### POST /api/users/me/avatar

Загрузка аватара пользователя.

**Request:** `multipart/form-data`
- `avatar` — файл изображения (JPEG/PNG, макс. 5 MB)

**Response 200:**
```json
{
  "avatar_url": "https://cdn.son-messenger.com/avatars/uuid.jpg"
}
```

### GET /api/users/search?q={query}

Поиск по имени, username или номеру телефона.

**Query params:**
- `q` (required): строка поиска
- `limit` (default: 20, max: 50)
- `offset` (default: 0)

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
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

### POST /api/users/:id/block

Блокировка пользователя.

**Response 204:** No Content

### DELETE /api/users/:id/block

Разблокировка пользователя.

**Response 204:** No Content

### GET /api/users/blocked

Список заблокированных пользователей.

**Response 200:**
```json
{
  "users": [
    {
      "id": "uuid",
      "display_name": "Спамер",
      "username": "spammer",
      "avatar_url": null,
      "blocked_at": "2026-03-10T12:00:00Z"
    }
  ]
}
```

---

## 3. Devices

### POST /api/devices/push-token

Регистрация push-токена для текущего устройства.

**Request:**
```json
{
  "token": "fcm_or_apns_token_string",
  "platform": "ios",
  "device_name": "iPhone 15 Pro"
}
```

**Response 201:** Created

### DELETE /api/devices/push-token

Удаление push-токена (отключение push-уведомлений для устройства).

**Response 204:** No Content

---

## 4. Contacts

### GET /api/contacts

**Query params:**
- `limit` (default: 50, max: 200)
- `cursor` (optional): `user_id` последнего контакта из предыдущей страницы

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
  ],
  "has_more": true,
  "next_cursor": "uuid_of_last_contact"
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

**Response 201:**
```json
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
```

### PATCH /api/contacts/:id

Обновление никнейма контакта.

**Request:**
```json
{
  "nickname": "Дочка"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "display_name": "Ксенька",
  "phone": "+79001111111",
  "avatar_url": "https://...",
  "nickname": "Дочка"
}
```

### DELETE /api/contacts/:id

**Response 204:** No Content

---

## 5. Chats

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

### GET /api/chats/:id

Получение полного объекта чата.

**Response 200:**
```json
{
  "id": "uuid",
  "type": "group",
  "name": "Семья",
  "avatar_url": "https://...",
  "members": [
    {
      "id": "uuid",
      "display_name": "Владимир",
      "avatar_url": "https://...",
      "role": "admin"
    }
  ],
  "last_message": {
    "id": "uuid",
    "content_preview": "Всем привет!",
    "sender_id": "uuid",
    "created_at": "2026-03-17T14:30:00Z",
    "type": "text"
  },
  "unread_count": 3,
  "is_muted": false,
  "is_archived": false,
  "created_at": "2026-02-01T12:00:00Z",
  "updated_at": "2026-03-17T14:30:00Z"
}
```

### POST /api/chats

Создание нового чата (direct, group или secret).

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

**Response 201:**
```json
{
  "id": "uuid",
  "type": "group",
  "name": "Семья",
  "members": [
    {
      "id": "uuid",
      "display_name": "Владимир",
      "avatar_url": "https://...",
      "role": "admin"
    }
  ],
  "created_at": "2026-03-18T10:00:00Z"
}
```

### PATCH /api/chats/:id

Обновление настроек чата (mute, archive).

**Request:**
```json
{
  "is_muted": true,
  "is_archived": false
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "type": "direct",
  "is_muted": true,
  "is_archived": false,
  "updated_at": "2026-03-18T10:00:00Z"
}
```

### PATCH /api/chats/:id/group-settings

Обновление групповых настроек чата (вместо отдельного POST /api/groups).

**Request:**
```json
{
  "name": "Работа SCIF (обновлено)",
  "description": "Рабочий чат",
  "avatar_url": "https://..."
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "type": "group",
  "name": "Работа SCIF (обновлено)",
  "description": "Рабочий чат",
  "avatar_url": "https://...",
  "updated_at": "2026-03-18T10:00:00Z"
}
```

### DELETE /api/chats/:id

**Response 204:** No Content

---

## 6. Messages

### GET /api/chats/:chat_id/messages

Пагинированная загрузка сообщений (cursor-based).

**Query params:**
- `before` (cursor): message_id — загрузить сообщения СТАРШЕ этого (скролл вверх)
- `after` (cursor): message_id — загрузить сообщения НОВЕЕ этого (подгрузка новых)
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
      "type": "text",
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
  "next_cursor": "uuid_of_oldest_message_in_page"
}
```

### GET /api/chats/:chat_id/messages/search

Поиск по сообщениям внутри чата.

**Query params:**
- `q` (required): строка поиска
- `limit` (default: 20, max: 50)
- `before` (cursor): message_id

**Response 200:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "sender_id": "uuid",
      "sender_name": "Алексей",
      "encrypted_content": "base64...",
      "type": "text",
      "created_at": "2026-03-15T08:00:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### POST /api/chats/:chat_id/messages

**Request:**
```json
{
  "encrypted_content": "base64_encoded_aes256gcm_ciphertext",
  "content_iv": "base64_encoded_12byte_iv",
  "type": "text",
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

**Response 200:**
```json
{
  "reactions": {
    "❤️": ["uuid1", "uuid_current_user"],
    "👍": ["uuid2"]
  }
}
```

### POST /api/chats/:chat_id/messages/:msg_id/forward

Пересылка сообщения в другой чат.

**Request:**
```json
{
  "target_chat_id": "uuid"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "chat_id": "uuid_target",
  "forwarded_from": {
    "chat_id": "uuid_original",
    "message_id": "uuid_original_msg",
    "sender_name": "Алексей"
  },
  "created_at": "2026-03-18T11:00:00Z"
}
```

### DELETE /api/chats/:chat_id/messages/:msg_id

**Response 204:** No Content

---

## 7. Groups

> **Примечание:** создание группы выполняется через `POST /api/chats` с `type: "group"`.
> Обновление названия/описания/аватара — через `PATCH /api/chats/:id/group-settings`.
> Эндпоинты ниже управляют участниками и ролями.

### GET /api/groups/:id

Получение детальной информации о группе с полным списком участников.

**Response 200:**
```json
{
  "id": "uuid",
  "chat_id": "uuid",
  "name": "Работа SCIF",
  "description": "Рабочий чат",
  "avatar_url": null,
  "members": [
    {
      "id": "uuid",
      "display_name": "Владимир",
      "avatar_url": "https://...",
      "role": "admin",
      "joined_at": "2026-02-01T12:00:00Z"
    },
    {
      "id": "uuid2",
      "display_name": "Алексей",
      "avatar_url": "https://...",
      "role": "member",
      "joined_at": "2026-02-01T12:05:00Z"
    }
  ],
  "created_at": "2026-02-01T12:00:00Z",
  "updated_at": "2026-03-18T10:00:00Z"
}
```

### POST /api/groups/:id/members

Добавление участников в группу.

**Request:**
```json
{
  "user_ids": ["uuid5", "uuid6"]
}
```

**Response 201:**
```json
{
  "added": [
    {
      "id": "uuid5",
      "display_name": "Мария",
      "role": "member",
      "joined_at": "2026-03-18T11:00:00Z"
    },
    {
      "id": "uuid6",
      "display_name": "Иван",
      "role": "member",
      "joined_at": "2026-03-18T11:00:00Z"
    }
  ]
}
```

### PATCH /api/groups/:id/members/:user_id

Изменение роли участника группы (только admin).

**Request:**
```json
{
  "role": "admin"
}
```

**Response 200:**
```json
{
  "id": "uuid5",
  "display_name": "Мария",
  "role": "admin",
  "updated_at": "2026-03-18T11:05:00Z"
}
```

### DELETE /api/groups/:id/members/:user_id

Удаление участника (admin) или выход из группы (self).

**Response 204:** No Content

### DELETE /api/groups/:id

Удаление группы (только admin-создатель).

**Response 204:** No Content

---

## 8. Keys (E2E Encryption)

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

**Response 200:**
```json
{
  "updated_at": "2026-03-18T10:00:00Z"
}
```

### POST /api/keys/:user_id/verify

Подтверждение верификации identity key пользователя (safety number check).

**Response 200:**
```json
{
  "verified": true,
  "verified_at": "2026-03-18T10:00:00Z"
}
```

---

## 9. Media

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

## 10. Calls

### POST /api/calls

Инициирование звонка.

**Request:**
```json
{
  "callee_id": "uuid",
  "type": "video"
}
```

**Response 201:**
```json
{
  "call_id": "uuid",
  "turn_credentials": {
    "urls": ["turn:turn.son-messenger.com:3478"],
    "username": "timestamp:user_id",
    "credential": "hmac_based_credential",
    "ttl": 86400
  }
}
```

### GET /api/calls

История звонков с пагинацией.

**Query params:**
- `limit` (default: 30, max: 100)
- `before` (cursor): call_id

**Response 200:**
```json
{
  "calls": [
    {
      "id": "uuid",
      "caller_id": "uuid",
      "callee_id": "uuid",
      "type": "video",
      "status": "completed",
      "started_at": "2026-03-18T09:00:00Z",
      "ended_at": "2026-03-18T09:15:00Z",
      "duration": 900
    }
  ],
  "has_more": true,
  "next_cursor": "uuid_of_oldest_call_in_page"
}
```

### POST /api/calls/:id/answer

Принятие входящего звонка.

**Response 200:**
```json
{
  "call_id": "uuid",
  "status": "active"
}
```

### POST /api/calls/:id/reject

Отклонение входящего звонка.

**Response 200:**
```json
{
  "call_id": "uuid",
  "status": "rejected"
}
```

### GET /api/turn/credentials

Получение TURN-сервер credentials для WebRTC.

**Response 200:**
```json
{
  "urls": ["turn:turn.son-messenger.com:3478", "turns:turn.son-messenger.com:5349"],
  "username": "timestamp:user_id",
  "credential": "hmac_based_credential",
  "ttl": 86400
}
```

---

## 11. WebSocket Events

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

#### Сообщения

**Отправка сообщения:**
```json
{"topic": "chat:uuid", "event": "send_message", "payload": {
  "encrypted_content": "base64...",
  "content_iv": "base64...",
  "type": "text",
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
  "type": "text",
  "created_at": "2026-03-18T10:30:00Z"
}}
```

**Сообщение отредактировано:**
```json
{"topic": "chat:uuid", "event": "message_edited", "payload": {
  "id": "uuid",
  "encrypted_content": "base64_new...",
  "edited_at": "2026-03-18T10:35:00Z"
}}
```

**Сообщение удалено:**
```json
{"topic": "chat:uuid", "event": "message_deleted", "payload": {
  "id": "uuid",
  "deleted_at": "2026-03-18T10:36:00Z"
}}
```

#### Typing

**Typing indicator (начал):**
```json
{"topic": "chat:uuid", "event": "user_typing", "payload": {
  "user_id": "uuid",
  "display_name": "Алексей"
}}
```

**Typing indicator (прекратил):**
```json
{"topic": "chat:uuid", "event": "user_stop_typing", "payload": {
  "user_id": "uuid"
}}
```

#### Delivery / Read

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

#### Reactions

**Реакция добавлена:**
```json
{"topic": "chat:uuid", "event": "reaction_added", "payload": {
  "message_id": "uuid",
  "user_id": "uuid",
  "emoji": "❤️"
}}
```

**Реакция удалена:**
```json
{"topic": "chat:uuid", "event": "reaction_removed", "payload": {
  "message_id": "uuid",
  "user_id": "uuid",
  "emoji": "❤️"
}}
```

#### Чаты и группы

**Чат создан:**
```json
{"topic": "user:uuid", "event": "chat_created", "payload": {
  "chat_id": "uuid",
  "type": "group",
  "name": "Семья",
  "created_by": "uuid"
}}
```

**Чат обновлён:**
```json
{"topic": "chat:uuid", "event": "chat_updated", "payload": {
  "chat_id": "uuid",
  "name": "Семья (обновлено)",
  "is_muted": false,
  "is_archived": false
}}
```

**Участник добавлен:**
```json
{"topic": "chat:uuid", "event": "member_added", "payload": {
  "chat_id": "uuid",
  "user_id": "uuid",
  "display_name": "Мария",
  "added_by": "uuid"
}}
```

**Участник удалён:**
```json
{"topic": "chat:uuid", "event": "member_removed", "payload": {
  "chat_id": "uuid",
  "user_id": "uuid",
  "removed_by": "uuid"
}}
```

#### Presence

**Полное состояние:**
```json
{"topic": "user:uuid", "event": "presence_state", "payload": {
  "user_123": {"is_online": true, "last_seen_at": "..."},
  "user_456": {"is_online": false, "last_seen_at": "..."}
}}
```

**Инкрементальное обновление:**
```json
{"topic": "user:uuid", "event": "presence_diff", "payload": {
  "joins": {"user_789": {"is_online": true, "last_seen_at": "..."}},
  "leaves": {"user_456": {"is_online": false, "last_seen_at": "2026-03-18T10:40:00Z"}}
}}
```

#### Call signaling

**Входящий звонок:**
```json
{"topic": "call:uuid", "event": "call_offer", "payload": {
  "caller_id": "uuid",
  "type": "video",
  "sdp_offer": "..."
}}
```

**Ответ на звонок:**
```json
{"topic": "call:uuid", "event": "call_answer", "payload": {
  "sdp_answer": "..."
}}
```

**ICE candidate:**
```json
{"topic": "call:uuid", "event": "ice_candidate", "payload": {
  "candidate": "..."
}}
```

**Звонок отклонён:**
```json
{"topic": "call:uuid", "event": "call_rejected", "payload": {
  "call_id": "uuid",
  "rejected_by": "uuid"
}}
```

**Пропущенный звонок:**
```json
{"topic": "user:uuid", "event": "call_missed", "payload": {
  "call_id": "uuid",
  "caller_id": "uuid",
  "type": "video",
  "created_at": "2026-03-18T10:30:00Z"
}}
```

**Звонок завершён:**
```json
{"topic": "call:uuid", "event": "call_ended", "payload": {
  "reason": "hangup",
  "duration": 125
}}
```

---

## 12. Rate Limiting

Все ответы API содержат заголовки rate-limit:

| Заголовок | Описание |
|-----------|----------|
| `X-RateLimit-Limit` | Максимум запросов в текущем окне |
| `X-RateLimit-Remaining` | Оставшееся количество запросов |
| `X-RateLimit-Reset` | Unix timestamp сброса окна |

При превышении лимита возвращается `429 Too Many Requests` с заголовком `Retry-After`.

### Лимиты по endpoints

| Endpoint | Лимит | Окно |
|----------|-------|------|
| POST /api/auth/login | 5 | 60 сек |
| POST /api/auth/register | 3 | 300 сек |
| POST /api/chats/:chat_id/messages | 60 | 60 сек |
| POST /api/media/upload | 10 | 60 сек |
| GET /api/chats/:chat_id/messages | 120 | 60 сек |
| GET /api/users/search | 30 | 60 сек |
| WebSocket events (per connection) | 100 | 60 сек |

---

## 13. Error Codes

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
| 503 | `service_unavailable` | Сервис временно недоступен (обслуживание / перегрузка) |

**Формат ошибки:**
```json
{
  "error": "error_code",
  "message": "Человеко-читаемое описание",
  "details": {}
}
```

**Пример ошибки 422 с деталями валидации:**
```json
{
  "error": "unprocessable",
  "message": "Validation failed",
  "details": {
    "phone": ["invalid format"],
    "password": ["too short"]
  }
}
```
