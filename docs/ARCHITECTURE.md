# sOn Messenger — Architecture

## Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                         КЛИЕНТЫ                                  │
│                                                                  │
│  ┌───────────┐    ┌───────────────┐    ┌─────────────────────┐  │
│  │  Web App  │    │  Android App  │    │      iOS App        │  │
│  │ React+TS  │    │Jetpack Compose│    │      SwiftUI        │  │
│  │ Tailwind  │    │    Kotlin     │    │      Swift          │  │
│  └─────┬─────┘    └──────┬────────┘    └──────────┬──────────┘  │
│        │                 │                        │              │
│        │          ┌──────┴────────────────────────┘              │
│        │          │     KMP Shared Module                        │
│        │          │  ┌──────────────────────────┐               │
│        │          │  │ Signal Protocol (E2E)    │               │
│        │          │  │ Network (Ktor + WS)      │               │
│        │          │  │ SQLDelight (local DB)    │               │
│        │          │  │ Domain (use cases)       │               │
│        │          │  │ ViewModels (Flow)        │               │
│        │          │  └──────────────────────────┘               │
│        │          │                                              │
└────────┼──────────┼──────────────────────────────────────────────┘
         │          │
    WebSocket   WebSocket + gRPC
         │          │
┌────────┴──────────┴──────────────────────────────────────────────┐
│                          BACKEND                                  │
│                                                                   │
│  ┌───────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Elixir / Phoenix │  │  Rust Service  │  │   Go Service   │  │
│  │  ─────────────────│  │  ──────────────│  │  ──────────────│  │
│  │  WS Gateway       │  │  Crypto Ops    │  │  Push (FCM)    │  │
│  │  Presence         │  │  Key Mgmt      │  │  Push (APNs)   │  │
│  │  Pub/Sub          │  │  Media Process │  │  Web Push      │  │
│  │  Channels         │  │  File Validate │  │  Analytics     │  │
│  └────────┬──────────┘  └───────┬────────┘  └───────┬────────┘  │
│           │                     │                    │           │
│  ┌────────┴─────────────────────┴────────────────────┘           │
│  │                 Kafka (Message Bus)                            │
│  └──────────────────────┬────────────────────────────┘           │
│                         │                                        │
│  ┌──────────┐  ┌────────┴──┐  ┌─────────┐  ┌─────────┐        │
│  │ ScyllaDB │  │PostgreSQL │  │  Redis   │  │  MinIO  │        │
│  │ Messages │  │Users/Meta │  │ Cache    │  │  Files  │        │
│  │ History  │  │Groups     │  │ Sessions │  │  Media  │        │
│  │          │  │Contacts   │  │ Presence │  │ Avatars │        │
│  └──────────┘  └───────────┘  └─────────┘  └─────────┘        │
│                                                                  │
│  Infra: Kubernetes │ Istio │ Envoy │ Vault │ Prometheus+Grafana │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend Architecture (Web MVP)

### 1.1 Технологический стек

| Технология | Назначение |
|-----------|-----------|
| React 19 + TypeScript | UI-фреймворк |
| Vite 6 | Сборка и dev-сервер |
| Tailwind CSS 4 | Стилизация |
| Zustand | Управление состоянием |
| lucide-react | Иконки |
| Web Crypto API | Шифрование в браузере |
| Vitest + Testing Library | Тестирование |

### 1.2 Структура проекта

```
src/
├── App.tsx                      # Корневой компонент + роутинг
├── main.tsx                     # Entry point
│
├── components/
│   ├── chat-list/
│   │   ├── ChatList.tsx         # Список чатов
│   │   ├── ChatListItem.tsx     # Элемент списка
│   │   └── ChatListHeader.tsx   # Шапка "Сообщения"
│   │
│   ├── conversation/
│   │   ├── ConversationScreen.tsx   # Экран переписки
│   │   ├── MessageBubble.tsx        # Пузырь сообщения
│   │   ├── BubbleTail.tsx           # SVG хвостик
│   │   ├── InputBar.tsx             # Панель ввода
│   │   ├── DateSeparator.tsx        # Разделитель дат
│   │   ├── TypingIndicator.tsx      # "печатает..."
│   │   ├── DeliveryStatus.tsx       # Статус доставки
│   │   └── ReplyQuote.tsx           # Цитата
│   │
│   ├── reactions/
│   │   ├── TapbackOverlay.tsx       # Overlay реакций
│   │   ├── ReactionBadge.tsx        # Бейдж на пузыре
│   │   └── ContextMenu.tsx          # Контекстное меню
│   │
│   ├── secret-chat/
│   │   ├── SecretChatScreen.tsx     # Экран секретного чата
│   │   ├── KeyExchangeAnimation.tsx # Анимация обмена ключами
│   │   ├── VerificationModal.tsx    # Верификация (эмодзи+hex+QR)
│   │   ├── SelfDestructTimer.tsx    # Таймер самоуничтожения
│   │   └── EncryptionInfo.tsx       # Информация о шифровании
│   │
│   ├── calls/
│   │   ├── CallScreen.tsx           # Экран аудиозвонка
│   │   ├── VideoCallScreen.tsx      # Экран видеозвонка
│   │   └── IncomingCall.tsx         # Входящий звонок
│   │
│   ├── media/
│   │   ├── ImageViewer.tsx          # Fullscreen фото
│   │   ├── VoiceMessage.tsx         # Голосовое сообщение
│   │   ├── FileAttachment.tsx       # Файл-вложение
│   │   ├── AttachmentPicker.tsx     # Action Sheet вложений
│   │   └── MediaGallery.tsx         # Галерея в info-панели
│   │
│   ├── group/
│   │   ├── CreateGroupModal.tsx     # Создание группы
│   │   └── GroupInfoPanel.tsx       # Info-панель группы
│   │
│   ├── settings/
│   │   ├── SettingsScreen.tsx       # Главный экран настроек
│   │   ├── ProfileSection.tsx       # Профиль
│   │   ├── PrivacySection.tsx       # Конфиденциальность
│   │   └── EncryptionSection.tsx    # Шифрование
│   │
│   └── ui/
│       ├── Avatar.tsx               # Аватар (фото/инициалы/силуэт)
│       ├── FrostedGlassBar.tsx      # Blur-шапка
│       ├── ActionSheet.tsx          # iOS Action Sheet
│       ├── IOSToggle.tsx            # Переключатель iOS-стиля
│       ├── SearchBar.tsx            # Поле поиска
│       └── TabBar.tsx               # Нижний tab bar (мобильный)
│
├── hooks/
│   ├── useChat.ts                   # Логика текущего чата
│   ├── useMessages.ts              # CRUD сообщений
│   ├── useWebSocket.ts             # WebSocket-соединение
│   ├── useEncryption.ts            # Хуки шифрования
│   ├── useAutoReply.ts             # Мок-автоответы
│   ├── useMediaQuery.ts            # Адаптивность
│   ├── useLongPress.ts             # Долгое нажатие (Tapback)
│   └── useSwipe.ts                 # Свайп-жесты
│
├── stores/
│   ├── chatStore.ts                 # Список чатов
│   ├── messageStore.ts             # Сообщения
│   ├── userStore.ts                # Текущий пользователь
│   ├── uiStore.ts                  # UI-состояние (экран, модалки)
│   ├── callStore.ts                # Состояние звонка
│   └── cryptoStore.ts              # Ключи и сессии шифрования
│
├── crypto/
│   ├── keyPair.ts                   # Генерация ключевых пар (Curve25519)
│   ├── x3dh.ts                      # Extended Triple Diffie-Hellman
│   ├── doubleRatchet.ts            # Double Ratchet Algorithm
│   ├── encrypt.ts                   # AES-256-GCM шифрование/дешифрация
│   ├── fingerprint.ts              # Эмодзи + hex отпечатки
│   └── types.ts                     # Типы для крипто-модуля
│
├── network/
│   ├── websocket.ts                 # WebSocket клиент
│   ├── api.ts                       # REST API клиент
│   └── types.ts                     # Типы для сетевого слоя
│
├── types/
│   ├── chat.ts                      # Chat, ChatType, ChatStatus
│   ├── message.ts                   # Message, MessageType, Attachment
│   ├── user.ts                      # User, Contact, OnlineStatus
│   ├── call.ts                      # Call, CallType, CallStatus
│   └── crypto.ts                    # KeyPair, Session, EncryptedMessage
│
├── utils/
│   ├── dateFormat.ts                # Форматирование дат (iOS-стиль)
│   ├── colors.ts                    # Палитра Apple для инициалов
│   └── audio.ts                     # Web Audio API (звуки уведомлений)
│
├── mocks/
│   ├── contacts.ts                  # 7 контактов + 2 группы + 1 секретный
│   ├── messages.ts                  # История сообщений
│   └── autoReplies.ts              # Пул автоответов
│
└── styles/
    ├── globals.css                   # CSS-переменные, @keyframes
    └── tailwind.config.ts           # Кастомная тема iOS Dark
```

### 1.3 Управление состоянием (Zustand)

```
┌──────────────┐
│   chatStore   │ ← Список чатов, активный чат, фильтрация
├──────────────┤
│ messageStore  │ ← Сообщения по чатам, отправка, удаление
├──────────────┤
│  userStore    │ ← Текущий пользователь, профиль, настройки
├──────────────┤
│   uiStore     │ ← Активный экран, модалки, sidebar, тема
├──────────────┤
│  callStore    │ ← Активный звонок, статус, таймер
├──────────────┤
│ cryptoStore   │ ← Ключевые пары, сессии, рэтчет-индексы
└──────────────┘
```

### 1.4 Поток данных

```
User Action → Component → Zustand Store → Re-render
                 ↕
           Custom Hook → Crypto Module (E2E)
                 ↕
           WebSocket / REST API → Backend
```

---

## 2. Backend Architecture

### 2.1 Сервисы

#### Elixir/Phoenix — Gateway Service (порт 4000)
Основной сервис, обрабатывающий все real-time соединения.

**Ответственность:**
- WebSocket-соединения (Phoenix Channels)
- Presence (онлайн-статусы пользователей)
- Маршрутизация сообщений (pub/sub)
- REST API для CRUD операций
- Аутентификация (JWT + refresh tokens)
- Rate limiting на уровне пользователя

**Почему Elixir:**
- BEAM VM: миллионы одновременных WebSocket-соединений
- OTP Supervisors: автоматическое восстановление при сбоях
- Hot code reloading: обновления без простоев
- Встроенный pub/sub через Phoenix.PubSub

#### Rust Service — Crypto & Media (порт 8080)
Высокопроизводительный сервис для криптографических и медиа-операций.

**Ответственность:**
- Управление публичными ключами (хранение pre-key bundles)
- Верификация подписей
- Обработка медиа (сжатие, thumbnail generation)
- Валидация и санитизация загружаемых файлов
- Генерация pre-signed URLs для MinIO

**Почему Rust:**
- Zero-cost abstractions: производительность уровня C
- Memory safety без GC
- libsignal-protocol-rust — официальная реализация Signal Protocol
- Отличная поддержка криптографических библиотек

#### Go Service — Push & Analytics (порт 9090)
Микросервис для фоновых задач.

**Ответственность:**
- Push-уведомления: FCM (Android), APNs (iOS), Web Push
- Сбор аналитики и метрик
- Модерация контента (будущее)
- Очистка expired сообщений (self-destruct)

**Почему Go:**
- Простота деплоя (single binary)
- Эффективная работа с goroutines для I/O-bound задач
- Хорошие SDK для FCM/APNs

### 2.2 Межсервисное взаимодействие

```
             ┌──────────────────┐
             │      Kafka       │
             │  Message Topics  │
             └────────┬─────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────┴────┐  ┌─────┴─────┐  ┌───┴───┐
   │ Phoenix │  │   Rust    │  │  Go   │
   │ Gateway │  │  Crypto   │  │ Push  │
   └─────────┘  └───────────┘  └───────┘
```

**Kafka Topics:**
- `messages.sent` — новые сообщения (Phoenix → Rust для проверки ключей → Go для push)
- `messages.delivered` — подтверждение доставки
- `users.presence` — изменения онлайн-статусов
- `keys.updated` — обновления публичных ключей
- `media.uploaded` — загруженные файлы (Phoenix → Rust для обработки)
- `calls.events` — события звонков

### 2.3 Хранение данных

| База | Данные | Обоснование |
|------|--------|-------------|
| **ScyllaDB** | Сообщения, история чатов | High-write throughput, горизонтальное масштабирование, partition по chat_id |
| **PostgreSQL** | Пользователи, контакты, группы, метаданные, ключи | ACID, сложные запросы, JOIN, миграции |
| **Redis Cluster** | Сессии, кэш, presence, rate limiting, typing indicators | In-memory скорость, TTL, pub/sub |
| **MinIO** | Файлы, медиа, аватары, голосовые | S3-совместимый, self-hosted, pre-signed URLs |

---

## 3. Протоколы

### 3.1 WebSocket Protocol (Client ↔ Phoenix)

```json
// Подключение
{"topic": "user:lobby", "event": "phx_join", "payload": {"token": "jwt..."}}

// Отправка сообщения
{"topic": "chat:123", "event": "new_message", "payload": {
  "encrypted_content": "base64...",
  "type": "text",
  "reply_to": null
}}

// Получение сообщения
{"topic": "chat:123", "event": "message_received", "payload": {
  "id": "msg_456",
  "sender_id": "user_789",
  "encrypted_content": "base64...",
  "timestamp": "2026-03-18T10:30:00Z"
}}

// Typing indicator
{"topic": "chat:123", "event": "typing", "payload": {"user_id": "user_789"}}

// Presence
{"topic": "user:lobby", "event": "presence_diff", "payload": {
  "joins": {"user_123": {"online_at": "..."}},
  "leaves": {"user_456": {"online_at": "..."}}
}}
```

### 3.2 REST API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
DELETE /api/auth/logout

GET    /api/users/me
PATCH  /api/users/me
GET    /api/users/:id
GET    /api/users/search?q=

GET    /api/contacts
POST   /api/contacts
DELETE /api/contacts/:id

GET    /api/chats
POST   /api/chats
GET    /api/chats/:id
DELETE /api/chats/:id

GET    /api/chats/:id/messages?before=&limit=
POST   /api/chats/:id/messages
DELETE /api/chats/:id/messages/:msg_id

POST   /api/groups
PATCH  /api/groups/:id
POST   /api/groups/:id/members
DELETE /api/groups/:id/members/:user_id

POST   /api/keys/prekey-bundle
GET    /api/keys/:user_id/prekey-bundle
POST   /api/keys/signed-prekey

POST   /api/media/upload
GET    /api/media/:id
```

---

## 4. Безопасность

### 4.1 Транспортный уровень
- TLS 1.3 для всех соединений
- Certificate Pinning на мобильных клиентах
- HSTS + CSP + X-Frame-Options на веб-клиенте

### 4.2 Аутентификация
- JWT (access token, 15 мин) + Refresh token (30 дней, httpOnly cookie)
- Argon2id для хеширования паролей
- Rate limiting: 5 попыток / мин на login

### 4.3 E2E шифрование (Signal Protocol)
- X3DH: начальный обмен ключами
- Double Ratchet: обновление ключей после каждого сообщения
- Curve25519: эллиптические кривые
- AES-256-GCM: симметричное шифрование
- HMAC-SHA256: аутентификация

### 4.4 Zero-Knowledge
- Сервер хранит ТОЛЬКО зашифрованные сообщения
- Приватные ключи НИКОГДА не покидают устройство
- Метаданные минимизированы (ID отправителя + получателя + timestamp)
