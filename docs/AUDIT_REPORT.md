# sOn Messenger — Audit Report

**Дата:** 2026-03-18
**Аудиторы:** 8 параллельных AI-агентов (code-reviewer)

---

## Результаты аудита (до исправлений)

| Документ | Оценка | Критических проблем |
|----------|:------:|:-------------------:|
| SECURITY.md | 7.1/10 | 11 |
| ARCHITECTURE.md | 7.0/10 | 3 |
| FRONTEND.md | 6.4/10 | 10 |
| MOBILE.md | 6.4/10 | 4 |
| DATABASE.md | 6.4/10 | 5 |
| API.md | 6.1/10 | 13 |
| INFRASTRUCTURE.md | 6.1/10 | 19 |
| PLAN.md | 5.8/10 | 10 |
| **Средняя** | **6.4/10** | **75 total** |

---

## Топ-10 критических проблем (были)

1. Нет WebRTC/TURN/STUN — звонки не работают за NAT
2. P-256 вместо Curve25519 для Web — несовместимость с Signal Protocol
3. ~20 пропущенных API endpoints (block, archive, calls, sessions)
4. Нет таблицы call_sessions в БД
5. CI/CD покрывает только фронтенд
6. Нереалистичные сроки (занижены x2-3)
7. 10 из 14 фронтенд-компонентов не описаны
8. Race condition в реакциях ScyllaDB (MAP type)
9. Нет E2E потока шифрования end-to-end
10. QR fingerprint усечён до 64 бит

---

## Применённые исправления

### PLAN.md (10 исправлений)
- Добавлены пропущенные функции в спринты (системные сообщения, онлайн-статус, info-панель секретных чатов)
- Сроки исправлены: Sprint 4-6 расширены до 3 недель, все фазы пересчитаны
- Добавлен Sprint 7: CI/CD и тестирование (Vitest, Playwright, GitHub Actions, Storybook)
- Definition of Done для каждого спринта
- Accessibility с Sprint 1 (aria-label, семантический HTML, Tab-навигация)
- Разделы "Команда и роли", "Риски и митигация"
- IndexedDB + Service Workers
- Исправлена зависимость Avatar (групповой 2×2 перенесён в Sprint 4)

### ARCHITECTURE.md (12 исправлений)
- Добавлен coturn TURN/STUN сервер в диаграмму и описание
- Полный E2E поток шифрования (encrypt → WS → ScyllaDB → WS → decrypt)
- Call API endpoints (POST/GET /api/calls, TURN credentials)
- Пропущенные REST endpoints (block, archive, sessions, push-token)
- gRPC уточнён: только inter-service, клиенты используют WS + REST
- WebSocket fallback (SSE → Long Polling)
- Компоненты: DropZone.tsx, useDragDrop.ts, useResizeSidebar.ts, service-worker.ts
- Kafka topic messages.self_destruct
- Redis + Phoenix Presence координация
- Namespace com/son/ унифицирован
- libsodium.js как fallback

### DATABASE.md (15 исправлений)
- Таблица call_sessions с ENUM типами
- Реакции: MAP заменён на отдельную таблицу message_reactions
- Таблица read_receipts для групповых чатов
- Убраны дублирующие индексы (UNIQUE уже создаёт)
- UNIQUE(chat_id) для secret_chat_sessions
- ON DELETE SET NULL для chats.created_by
- CHECK constraint для show_online
- forwarded_from поля в ScyllaDB
- Миграции: индексы inline, seed вынесен в scripts/, ScyllaDB миграции добавлены
- Redis: ratelimit по IP, pub/sub каналы
- Reconciliation для дублей (is_online, unread_count)
- Индексы: contacts(contact_id), attachments(uploader_id), devices(push_token)
- MinIO: pre-signed URLs для приватных профилей, lifecycle policy

### API.md (13 исправлений)
- ~20 новых endpoints: block, sessions, push-tokens, calls, avatar, forward, search, groups
- Ответы для 9 ранее недокументированных endpoints
- Cursor-пагинация исправлена (oldest message + параметр after)
- Пагинация для contacts и users/search
- Дублирование POST /api/groups устранено
- DELETE logout → POST logout
- Rate-limit заголовки (X-RateLimit-*)
- Таблица лимитов для всех endpoints
- 10 новых WS-событий (stop_typing, reaction_removed, message_deleted, etc.)
- Ошибка 503, схема details для 422
- content_type унифицирован в type

### SECURITY.md (17 исправлений)
- X3DH KDF: 0xFF prefix, length 32
- Верификация подписи SPK (XEdDSA)
- Инициализация Double Ratchet из SK
- Skipped message keys (до 1000)
- DH Ratchet KDF уточнён (HKDF-SHA256, 64 bytes)
- QR fingerprint: полные 32 байта
- Детерминированный порядок fingerprint (лексикографический по user_id)
- Web Crypto: X25519 + libsodium.js вместо P-256
- iOS cert pinning: SecTrustCopyCertificateChain (iOS 15+)
- Android Keystore: XDH для Curve25519 (API 31+)
- Refresh Token Rotation
- Threat Model: метаданные, supply chain, SIM-swap
- Multi-device (Sesame Protocol)
- Idempotent self-destruct (Outbox Pattern)
- Rate limiting algorithm (Sliding Window Log)
- Account Lockout (10 попыток → 30 мин)

### FRONTEND.md (14 исправлений)
- 5 CSS-переменных (header-bg, header-blur, bg-incoming-secret, secret-border, selection-color)
- 10 компонентов (ChatListItem, TapbackOverlay, ContextMenu, KeyExchangeAnimation, VerificationModal, SelfDestructTimer, VoiceMessage, AttachmentPicker, TypingIndicator, SecretChatBanner)
- callStore + secretChatStore с CallState и EncryptionSession
- ChatStore.filter: добавлен 'archived'
- TypeScript типы: Contact, TapbackEmoji, GroupMember, KeyPair
- 3 анимации: letterScatter, particleFly, circleCountdown
- Transition переменные в :root{}
- Hover/active/resize для desktop sidebar
- Drag & Drop описание
- Web Audio: singleton AudioContext + resume()
- MediaRecorder API для голосовых
- Горячие клавиши в отдельном разделе с Scope
- IndexedDB + prefers-color-scheme + @supports

### INFRASTRUCTURE.md (19 исправлений)
- Healthcheck для postgres, redis, scylladb, kafka
- depends_on с condition: service_healthy
- coturn TURN/STUN сервер
- restart: unless-stopped для всех сервисов
- Сеть son-network
- Версия MinIO закреплена
- .env.example шаблон
- CI/CD: Elixir, Rust, Go workflows + Docker+Trivy security scan
- Kubernetes: 7 отдельных namespaces
- HPA для crypto и push
- PodDisruptionBudget
- Метрики: db_query_duration, kafka_consumer_lag, redis_memory, scylla_write_latency
- Loki + Promtail log aggregation
- Blackbox monitoring (HTTP probes)
- Vault Kubernetes Auth + ServiceAccount
- PostgreSQL: WAL-G continuous backup (RPO ~5 мин)
- Процедуры restore для всех компонентов
- Описание сред (Staging/Production + Kustomize overlays)
- Шифрование бэкапов (AES-256)

### MOBILE.md (17 исправлений)
- Таблица сравнения: реалистичные цифры для RN и KMP
- crypto/ модуль: 8 файлов детализированы
- network/ модуль: 7 файлов детализированы
- androidMain/iosMain: добавлены WebSocket, MediaRecorder, CallService
- 3 новых expect/actual: WebSocketEngine, MediaRecorder, CoroutineDispatchers
- WebRTC в таблице библиотек
- Coil 3 / SDWebImageSwiftUI для изображений
- Libsodium: конкретный Maven-артефакт
- Навигация: Decompose 3.x (зафиксирован)
- KMP-ViewModel: примечание об альтернативе от Google
- MediaProjection в Android-интеграциях
- WebRTC в нативных интеграциях
- Сроки: реалистичные (27+ месяцев для команды 3-5 чел.)
- Распределение кода: util 65%, webrtc 0%, итого ~60%
- Общая схема архитектуры (раздел 7)

---

## Итог

Все **75 критических замечаний** из 8 аудиторских отчётов были исправлены.
Документация готова к использованию для начала реализации Sprint 1.
