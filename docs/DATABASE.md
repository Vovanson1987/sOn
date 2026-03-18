# sOn Messenger — Database Schema

## 1. PostgreSQL — Users, Contacts, Groups, Metadata

### 1.1 users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(20) UNIQUE NOT NULL,
    username        VARCHAR(50) UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    status_text     VARCHAR(200) DEFAULT '',
    last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
    is_online       BOOLEAN DEFAULT FALSE,
    -- Privacy settings
    show_online     VARCHAR(20) DEFAULT 'everyone',     -- everyone | contacts | nobody
    read_receipts   BOOLEAN DEFAULT TRUE,
    -- Security
    password_hash   TEXT NOT NULL,                       -- Argon2id
    identity_key    BYTEA NOT NULL,                      -- Curve25519 public identity key
    signed_prekey   BYTEA NOT NULL,                      -- Signed pre-key (rotated weekly)
    signed_prekey_sig BYTEA NOT NULL,                    -- Signature of signed pre-key
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_online ON users(is_online);
```

### 1.2 one_time_prekeys (для X3DH)

```sql
CREATE TABLE one_time_prekeys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id      INTEGER NOT NULL,
    public_key  BYTEA NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_id)
);

CREATE INDEX idx_prekeys_user_unused ON one_time_prekeys(user_id, used)
    WHERE used = FALSE;
```

### 1.3 contacts

```sql
CREATE TABLE contacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname    VARCHAR(100),
    is_blocked  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id)
);

CREATE INDEX idx_contacts_user ON contacts(user_id);
```

### 1.4 chats

```sql
CREATE TYPE chat_type AS ENUM ('direct', 'group', 'secret');

CREATE TABLE chats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            chat_type NOT NULL DEFAULT 'direct',
    -- Group chat fields
    name            VARCHAR(200),
    avatar_url      TEXT,
    description     TEXT,
    created_by      UUID REFERENCES users(id),
    -- Secret chat fields
    is_verified     BOOLEAN DEFAULT FALSE,
    self_destruct   INTEGER,                 -- секунды (NULL = выкл)
    -- Counters (denormalized for performance)
    member_count    INTEGER DEFAULT 2,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
```

### 1.5 chat_members

```sql
CREATE TYPE member_role AS ENUM ('admin', 'member');

CREATE TABLE chat_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            member_role DEFAULT 'member',
    unread_count    INTEGER DEFAULT 0,
    is_muted        BOOLEAN DEFAULT FALSE,
    is_archived     BOOLEAN DEFAULT FALSE,
    last_read_at    TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);
```

### 1.6 secret_chat_sessions

```sql
CREATE TABLE secret_chat_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id             UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    initiator_id        UUID NOT NULL REFERENCES users(id),
    responder_id        UUID NOT NULL REFERENCES users(id),
    -- Key exchange data (X3DH)
    shared_secret_hash  BYTEA,              -- SHA-256 hash для верификации
    -- Double Ratchet state
    ratchet_index       INTEGER DEFAULT 0,
    -- Verification
    is_verified         BOOLEAN DEFAULT FALSE,
    verified_at         TIMESTAMPTZ,
    emoji_fingerprint   TEXT,               -- Cached emoji grid
    hex_fingerprint     TEXT,               -- Cached hex string
    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ
);

CREATE INDEX idx_secret_sessions_chat ON secret_chat_sessions(chat_id);
```

### 1.7 devices

```sql
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     VARCHAR(100),
    platform        VARCHAR(20),            -- web, android, ios, desktop
    push_token      TEXT,                   -- FCM / APNs / Web Push token
    identity_key    BYTEA NOT NULL,         -- Per-device identity key
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON devices(user_id);
```

### 1.8 attachments (metadata only)

```sql
CREATE TYPE attachment_type AS ENUM ('image', 'video', 'audio', 'file', 'voice', 'location');

CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL,          -- Reference to ScyllaDB message
    chat_id         UUID NOT NULL REFERENCES chats(id),
    uploader_id     UUID NOT NULL REFERENCES users(id),
    type            attachment_type NOT NULL,
    file_name       VARCHAR(500),
    file_size       BIGINT,                 -- bytes
    mime_type       VARCHAR(100),
    storage_key     TEXT NOT NULL,           -- MinIO object key
    thumbnail_key   TEXT,                    -- MinIO thumbnail key
    width           INTEGER,                -- For images/videos
    height          INTEGER,
    duration        INTEGER,                -- For audio/video (seconds)
    -- Location
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    -- Encryption
    encrypted_key   BYTEA,                  -- File encryption key (encrypted with message key)
    iv              BYTEA,                  -- AES-GCM IV
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_chat ON attachments(chat_id);
CREATE INDEX idx_attachments_message ON attachments(message_id);
```

---

## 2. ScyllaDB — Messages

### 2.1 messages (partitioned by chat_id)

```cql
CREATE TABLE messenger.messages (
    chat_id         UUID,
    message_id      TIMEUUID,
    sender_id       UUID,
    -- Content (encrypted for secret chats)
    encrypted_content BLOB,                 -- AES-256-GCM ciphertext
    content_iv      BLOB,                   -- AES-GCM IV (12 bytes)
    content_type    TEXT,                    -- text, image, file, voice, location, system
    -- Reply
    reply_to_id     TIMEUUID,
    reply_preview   TEXT,                    -- First 100 chars of replied message
    -- Delivery
    status          TEXT,                    -- sent, delivered, read, failed
    delivered_at    TIMESTAMP,
    read_at         TIMESTAMP,
    -- Self-destruct
    self_destruct_at TIMESTAMP,             -- When to delete (NULL = permanent)
    is_destroyed    BOOLEAN,
    -- Reactions
    reactions       MAP<TEXT, FROZEN<SET<UUID>>>,  -- emoji → set of user_ids
    -- Metadata
    has_attachment  BOOLEAN,
    is_edited       BOOLEAN,
    edited_at       TIMESTAMP,
    is_forwarded    BOOLEAN,
    -- System message
    system_event    TEXT,                    -- member_joined, member_left, group_created, ...
    created_at      TIMESTAMP,
    PRIMARY KEY (chat_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
  AND default_time_to_live = 0
  AND gc_grace_seconds = 864000;
```

### 2.2 messages_by_user (for search)

```cql
CREATE MATERIALIZED VIEW messenger.messages_by_user AS
    SELECT *
    FROM messenger.messages
    WHERE sender_id IS NOT NULL
      AND chat_id IS NOT NULL
      AND message_id IS NOT NULL
    PRIMARY KEY (sender_id, message_id, chat_id)
    WITH CLUSTERING ORDER BY (message_id DESC);
```

---

## 3. Redis — Cache, Sessions, Presence

### 3.1 Структуры данных

```
# Сессии пользователей
session:{session_id}          → JSON{user_id, device_id, created_at, expires_at}
                                TTL: 30 days

# Refresh tokens
refresh:{user_id}:{device_id} → refresh_token_hash
                                TTL: 30 days

# Онлайн-статусы (presence)
presence:{user_id}            → JSON{is_online, last_seen_at, device}
                                TTL: 5 minutes (heartbeat refresh)

# Typing indicators
typing:{chat_id}:{user_id}   → "1"
                                TTL: 5 seconds

# Rate limiting
ratelimit:{user_id}:login     → counter
                                TTL: 60 seconds, max: 5

ratelimit:{user_id}:messages  → counter
                                TTL: 60 seconds, max: 60

# Unread counts cache
unread:{user_id}:{chat_id}   → count
                                TTL: none (invalidated on read)

# Pre-key bundle cache
prekeys:{user_id}             → JSON{identity_key, signed_prekey, one_time_prekeys[]}
                                TTL: 1 hour
```

---

## 4. MinIO (S3) — Object Storage

### 4.1 Bucket Structure

```
messenger-media/
├── avatars/
│   └── {user_id}/
│       ├── original.jpg       # Оригинал
│       └── thumb_100.jpg      # Thumbnail 100×100
│
├── attachments/
│   └── {chat_id}/
│       └── {message_id}/
│           ├── {filename}           # Оригинальный файл (encrypted)
│           └── thumb_{filename}     # Thumbnail (для изображений)
│
├── voice/
│   └── {chat_id}/
│       └── {message_id}.opus        # Голосовое сообщение (encrypted)
│
└── temp/
    └── {upload_id}/                 # Временные файлы при загрузке
                                     # TTL: 24 часа
```

### 4.2 Политики доступа
- Все файлы доступны ТОЛЬКО через pre-signed URLs (срок: 1 час)
- Загрузка: pre-signed PUT URL с ограничением по размеру (50MB)
- Скачивание: pre-signed GET URL
- Аватары: публичный read-only доступ (CDN)

---

## 5. Миграции

### Порядок миграций

```
001_create_users.sql
002_create_one_time_prekeys.sql
003_create_contacts.sql
004_create_chats.sql
005_create_chat_members.sql
006_create_secret_chat_sessions.sql
007_create_devices.sql
008_create_attachments.sql
009_create_indexes.sql
010_seed_data.sql              # Тестовые данные для dev
```

---

## 6. Диаграмма связей (ER)

```
users 1──N one_time_prekeys
users 1──N contacts
users 1──N devices
users 1──N chat_members
chats 1──N chat_members
chats 1──1 secret_chat_sessions
chats 1──N attachments
chats 1──N messages (ScyllaDB)
```
