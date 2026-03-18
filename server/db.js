/** Подключение к PostgreSQL и инициализация таблиц */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Создание таблиц при первом запуске */
async function initDB() {
  await pool.query(`
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
      created_by UUID REFERENCES users(id),
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
      created_at TIMESTAMPTZ DEFAULT NOW()
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

    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
  `);
  console.log('✅ Таблицы БД инициализированы');
}

module.exports = { pool, initDB };
