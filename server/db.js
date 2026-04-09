/**
 * P1.1: PostgreSQL подключение + миграции через node-pg-migrate.
 *
 * Ранее initDB() содержал 190 строк DDL (CREATE TABLE IF NOT EXISTS).
 * Теперь схема управляется через SQL-файлы в migrations/:
 *   001_baseline.sql — текущая схема (baseline)
 *   phase-0-hardening.sql — индексы и constraints из Phase 0
 *   ...будущие миграции добавляются как 002_xxx.sql, 003_xxx.sql
 *
 * При старте сервера вызывается runMigrations(), которая применяет
 * все непримененные SQL-файлы из migrations/ в алфавитном порядке.
 * node-pg-migrate создаёт таблицу pgmigrations для трекинга.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Запуск миграций. Вызывается один раз при старте сервера.
 * В тестовом окружении (NODE_ENV=test) миграции не запускаются —
 * тесты используют замоканый pool.
 */
async function initDB() {
  if (process.env.NODE_ENV === 'test') return;

  const { default: migrate } = await import('node-pg-migrate');
  try {
    await migrate({
      databaseUrl: process.env.DATABASE_URL,
      dir: path.join(__dirname, 'migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      // SQL-файлы (не JS)
      decamelize: false,
      log: (msg) => {
        // Тихий вывод — только при реальном применении миграции
        if (msg && !msg.includes('No migrations')) {
          const { logger } = require('./logger');
          logger.info({ migration: msg }, 'db migration');
        }
      },
    });
  } catch (err) {
    // Если миграции не могут применяться (например таблица уже существует
    // с другой структурой) — логируем, но НЕ роняем сервер. Это позволяет
    // существующим БД без pgmigrations таблицы продолжать работу.
    // Для чистого развёртывания миграции применятся корректно.
    const { logger } = require('./logger');
    logger.warn({ err }, 'миграции: не удалось автоматически применить, возможно БД уже актуальна');
  }
}

module.exports = { pool, initDB };
