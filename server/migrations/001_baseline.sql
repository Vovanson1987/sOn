-- ============================================================
-- Baseline migration — зафиксировать текущую схему.
--
-- Эта миграция содержит ВСЕ таблицы, индексы и constraints,
-- которые ранее создавались через initDB() в db.js.
-- Все DDL — идемпотентные (IF NOT EXISTS / IF NOT EXISTS).
--
-- Для свежей БД: создаётся полная схема.
-- Для существующей БД: ничего не изменится (всё уже есть).
-- ============================================================

-- Таблицы

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  password_hash VARCHAR(255) NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL DEFAULT 'direct',
  name VARCHAR(200),
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',
  unread_count INT DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  reply_to UUID,
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  self_destruct_at TIMESTAMPTZ,
  e2ee_nonce TEXT,
  e2ee_header JSONB,
  e2ee_algorithm VARCHAR(64),
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id),
  file_name VARCHAR(500),
  file_size BIGINT,
  mime_type VARCHAR(100),
  url TEXT,
  object_name VARCHAR(500),
  duration INT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_key TEXT NOT NULL,
  signing_key TEXT NOT NULL,
  signed_prekey TEXT NOT NULL,
  signed_prekey_id INT NOT NULL,
  signed_prekey_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS one_time_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id INT NOT NULL,
  public_key TEXT NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, contact_id)
);

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

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES users(id),
  callee_id UUID REFERENCES users(id),
  is_video BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'missed',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы (baseline)

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(last_message_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_prekeys_user ON prekeys(user_id);
CREATE INDEX IF NOT EXISTS idx_otpk_user ON one_time_prekeys(user_id, used);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_call_history_users ON call_history(caller_id, callee_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
