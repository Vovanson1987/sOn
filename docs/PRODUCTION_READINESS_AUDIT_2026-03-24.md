# sOn Messenger - Production Readiness Audit

**Дата аудита:** 2026-03-24 (Europe/Moscow)  
**Срез:** `dev` branch, monorepo `/Users/vovanson/Desktop/Son`  
**Фокус:** готовность к выводу в production (webApp + server, 1 сервер)  
**Решение:** `NO-GO` до закрытия P0

## 1) Executive Summary

На текущем срезе проект не готов к эксплуатации реальными пользователями в production.  
Основные блокеры:

1. Quality gate не зеленый (`server test`, `web lint`, `vitest`, `web build` падают).
2. Небезопасная и несогласованная модель авторизации (cookie + токен в JSON + localStorage на клиенте).
3. Слишком широкий CORS для credentialed запросов.
4. Риски в контуре хранения/загрузки файлов (insecure defaults и слабая серверная валидация upload).
5. Нет стабильного staging-deploy контура (SSH timeout в GitHub Actions).

## 2) Что проверено

Проверены:

- Код backend: `server/index.js`, `server/db.js`, `server/storage.js`
- Код frontend: `webApp/src/stores/authStore.ts`, `webApp/src/api/client.ts`, `webApp/src/utils/fileUpload.ts`, conversation-компоненты/сторы
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy.yml`
- Infra/ops: `docker-compose.prod.yml`, `deploy.sh`, `scripts/backup.sh`, `scripts/healthcheck.sh`, `docs/STAGING_PROD_RUNBOOK.md`
- Гейты качества локально: server tests, lint, vitest, playwright, build

## 3) Статус quality gate на момент аудита

| Gate | Статус |
|---|---|
| `server: npm test` | FAIL |
| `webApp: npm run lint` | FAIL |
| `webApp: npx vitest run` | FAIL |
| `webApp: npm run build` | FAIL |
| `webApp: npx playwright test` | PASS |

Примечание: для production нужен полностью зеленый набор gate, не частичный.

## 4) P0 Findings (блокируют production)

### P0-1. Quality gate красный

Падения тестов/линта/сборки означают высокий риск регрессий и непредсказуемого поведения в проде.

### P0-2. Auth-модель небезопасна и противоречива

- Сервер возвращает JWT и в `httpOnly` cookie, и в JSON теле ответа.
- Клиент хранит токен в `localStorage`.
- Одновременно часть клиента построена на cookie-flow.

Это создает лишнюю поверхность для кражи токена и ломает единый auth-контур.

Evidence:

- `server/index.js:143-153`
- `server/index.js:171-182`
- `webApp/src/stores/authStore.ts:30`
- `webApp/src/stores/authStore.ts:42`
- `webApp/src/api/client.ts:5-24`

### P0-3. CORS слишком широкий при `credentials: true`

Разрешены wildcard/tunnel-origin для credentialed запросов, что недопустимо для production.

Evidence:

- `server/index.js:67-78`

### P0-4. Контур хранения файлов имеет insecure defaults

- По умолчанию используется `MINIO_USE_SSL=false`.
- Формирование ссылок опирается на локальный URL.

Evidence:

- `server/storage.js:8-13`
- `server/storage.js:46`

### P0-5. Недостаточная серверная валидация upload

Отсутствует строгий allowlist + проверка сигнатур файла (magic bytes), что опасно для публичной эксплуатации.

Evidence:

- `server/index.js:1325-1337`

### P0-6. Миграции БД выполняются как runtime DDL на старте

Нет версионированной системы миграций, повышен риск drift и аварий при релизах.

Evidence:

- `server/db.js:8-191`

### P0-7. Staging deploy контур нестабилен

Последний staging deploy упал из-за SSH timeout.

Evidence:

- GitHub Actions run: https://github.com/Vovanson1987/sOn/actions/runs/23464082070

## 5) P1 Findings (исправить до/сразу после запуска)

1. Бэкапы ограничены локальными SQL dump, нет offsite retention и регулярной проверки restore (`scripts/backup.sh`).
2. Healthcheck-скрипт привязан к macOS/launchctl и не является универсальным production-решением (`scripts/healthcheck.sh`).
3. Архитектурный drift: в репозитории два параллельных backend-контура (`server` и `backend/*`) без формально закрепленного production пути.
4. Слабая эксплуатационная документация в корне (`README.md` почти пуст).

## 6) Fastest Path в production (1 сервер)

### Шаг 1. Закрыть P0 по безопасности auth

1. Оставить только cookie-based auth (`httpOnly`, `Secure`, `SameSite`) и убрать токен из JSON ответа.
2. Удалить `localStorage`-хранение токена на web.
3. Свести CORS к точному allowlist (`staging`/`prod` домены), убрать tunnel wildcard для production.

### Шаг 2. Закрыть P0 по файлам/данным

1. Включить TLS в object storage контуре.
2. Исправить публичный base URL для файлового API.
3. Добавить строгую валидацию upload: MIME + extension + magic bytes + лимиты размера.

### Шаг 3. Закрыть P0 по качеству

Починить все падения и зафиксировать обязательный релизный gate:

```bash
cd server && npm test
cd ../webApp && npm run lint
cd ../webApp && npx vitest run
cd ../webApp && npx playwright test
cd ../webApp && npm run build
```

### Шаг 4. Вернуть staging deploy в рабочее состояние

1. Починить SSH-доступ для GitHub Actions.
2. Прогнать staging smoke по `docs/STAGING_PROD_RUNBOOK.md`.
3. Убедиться, что rollback-путь протестирован.

## 7) Go/No-Go критерии для production

Разрешено выкатывать в production только если одновременно выполнено:

1. Все quality gates - PASS.
2. Все P0 закрыты.
3. Staging smoke и rollback rehearsal - PASS.
4. Есть валидный backup + проверенный restore.
5. Настроены базовые мониторинг/алерты (5xx, latency, DB/Redis health, disk, cert expiry).

## 8) Рекомендация по исполнению

При текущем состоянии рекомендуется идти в следующем порядке:

1. `P0 auth + CORS`
2. `P0 upload/storage hardening`
3. `Fix tests/lint/build`
4. `Staging smoke`
5. `Production rollout`

До закрытия перечисленных шагов выход в production не рекомендован.
