-- ============================================================
-- Phase 2 batch 3: Каналы (broadcast), Stories, Видеосообщения
-- ============================================================

-- P2.7: Каналы (broadcast)
-- Каналы — отдельная сущность от чатов. Только admin/owner публикуют,
-- подписчики читают. Комментарии — через linked chat (Phase 3).

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  subscriber_count INT DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'subscriber',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  attachment_url TEXT,
  views_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_posts_channel ON channel_posts(channel_id, created_at DESC);

-- P2.11: Stories (исчезающий контент 24ч)
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL DEFAULT 'image',
  caption TEXT,
  views_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);

-- P2.14: Видеосообщения — новый тип в messages
-- Тип 'video_note' добавляется в CHECK constraint (если есть).
-- Обновляем CHECK на messages.type чтобы включить video_note.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_type_check' AND table_name = 'messages') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_type_check
    CHECK (type IN ('text', 'image', 'file', 'audio', 'video', 'voice', 'system', 'poll', 'video_note'));
END $$;
