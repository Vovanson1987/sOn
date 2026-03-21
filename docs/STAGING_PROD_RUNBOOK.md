# STAGING + PRODUCTION RUNBOOK (webApp + server)

## 1. Что уже автоматизировано

- `scripts/smoke-web-server.mjs` — smoke для реального API-потока.
- `scripts/staging-smoke.sh` — удобный обёрточный запуск smoke.
- `deploy.sh` — после деплоя запускает smoke (если `RUN_SMOKE=1`).
- `.github/workflows/deploy-staging.yml` — деплой `dev` в staging + smoke.
- `.github/workflows/deploy.yml` — деплой `master` в production + smoke.

## 2. Что проверяет smoke

1. `/health` доступен.
2. Регистрируются 2 пользователя.
3. Создаётся `secret` чат.
4. `plaintext` в `secret` чате отклоняется (`400`).
5. Сообщение `ciphertext + e2ee` сохраняется.
6. Получатель видит только `ciphertext` и `e2ee_*` metadata.
7. В `/api/chats` preview для `secret` чата скрыт (`🔒 Зашифрованное сообщение`).
8. В конце удаляется тестовый smoke-чат (cleanup).

## 3. Ручной запуск smoke

```bash
./scripts/staging-smoke.sh https://staging.example.com
```

или

```bash
SMOKE_BASE_URL=https://staging.example.com node ./scripts/smoke-web-server.mjs
```

По умолчанию используются фиксированные smoke-аккаунты:

- `smoke-user1@son.local`
- `smoke-user2@son.local`

Параметры можно переопределить:

- `SMOKE_USER1_EMAIL`
- `SMOKE_USER2_EMAIL`
- `SMOKE_USER1_NAME`
- `SMOKE_USER2_NAME`
- `SMOKE_PASSWORD`

Для одноразовых пользователей (локально/отладка):

```bash
SMOKE_EPHEMERAL=1 SMOKE_BASE_URL=https://staging.example.com node ./scripts/smoke-web-server.mjs
```

## 4. GitHub Secrets для автодеплоя

### Staging

- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_SSH_KEY`
- `STAGING_BASE_URL`

### Production

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`
- `PRODUCTION_BASE_URL`

## 5. Gate перед production

Переход в production разрешён только если:

1. Локальный gate зелёный (`server test + web lint + vitest + playwright + build`).
2. Staging deploy зелёный.
3. Staging smoke зелёный.
4. Нет блокирующих ошибок в логах после staging smoke (минимум 15 минут наблюдения).

## 6. Быстрый rollback

На сервере:

```bash
cd /opt/son-messenger
git log --oneline -n 5
git checkout <previous_commit>
docker compose -f docker-compose.prod.yml up -d --build
```

После rollback обязательно повторить smoke:

```bash
SMOKE_BASE_URL=https://production.example.com node ./scripts/smoke-web-server.mjs
```
