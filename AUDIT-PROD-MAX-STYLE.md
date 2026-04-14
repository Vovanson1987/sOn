# Комплексный аудит мессенджера sOn — готовность к проду в стиле MAX

Дата: 2026-04-14
Цель: вывести мессенджер в продакшен с визуальным языком, близким к мессенджеру MAX (max.ru от VK).

---

## 1. Архитектура (кратко)

Monorepo с чётким разделением:

- **server/** — Node.js 20 + Express 5, PostgreSQL 16, Redis 7, MinIO, WebSocket (ws 8.19), JWT HS256, bcrypt cost=12, VAPID Web Push. ~1800 строк в `server/index.js`.
- **webApp/** — React 19 + TS 5.9 + Vite 6, Zustand, react-router 7, react-window 2, Tailwind CSS 4. Тесты Vitest (341+), Playwright E2E.
- **desktop/** — Tauri 2 (Rust + WebView) как обёртка над webApp.
- **androidApp/** — Kotlin 2.0 + Jetpack Compose, Material3, Koin, Coil. Пока **каркас**.
- **iosApp/** — Swift + SwiftUI. Пока **каркас**.
- **shared/** — общий код (KMP).
- **livekit/ + coturn/** — звонки (WebRTC SFU + TURN/STUN).
- **mcp-bridge/** — интеграция с Claude/MCP.

E2EE реализовано по Signal-протоколу (X3DH + Double Ratchet), IndexedDB-keyStore в браузере.

---

## 2. Оценка готовности по компонентам

| Компонент | Оценка | Комментарий |
|---|---|---|
| E2EE (Signal) | 4/5 | Сильная сторона, constant-time сравнения |
| Messaging | 3.5/5 | Работает, но silent failures в broadcast |
| Web UI | 3.5/5 | MAX-подобная тёмная тема, но desktop-layout слабый |
| Backend | 3/5 | Стабильно, но N+1, слабая observability |
| Auth | 3/5 | Только email+password, нет 2FA/SMS |
| Calls 1:1 | 2.5/5 | Работает, group calls нет |
| Desktop (Tauri) | 1/5 | Только обёртка |
| Android | 0.5/5 | Gradle-конфиг, UI нет |
| iOS | 0.5/5 | Структура папок, .swift файлов нет |
| Tests | 1.5/5 | ~43% API coverage, E2E не в CI |
| Observability | 1/5 | console.log + Sentry в deps, не подключён |
| Документация | 4/5 | AUDIT-PLAN, PROMPT-REMAINING и т.д. |

**Общая готовность к проду: ~40%.**

---

## 3. Backend — критические блокеры

1. **JWT в localStorage (XSS-риск).** httpOnly cookie + cookie-parser уже добавлены на бэке — нужно выключить localStorage-fallback во фронте.
2. **MIME-валидация аплоада слабая** — можно залить `.exe` под видом картинки. Добавить whitelist MIME + расширений (`isAllowedMime` уже есть в `server/storage.js`, применить повсеместно).
3. **IDOR на `GET /api/attachments/:key`** — не проверяется членство в чате. Добавить `chatMemberCheck`.
4. **WS signaling без проверки участников чата** — можно слать сигнал в чужой чат.
5. **reply_to без проверки** что сообщение принадлежит тому же чату.
6. **Silent failures в `broadcastToChat`** — без `await` и `try/catch`: сообщение считается доставленным, а не ушло.
7. **N+1 в `/api/chats`** — цикл по members; заменить на JOIN.
8. **Индекс `messages`** создан в `(chat_id, created_at)`, а читается с `DESC` — пересоздать.
9. **Нет FTS-индекса** (trgm/GIN `to_tsvector('russian', content)`) для поиска.
10. **Миграции не версионированы** — нет tracking-таблицы.
11. **Нет graceful shutdown** для WS (`server.close()` + drain).
12. **Нет Prometheus/Grafana**, Sentry не инициализирован.

---

## 4. Web (webApp) — UI-гапы к стилю MAX

Что уже похоже на MAX:

- Тёмная тема (`#16161a`, `#1e1e2e`, `#141420`), акцент `#5B5FC7`.
- Скруглённые message bubbles (18px), группировка, аватары 48px с градиентом.
- Unread-бейджи, date-separators по центру.

Что **нужно довести** до уровня MAX:

### 4.1 Layout и навигация

- Нет полноценного **3-колоночного desktop-layout** (sidebar 68px + список 360px + контент flex-1). Сейчас доминирует мобильная парадигма с табами.
- Нет **responsive-брейкпоинтов**: на мобилке sidebar должен превращаться в bottom-nav, на десктопе — оставаться вертикальным слева.
- Нет **URL-роутинга** (react-router подключён, но App.tsx держит state в Zustand) — прямые ссылки на чат/настройки не работают.

### 4.2 Компонентная дизайн-система

- Цвета и отступы **захардкожены** в JSX, нет `Typography`, `CellSimple`, `Avatar.Container/Image/Text` как в MAX. Нужно вынести в `design-tokens` и набор примитивов (Button, Cell, ListItem, Sheet, Toast, Skeleton).
- Нет **тёмной/светлой темы** через CSS-переменные — MAX поддерживает обе.
- Нет **toast/notification** системы и **skeleton-загрузки** (вместо пустых экранов).
- Нет **empty states** с иконками («Нет чатов», «Нет контактов»).
- Input-поля без clear-кнопки, без валидационного фидбека.

### 4.3 Список чатов (ChatListItem)

- Нет **pinned/muted icons** (булавка, перечёркнутый колокольчик).
- Нет **online-статуса** (зелёная точка на аватаре) и last-seen.
- Нет **swipe-actions** (archive/mute/delete) на мобилке.
- Нет **context-menu** на правый клик/long-press.
- Нет секции «Избранное» / «Архив».

### 4.4 Экран чата (ConversationScreen)

- `react-window` установлен, но **не интегрирован** — крупные чаты будут тормозить.
- **Typing-indicator** не анимируется (точки не «прыгают»).
- **Tapback/reactions** позиционируется некорректно (должен перекрывать bubble на -4px).
- Нет URL-preview с favicon, inline-кнопок, опросов.
- Нет mention-suggestions `@username`, стикеров, GIF-поиска.
- Нет **self-destruct** таймера в UI (бекенд частично готов).
- Нет кнопки **удаления сообщений** (API есть, WS-listener на фронте нет).

### 4.5 Настройки, звонки, прочее

- `SettingsScreen` минимален — нет кастомизации профиля (цвета, обои, размер шрифта).
- `CallScreen` — только 1:1, нет group-calls, picture-in-picture, blur-фона.
- Нет **device management**, **active sessions**, 2FA-UI.
- Нет **управления уведомлениями** по чату.

---

## 5. Android — план под MAX-стиль

Сейчас только `build.gradle.kts` с Compose BOM, Material3, Coil, Koin, Navigation Compose, Firebase Messaging, Biometric/Camera.

Нужно:

1. Подключить `shared/` через KMP (ktor-client, SQLDelight, Signal-крипта).
2. Material3 + тёмная тема под палитру `#16161a / #5B5FC7`, шрифт Inter/Manrope.
3. Экраны: `AuthScreen`, `ChatListScreen` (LazyColumn + swipe-to-dismiss), `ConversationScreen` (LazyColumn reversed, BubbleItem), `ProfileScreen`, `SettingsScreen`, `CallScreen` (LiveKit Android SDK).
4. Bottom nav (Чаты / Контакты / Звонки / Настройки) — как в MAX.
5. FCM-push, BiometricPrompt на вход, Camera/Gallery пикер.

Оценка объёма: 3–4 недели одного Android-разработчика.

---

## 6. iOS — план под MAX-стиль

Структура папок есть (`App`, `Views`, `Services`, `Extensions`), `.swift`-файлов нет.

Нужно:

1. SwiftUI (iOS 16+) + Combine, Swift Concurrency.
2. Навигация: `NavigationStack` (iOS 16), `TabView` для корня.
3. Экраны аналогично Android. Для чата — `ScrollViewReader` + `LazyVStack`.
4. Push через APNs + NotificationServiceExtension (decrypt E2EE).
5. CallKit + PushKit для входящих звонков, LiveKit iOS SDK.
6. KeychainAccess для хранения Signal-ключей.

Оценка объёма: 3–4 недели одного iOS-разработчика.

---

## 7. Desktop (Tauri)

`tauri.conf.json` есть, CSP строгий, окно 1200×800. Нужно:

1. Native-меню (Cmd/Ctrl+N, настройки, о программе).
2. Tray-иконка + badge непрочитанных.
3. Native-уведомления (`@tauri-apps/plugin-notification`).
4. Auto-updater (`@tauri-apps/plugin-updater`) с подписанными релизами.
5. Global shortcut на быстрое открытие.
6. Signing для macOS (notarization) и Windows (code-signing).

Оценка: 1 неделя после стабилизации webApp.

---

## 8. Инфраструктура

- `docker-compose.prod.yml`, `deploy.sh`, `restart_nginx.sh`, `backups/` — базовый каркас есть.
- Нет **CI/CD** релизов (только lint/test/build в GitHub Actions).
- Нет **staging-окружения**.
- Нет **мониторинга** (Prometheus + Grafana + Alertmanager) и centralized logs (Loki/ELK).
- Нет **rate-limit** по IP на `/auth/*` (брутфорс).
- Нет **WAF** и `fail2ban`.
- `backup.sh` есть — **нет тестов восстановления** (raz v nedelyu cron с restore-test).
- MinIO URL захардкожен `localhost:9000` во фронте — вынести в `VITE_MINIO_URL`.

---

## 9. Дорожная карта до прода

### Фаза 0 — Hotfix security (5–7 дней)

- [ ] httpOnly cookie + убрать JWT из localStorage.
- [ ] MIME/расширение whitelist на upload.
- [ ] `chatMemberCheck` на `/api/attachments/:key` и на WS signaling.
- [ ] Проверка `reply_to` на тот же чат.
- [ ] `await` + retry в `broadcastToChat`, логирование ошибок.
- [ ] Rate-limit на `/auth/*` (10/мин на IP).

### Фаза 1 — Стабильность (2–3 недели)

- [ ] Sentry (browser + backend) + Prometheus metrics + Grafana dashboards.
- [ ] Индексы: пересоздать `messages(chat_id, created_at DESC)`, GIN FTS, trgm.
- [ ] Устранить N+1 в `/api/chats`.
- [ ] Migration-tracking таблица + `npm run migrate:status`.
- [ ] Graceful shutdown WS + health-check `/healthz`, `/readyz`.
- [ ] E2EE session persistence (IndexedDB).
- [ ] Удаление чатов/сообщений (backend + WS + UI).
- [ ] Typing events на фронте, self-destruct таймер в UI.
- [ ] react-window в `ConversationScreen`.
- [ ] URL-routing (react-router) по экранам.
- [ ] Backup+restore тест в cron.

### Фаза 2 — UI до уровня MAX (2–3 недели)

- [ ] Design-tokens (`colors`, `radii`, `spacing`, `typography`) → CSS-переменные.
- [ ] Примитивы: `Button`, `Cell`, `ListItem`, `Avatar.*`, `Sheet`, `Toast`, `Skeleton`, `EmptyState`.
- [ ] 3-колоночный desktop layout + responsive breakpoints.
- [ ] Тёмная/светлая темы.
- [ ] Pinned/muted/online-статусы, swipe-actions, context-menu.
- [ ] Tapback-позиционирование, анимация typing, URL-preview, mentions, стикеры/GIF.
- [ ] Settings: профиль, обои, уведомления, device sessions, 2FA-UI.

### Фаза 3 — Мобилки и desktop-polish (4–6 недель, параллельно)

- [ ] Android: все экраны на Compose + Material3 + LiveKit + FCM.
- [ ] iOS: SwiftUI + CallKit/PushKit + LiveKit iOS.
- [ ] Tauri: tray, auto-update, notifications, code-signing.

### Фаза 4 — Pre-launch (1–2 недели)

- [ ] Нагрузочное тестирование (k6, 1–5k одновременных WS).
- [ ] Security audit (pentest внешний).
- [ ] Privacy Policy / Terms, GDPR/152-ФЗ экспорт и удаление данных.
- [ ] Staging + canary deploy.
- [ ] Runbook: инциденты, бэкапы, on-call.

**Итого до beta-релиза: ~1 месяц** с фокусом на web + backend (Фазы 0–2).
**До полного релиза с мобилками: 2–3 месяца** с командой из 3–4 человек (backend, web, android, ios).

---

## 10. Ключевые файлы для доработки

- `server/index.js` — security fixes, graceful shutdown, metrics.
- `server/storage.js` — MIME whitelist применить везде.
- `webApp/src/App.tsx` — URL routing.
- `webApp/src/api/client.ts` — убрать localStorage JWT, включить cookie-credentials.
- `webApp/src/components/conversation/ConversationScreen.tsx` — react-window, reactions, typing.
- `webApp/src/components/chat-list/ChatListItem.tsx` — pinned/muted/online/swipe.
- `webApp/src/styles/` (создать) — design-tokens + CSS-переменные.
- `webApp/src/components/ui/` — набор примитивов.
- `androidApp/src/main/` — с нуля Compose-экраны.
- `iosApp/sOn/Views/` — с нуля SwiftUI-экраны.
- `desktop/src-tauri/src/main.rs` — tray, меню, updater.
