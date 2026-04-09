-- ============================================================
-- Phase 2: Invite links, Forwarded messages, Pinned, @Mentions
-- ============================================================

-- P2.1: Invite links для групповых чатов
CREATE TABLE IF NOT EXISTS chat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  token VARCHAR(32) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  max_uses INT,
  uses_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_invites_token ON chat_invites(token);
CREATE INDEX IF NOT EXISTS idx_chat_invites_chat ON chat_invites(chat_id);

-- P2.3: Forwarded messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_chat_name VARCHAR(200);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_sender_name VARCHAR(100);

-- P2.4: Pinned messages
ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned_message_id UUID;

-- P2.6: @mentions — массив UUID упомянутых пользователей
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[];
