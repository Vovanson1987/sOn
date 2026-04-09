# sOn Messenger

Защищённый мессенджер с end-to-end шифрованием (Signal-протокол), аудио/видеозвонками через WebRTC и PWA-поддержкой.

## Стек

| Слой | Технология |
|------|-----------|
| **Backend** | Node.js (Express 5), PostgreSQL 16, Redis 7, MinIO |
| **Frontend** | React 19, TypeScript, Vite, Zustand, Tailwind CSS 4 |
| **E2EE** | libsodium — X3DH + Double Ratchet (Signal-протокол) |
| **Звонки** | WebRTC + coturn (TURN/STUN) |
| **Desktop** | Tauri 2 (Rust, каркас) |
| **Deploy** | Docker Compose + Cloudflare Tunnel |
| **CI** | GitHub Actions — lint, types, tests, audit, build |
| **Observability** | Pino (structured logs), Sentry (error tracking) |

## Быстрый старт (dev)

```bash
# Поднять инфраструктуру (postgres, redis, minio)
docker compose -f docker-compose.yml up -d postgres redis minio

# Backend
cd server && npm install && npm start

# Frontend (в другом терминале)
cd webApp && npm install && npm run dev
```

Откроется на `http://localhost:5173`.

## Production (VPS)

```bash
# Клонировать
git clone git@github.com:Vovanson1987/sOn.git /srv/son
cd /srv/son

# Создать .env из примера и заполнить секреты
cp .env.example .env
nano .env  # JWT_SECRET, POSTGRES_PASSWORD, MINIO_*, VAPID_*, CLOUDFLARE_TUNNEL_TOKEN

# Собрать и запустить
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml -f docker-compose.cloudflared.yml up -d \
  postgres redis minio api web coturn cloudflared

# Проверить
docker compose -f docker-compose.prod.yml -f docker-compose.cloudflared.yml ps
curl -I https://chat.sonchat.uk/
```

Подробная инструкция: [docs/DEPLOY.md](docs/STAGING_PROD_RUNBOOK.md)

## Переменные окружения

Полный список: [.env.example](.env.example)

Обязательные для production:

| Переменная | Описание |
|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `JWT_SECRET` | Секрет JWT (min 32 символа) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Ключи MinIO |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | VAPID для Web Push |
| `CLOUDFLARE_TUNNEL_TOKEN` | Токен Cloudflare Tunnel |

## Тесты

```bash
# Backend (Jest)
cd server && npm test

# Frontend (Vitest)
cd webApp && npx vitest run

# Frontend с покрытием
npx vitest run --coverage

# E2E (Playwright, mocked API)
cd webApp && npx playwright test
```

## Структура проэкта

```
server/           # Node.js API + WebSocket
  index.js        # Все роуты + WS signaling (~1700 строк)
  db.js           # PostgreSQL pool + миграции (node-pg-migrate)
  storage.js      # MinIO — загрузка/скачивание файлов
  logger.js       # Pino structured logging
  sentry.js       # Sentry error tracking
  migrations/     # SQL-миграции
  __tests__/      # Jest тесты

webApp/           # React SPA
  src/
    api/          # HTTP-клиент + WebSocket
    components/   # UI-компоненты по экранам
    stores/       # Zustand stores (auth, chat, message, call, secretChat, settings)
    crypto/       # E2EE: X3DH, Double Ratchet, encrypt, keyStore
    lib/          # Sentry, утилиты
  e2e/            # Playwright E2E тесты
  nginx.conf      # Nginx для production (CSP, proxy, gzip)

desktop/          # Tauri 2 desktop обёртка (каркас)
scripts/          # Бэкапы, восстановление, watchdog
docs/             # Аудит, архитектура, документация
```

## Бэкапы

```bash
# Ручной бэкап (postgres + minio)
./scripts/backup.sh

# Только postgres
./scripts/backup.sh --pg-only

# Тест восстановления
./scripts/restore-test.sh
```

Автоматический бэкап: cron ежедневно в 03:17 (настроен на VPS).
Offsite: через `rclone` если `BACKUP_REMOTE` задан в `.env`.

## Аудит и roadmap

Полный аудит проэкта: [docs/AUDIT_2026-04-09.md](docs/AUDIT_2026-04-09.md)

Содержит:
- 5 критических уязвимостей (закрыты в Phase 0)
- Gap-анализ vs Telegram
- Roadmap Phase 0/1/2/3
- SQL-скрипт для DB hardening
- Чек-листы по фазам

## Лицензия

Private.
