-- ============================================================
-- Phase 2 batch 2: RBAC, Polls, URL Preview
-- ============================================================

-- P2.2: RBAC — гранулярные права в группах
-- Роли: owner (создатель), admin, member.
-- Права хранятся в JSONB-колонке permissions на chat_members,
-- чтобы не усложнять схему отдельной таблицей permissions.
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Дефолтные права по ролям:
-- owner: всё (не ограничивается permissions, hardcoded в коде)
-- admin: can_pin, can_delete_messages, can_invite, can_change_info
-- member: только базовые действия (отправка, реакции)

-- P2.9: Polls (опросы)
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_multiple_choice BOOLEAN DEFAULT false,
  is_anonymous BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text VARCHAR(200) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_polls_message ON polls(message_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id, poll_id);

-- P2.10: URL Preview — кэш OG-тегов
CREATE TABLE IF NOT EXISTS og_cache (
  url_hash VARCHAR(64) PRIMARY KEY,
  url TEXT NOT NULL,
  title VARCHAR(500),
  description VARCHAR(1000),
  image_url TEXT,
  site_name VARCHAR(200),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
