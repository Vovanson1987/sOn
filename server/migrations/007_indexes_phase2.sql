-- 007: Индексы из аудита Phase 2
-- C-D8: Индекс на messages(reply_to) — ускоряет ON DELETE SET NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_reply_to
    ON messages(reply_to) WHERE reply_to IS NOT NULL;

-- Индекс на sessions для сортировки по активности
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active
    ON sessions(user_id, last_active_at DESC) WHERE is_revoked = false;

-- Индекс на phone_verifications для rate-limit проверки
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_phone_verifications_phone_time
    ON phone_verifications(phone, created_at DESC) WHERE used = false;

-- Индекс на contacts(contact_id) для CASCADE при удалении пользователя
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_contact_id
    ON contacts(contact_id);

-- Индекс на og_cache(fetched_at) для TTL-очистки
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_og_cache_fetched
    ON og_cache(fetched_at);
