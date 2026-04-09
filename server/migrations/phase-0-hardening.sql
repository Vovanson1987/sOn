-- ============================================================
-- sOn Messenger — Phase 0 DB Hardening
-- Применять concurrently, безопасно на работающей БД.
--
-- Запуск на VPS:
--   docker exec -i son-postgres psql -U son son_prod < server/migrations/phase-0-hardening.sql
--
-- Изменения:
--   DB-1  исправить направление idx_messages_chat (ASC → DESC)
--   DB-2  добавить FTS-колонку content_tsv + GIN-индекс для поиска
--   + partial index на one_time_prekeys (used = false)
--   + индексы sender_id, call_history(created_at DESC)
--   + FK messages.reply_to → messages(id) ON DELETE SET NULL
--   + CHECK constraints на type-колонках и длину content
--   + индекс blocked_users(blocked_id, blocker_id) для обратной проверки
-- ============================================================

-- DB-1: горячий путь загрузки сообщений использует DESC
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_chat;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id_created
    ON messages(chat_id, created_at DESC);

-- Partial index для one_time_prekeys — выдача OPK ускоряется
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_otpk_unused
    ON one_time_prekeys(user_id, created_at ASC)
    WHERE used = false;

-- Индекс на sender_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender
    ON messages(sender_id);

-- Индекс на call_history(created_at DESC) — сортировка истории звонков
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_history_created
    ON call_history(created_at DESC);

-- DB-2: Full-Text Search для messages.content вместо ILIKE '%...%'
-- Генерируемая колонка — не нужно триггеров.
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('russian', coalesce(content, ''))) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_fts
    ON messages USING GIN(content_tsv);

-- После применения в коде /api/messages/search заменить:
--   WHERE m.content ILIKE $2            -- старое (seq scan)
-- на:
--   WHERE m.content_tsv @@ plainto_tsquery('russian', $1)

-- FK для messages.reply_to (ON DELETE SET NULL не ломает тред)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_messages_reply_to'
          AND table_name = 'messages'
    ) THEN
        ALTER TABLE messages
            ADD CONSTRAINT fk_messages_reply_to
            FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- CHECK constraints для enum-подобных VARCHAR полей
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chats_type_check') THEN
        ALTER TABLE chats ADD CONSTRAINT chats_type_check
            CHECK (type IN ('direct', 'group', 'secret'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_type_check') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_type_check
            CHECK (type IN ('text', 'image', 'file', 'audio', 'video', 'voice', 'system'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_content_length') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_content_length
            CHECK (length(content) <= 30000);
    END IF;
END $$;

-- Индекс для blocked_users — обратная проверка "кто заблокировал меня"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocked_users_blocked_id
    ON blocked_users(blocked_id, blocker_id);

-- Обновить статистику планировщика
ANALYZE messages;
ANALYZE chat_members;
ANALYZE one_time_prekeys;
ANALYZE blocked_users;
ANALYZE call_history;
