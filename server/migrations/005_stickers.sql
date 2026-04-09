-- ============================================================
-- Phase 2 batch 4: Стикеры
-- ============================================================

CREATE TABLE IF NOT EXISTS sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  cover_url TEXT,
  author_id UUID REFERENCES users(id),
  is_official BOOLEAN DEFAULT false,
  sticker_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  emoji VARCHAR(10),
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) DEFAULT 'webp',
  width INT DEFAULT 512,
  height INT DEFAULT 512,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Какие паки пользователь добавил себе
CREATE TABLE IF NOT EXISTS user_sticker_packs (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_stickers_pack ON stickers(pack_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_user_sticker_packs_user ON user_sticker_packs(user_id);

-- Обновить CHECK на messages.type — добавить 'sticker'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_type_check' AND table_name = 'messages') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_type_check
    CHECK (type IN ('text','image','file','audio','video','voice','system','poll','video_note','sticker'));
END $$;
