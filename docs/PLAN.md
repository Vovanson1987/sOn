# sOn Messenger — Master Implementation Plan

## Обзор проекта

**sOn** — защищённый веб-мессенджер в стиле iOS Messages (Dark Mode) с E2E-шифрованием на базе Signal Protocol. Первый этап — полнофункциональный Web MVP на React + TypeScript.

---

## Фаза 0: Web MVP (Недели 1–18, 18 недель)

### Sprint 1 (Недели 1–2): Инициализация и базовый UI

#### 1.1 Настройка проекта
- [ ] Инициализация React + TypeScript + Vite
- [ ] Настройка Tailwind CSS 4 с кастомной темой iOS Dark
- [ ] Установка и настройка ESLint + Prettier
- [ ] Настройка структуры папок:
  ```
  src/
  ├── components/     # UI-компоненты
  ├── hooks/          # Кастомные хуки
  ├── stores/         # Zustand stores
  ├── types/          # TypeScript типы
  ├── utils/          # Утилиты
  ├── crypto/         # Модуль шифрования
  ├── network/        # WebSocket + API
  ├── assets/         # Статические ресурсы
  └── mocks/          # Моковые данные
  ```
- [ ] Настройка алиасов путей (@components, @hooks, @stores, ...)
- [ ] Добавление lucide-react иконок
- [ ] Настройка Vitest для тестирования

#### 1.2 Дизайн-система (iOS Dark Theme)
- [ ] CSS-переменные и Tailwind-конфиг:
  - `--bg-primary: #000000` (OLED black)
  - `--bg-secondary: #1C1C1E`
  - `--bg-tertiary: #2C2C2E`
  - `--bg-bubble-incoming: #26252A`
  - `--accent-blue: #007AFF` (iMessage)
  - `--accent-green: #34C759` (SMS / Secret)
  - `--text-primary: #FFFFFF`
  - `--text-secondary: #8E8E93`
  - `--separator: #38383A`
  - `--danger: #FF3B30`
- [ ] Типографика: system-ui / SF Pro fallback, размеры 11–34px
- [ ] Компонент Avatar (фото / инициалы / силуэт; групповой 2×2 — см. Sprint 4)
- [ ] Компонент FrostedGlassBar (backdrop-filter: blur(20px))
- [ ] CSS @keyframes: typingDots, pulseRing, fadeOut, slideIn, slideOut, springBounce

#### 1.3 Экран списка чатов
- [ ] Компонент ChatList — вертикальный скроллируемый список
- [ ] Компонент ChatListItem — аватар + имя + дата + превью + шеврон
- [ ] Индикатор непрочитанных (синяя точка)
- [ ] Иконка 🔒 для секретных чатов
- [ ] Шапка: "Сообщения" (Large Title) + кнопки "Править" и фильтр
- [ ] Нижний toolbar: поиск + микрофон + новое сообщение
- [ ] Свайп влево → "Удалить" / "Архивировать"

#### 1.4 Accessibility (с первого спринта)
- [ ] aria-label на всех интерактивных элементах (кнопки, ссылки, поля ввода)
- [ ] Семантический HTML: `<nav>`, `<main>`, `<header>`, `<section>`, `<article>`, `<button>`
- [ ] Клавиатурная навигация (Tab / Shift+Tab) по всем интерактивным элементам
- [ ] role и aria-live для динамического контента (новые сообщения, уведомления)
- [ ] Контрастность текста WCAG 2.1 AA (минимум 4.5:1)

#### Definition of Done — Sprint 1
- [ ] Тесты написаны и проходят (Vitest)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] Code review пройден
- [ ] Компоненты задокументированы в Storybook

---

### Sprint 2 (Недели 3–4): Экран чата и сообщения

#### 2.1 Экран переписки (ConversationScreen)
- [ ] Frosted glass шапка: «‹ Назад» + аватар + имя + видео/телефон
- [ ] Область сообщений с автоскроллом к последнему
- [ ] Разделители дат: "Сегодня", "Вчера", "Ср, 22 окт., 09:31"
- [ ] Навигация: список ↔ чат с slide-анимацией

#### 2.2 Пузыри сообщений (MessageBubble)
- [ ] Исходящие iMessage: синий #007AFF, справа, max-width 75%
- [ ] Исходящие SMS: зелёный #34C759
- [ ] Входящие: тёмно-серый #26252A, слева
- [ ] Хвостики (CSS pseudo-element / clip-path)
- [ ] Группировка последовательных: 2px gap, скругления 4px/18px
- [ ] Время внутри пузыря (мелкий полупрозрачный текст)
- [ ] React.memo для оптимизации

#### 2.3 Статусы доставки
- [ ] "Доставлено" (серый)
- [ ] "Прочитано" (синий)
- [ ] "Не доставлено ⚠" (красный)

#### 2.4 Системные сообщения
- [ ] Отображение по центру серым текстом: "Номер изменён на Основной"
- [ ] С иконками: "🌙 Vladimir заглушает уведомления"
- [ ] "Неизвестный номер" — серый пузырь входящего

#### 2.5 Онлайн-статус
- [ ] Зелёная точка (10px, border: 2px solid #000) на аватаре при онлайн-статусе
- [ ] Отображение в списке чатов и в шапке экрана переписки

#### 2.6 Панель ввода (InputBar)
- [ ] Кнопка "+" (вложения)
- [ ] Auto-resize textarea (до 5 строк)
- [ ] Placeholder: "Текстовое сообщение..."
- [ ] Кнопка отправки (синяя ↑) при наличии текста
- [ ] Кнопка микрофона 🎙 при пустом поле
- [ ] Shift+Enter = перенос, Enter = отправить

#### Definition of Done — Sprint 2
- [ ] Тесты написаны и проходят (Vitest)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] Code review пройден
- [ ] Компоненты задокументированы в Storybook

---

### Sprint 3 (Недели 5–6): Интерактивность и реакции

#### 3.1 Tapback реакции
- [ ] Long press (500ms) / double tap → затемнение + blur
- [ ] Панель реакций: ❤️ 👍 👎 😂 ‼️ ❓
- [ ] Бейдж выбранной реакции на пузыре
- [ ] Анимация: scale(1.05) для "приподнятия" сообщения

#### 3.2 Контекстное меню
- [ ] Ответить (reply с цитатой)
- [ ] Копировать текст
- [ ] Переслать
- [ ] Удалить (красный)
- [ ] Десктоп: правый клик → меню

#### 3.3 Reply (цитата)
- [ ] Серая полоска + превью текста над полем ввода
- [ ] Кнопка ✕ отмены
- [ ] Свайп вправо по сообщению → reply (мобильная)

#### 3.4 Индикатор "печатает..."
- [ ] Три анимированные точки в сером пузыре
- [ ] CSS @keyframes typingDots

#### 3.5 Автоответы (мок)
- [ ] Случайная задержка 1–3 сек
- [ ] Предварительно "печатает..." 1–2 сек
- [ ] Пул ответов: ["Ок", "Хорошо, принял", "👍", ...]

#### Definition of Done — Sprint 3
- [ ] Тесты написаны и проходят (Vitest)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] Code review пройден
- [ ] Компоненты задокументированы в Storybook

---

### Sprint 4 (Недели 7–9): Групповые чаты, медиа и контакты

#### 4.1 Групповые чаты
- [ ] Составной аватар (2×2 сетка мини-кружков) — реализация группового аватара
- [ ] Цветные имена отправителей над входящими
- [ ] Создание группы: модальное → поиск → чекбоксы → название → "Создать"
- [ ] Системные сообщения: "Группа создана", "X присоединился"
- [ ] Info-панель: участники + роли + "Добавить" + "Покинуть"

#### 4.2 Вложения
- [ ] Action Sheet (iOS-стиль снизу): Камера, Фото, Документ, Геолокация
- [ ] Фото: скруглённый thumbnail, клик → fullscreen + затемнение
- [ ] Pinch-to-zoom для fullscreen-просмотра фото (touch-events / CSS transform scale)
- [ ] Файлы: карточка с иконкой типа + имя + размер
- [ ] Drag & drop зона (border: 2px dashed #007AFF)

#### 4.3 Голосовые сообщения
- [ ] Кнопка 🎙 → удержание = запись (имитация)
- [ ] В чате: SVG-волна + ▶ play + "0:12"
- [ ] Web Audio API: синтез простых тонов для демо

#### 4.4 Медиа-галерея
- [ ] Сетка 3×N превью в info-панели

#### 4.5 Экран "Контакты" (Tab Bar)
- [ ] Вкладка "Контакты" в нижнем tab bar (мобильная версия)
- [ ] Список контактов с аватарами, именами, статусами онлайн
- [ ] Поиск по контактам (фильтрация по имени)
- [ ] Нажатие на контакт → переход к чату / создание нового чата

#### Definition of Done — Sprint 4
- [ ] Тесты написаны и проходят (Vitest)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] Code review пройден
- [ ] Компоненты задокументированы в Storybook

---

### Sprint 5 (Недели 10–12): E2E шифрование и секретные чаты

#### 5.1 Создание секретного чата
- [ ] Кнопка "🔒 Новый секретный чат" в меню "+"
- [ ] Анимация обмена ключами:
  - Два замка по краям
  - Летящие частицы
  - Прогресс: X3DH → Double Ratchet → "Соединение установлено"

#### 5.2 Визуальные отличия
- [ ] Зелёный градиент пузырей (#34C759 → #30D158)
- [ ] Иконка 🔒 в шапке и списке чатов
- [ ] Плашка: "Сообщения защищены сквозным шифрованием..."
- [ ] Зелёный бордюр 3px в списке чатов

#### 5.3 Криптографический модуль (имитация)
- [ ] generateKeyPair() — Curve25519 mock (crypto.getRandomValues)
- [ ] performX3DH() — имитация Extended Triple Diffie-Hellman
- [ ] ratchetStep() — Double Ratchet с обновлением ключей
- [ ] encryptMessage() / decryptMessage() — AES-256-GCM mock
- [ ] Tooltip: показ "зашифрованного" вида сообщения (base64)

#### 5.4 Верификация ключей
- [ ] Модальное окно: два аватара + линия
- [ ] Эмодзи-отпечаток 4×4
- [ ] Hex fingerprint (моноширинный, копируемый)
- [ ] QR-код (SVG-паттерн)
- [ ] Кнопка "Подтвердить верификацию"

#### 5.5 Таймер самоуничтожения
- [ ] Кнопка ⏱ в панели ввода секретного чата
- [ ] Picker: Выкл | 5с | 15с | 30с | 1мин | 5мин | 1ч | 1д
- [ ] Круговой countdown (SVG stroke-dashoffset)
- [ ] Анимация исчезновения: fade + scale(0.8) + blur
- [ ] Замена на "🔒 Сообщение удалено"

#### 5.6 Info-панель секретного чата
- [ ] Секция "Шифрование":
  - Протокол: Signal Protocol (X3DH + Double Ratchet)
  - Алгоритмы: Curve25519, AES-256-GCM, HMAC-SHA256
  - Дата создания сессии
  - Ratchet index: #N (количество обновлений ключа)
  - Статус верификации: "Подтверждено" / "Не верифицировано"
- [ ] Кнопка "Пересоздать ключи" → повторяет анимацию обмена
- [ ] Кнопка "Завершить секретный чат" (красная) → удаляет сообщения и ключи
- [ ] Статус "Verified" зелёным в шапке чата после верификации ключей

#### 5.7 Анимация шифрования при отправке
- [ ] Мерцание текста → рассыпание на символы
- [ ] Иконка 🔒 (scale 0→1)
- [ ] Пузырь "улетает" в ленту

#### Definition of Done — Sprint 5
- [ ] Тесты написаны и проходят (Vitest)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] Code review пройден
- [ ] Компоненты задокументированы в Storybook

---

### Sprint 6 (Недели 13–15): Звонки, настройки, адаптив

#### 6.1 Аудио/видео звонки
- [ ] Полноэкранное модальное в стиле iOS Call Screen
- [ ] Backdrop blur(40px) + аватар 120px
- [ ] Пульсирующие кольца при вызове
- [ ] Кнопки: 🔇 микрофон, 📹 камера, 🔊 динамик, 🔴 завершить
- [ ] Таймер "00:00" после "принятия" (2–3 сек)
- [ ] Видеозвонок: градиент-заглушка + PiP окно 100×140px (draggable)
- [ ] Экран входящего звонка: "Отклонить" / "Принять"

#### 6.2 Настройки
- [ ] Профиль: аватар + имя + статус
- [ ] Тема: тёмная / светлая / системная
- [ ] Уведомления: звук, предпросмотр
- [ ] Конфиденциальность: онлайн-статус, отчёты о прочтении
- [ ] Хранилище: "1.2 ГБ", кнопка "Очистить кэш"
- [ ] Секция "Шифрование": информация о ключах
- [ ] О приложении: версия, лицензии

#### 6.3 Нижний Tab Bar (мобильная версия)
- [ ] Стиль iOS: 4 вкладки — Чаты | Звонки | Контакты | Настройки
- [ ] Иконки + подписи под каждой вкладкой
- [ ] Активная вкладка: акцентный цвет #007AFF, неактивные: серый #8E8E93
- [ ] Бейдж непрочитанных на вкладке "Чаты"
- [ ] Бейдж пропущенных на вкладке "Звонки"
- [ ] Фон: rgba(0,0,0,0.85) + backdrop-filter: blur(20px) (frosted glass)
- [ ] padding-bottom: env(safe-area-inset-bottom) для iPhone с вырезом

#### 6.4 Адаптивный дизайн
- [ ] Mobile (< 768px): полноэкранные режимы, slide-переходы, tab bar
- [ ] Tablet (768–1024px): двухколоночный layout (sidebar 300px + чат)
- [ ] Desktop (≥ 1024px): трёхколоночный (sidebar 380px + чат + info 320px)
- [ ] Горячие клавиши: Ctrl+K (поиск), Ctrl+N (новый чат), Esc (закрыть)
- [ ] Resize sidebar (col-resize)
- [ ] safe-area-inset-bottom для iPhone

#### 6.5 Виртуализация сообщений
- [ ] При > 100 сообщениях — рендерить только видимые (IntersectionObserver)
- [ ] Placeholder-элементы для сообщений вне viewport (сохранение высоты)
- [ ] Плавный скролл к новым и старым сообщениям
- [ ] Lazy-загрузка истории при скролле вверх

#### 6.6 Поиск
- [ ] Поиск по чатам в списке (фильтрация по имени)
- [ ] Ctrl+K → фокус на поле поиска

#### 6.7 Моковые данные
- [ ] 7 контактов из спецификации (900, Ксенька, Папа, MIRATORG, ...)
- [ ] 2 группы (Семья, Работа SCIF)
- [ ] 1 секретный чат (Алексей) с верифицированными ключами
- [ ] История сообщений: текст, фото-плейсхолдеры, файлы, голосовые
- [ ] Разные статусы, Tapback, reply, ошибки доставки

#### Definition of Done — Sprint 6
- [ ] Тесты написаны и проходят (Vitest)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] Code review пройден
- [ ] Компоненты задокументированы в Storybook

---

### Sprint 7 (Недели 16–18): Тестирование, CI/CD и offline

#### 7.1 Unit-тесты
- [ ] Vitest unit-тесты для всех компонентов (coverage >= 80%)
- [ ] Тесты криптографического модуля (100% coverage)
- [ ] Тесты Zustand stores
- [ ] Тесты кастомных хуков

#### 7.2 E2E-тесты
- [ ] Playwright E2E тесты: основные пользовательские сценарии
- [ ] Тест: отправка / получение сообщения
- [ ] Тест: создание секретного чата + верификация ключей
- [ ] Тест: создание группового чата
- [ ] Тест: звонок (имитация)
- [ ] Тест: адаптивность (mobile / tablet / desktop viewports)

#### 7.3 CI/CD (GitHub Actions)
- [ ] Pipeline: lint (ESLint) → type-check (tsc) → test (Vitest) → build (Vite)
- [ ] Автодеплой на staging (Vercel / Netlify / Cloudflare Pages)
- [ ] Проверка bundle size (< 200KB gzipped), fail при превышении
- [ ] Security scan: `npm audit`, проверка уязвимостей
- [ ] Lighthouse CI: performance >= 90, accessibility >= 90

#### 7.4 Storybook
- [ ] Storybook для всех UI-компонентов
- [ ] Stories: Avatar, MessageBubble, ChatListItem, InputBar, FrostedGlassBar
- [ ] Stories: Tapback, ContextMenu, TypingIndicator, CallScreen
- [ ] Stories: SecretChat визуальные отличия, KeyVerification
- [ ] Деплой Storybook на отдельный URL (Chromatic / GitHub Pages)

#### 7.5 IndexedDB + Service Workers
- [ ] IndexedDB: локальный кэш сообщений и ключей (зашифрованный)
- [ ] Service Worker: offline-режим (кэширование статики + shell)
- [ ] Service Worker: фоновая синхронизация отложенных сообщений
- [ ] Service Worker: push-уведомления (Web Push API)
- [ ] Стратегия кэширования: Cache First для статики, Network First для API

#### Definition of Done — Sprint 7
- [ ] Все тесты проходят (unit + E2E)
- [ ] TypeScript: 0 ошибок (`tsc --noEmit`)
- [ ] CI/CD pipeline зелёный
- [ ] Bundle size < 200KB gzipped
- [ ] npm audit: 0 critical / high уязвимостей
- [ ] Storybook задеплоен и актуален

---

## Фаза 0: Итого — 18 недель (Sprint 1–7)

---

## Фаза 1: Backend MVP (Недели 19–30, 12 недель)

### Sprint 8–9 (Недели 19–24): Серверная инфраструктура
- [ ] Elixir/Phoenix — WebSocket gateway
- [ ] Phoenix Channels — real-time messaging
- [ ] Phoenix Presence — онлайн-статусы
- [ ] PostgreSQL — пользователи, контакты, группы, метаданные
- [ ] Redis — сессии, кэш, rate limiting
- [ ] REST API: аутентификация, профиль, контакты
- [ ] WebSocket API: сообщения, статусы, typing indicators
- [ ] Docker + docker-compose для локальной разработки

### Sprint 10–11 (Недели 25–30): Расширенный бэкенд
- [ ] Rust-сервис: управление ключами, верификация подписей
- [ ] MinIO (S3-совместимый): хранение файлов, медиа, аватаров
- [ ] Загрузка / скачивание файлов через pre-signed URLs
- [ ] Go-сервис: push-уведомления (Web Push API)
- [ ] Kafka: очередь сообщений между сервисами
- [ ] Rate limiting + защита от спама
- [ ] JWT + refresh tokens аутентификация

---

## Фаза 2: Shared Core — KMP (Недели 31–42, 12 недель)

- [ ] Создание KMP-проекта (shared модуль)
- [ ] Модели данных в Kotlin: User, Chat, Message, Attachment, SecretChat
- [ ] Signal Protocol на Kotlin: X3DH, Double Ratchet, Curve25519, AES-256-GCM
- [ ] Сетевой слой: Ktor Client + WebSocket
- [ ] SQLDelight — локальная БД (кэш + ключи)
- [ ] Domain use cases: SendMessage, CreateSecretChat, VerifyKeys
- [ ] Shared ViewModels (Kotlin Coroutines + Flow)
- [ ] Тесты: crypto 100%, domain 90%

---

## Фаза 3: Android (Недели 43–54, 12 недель)

- [ ] Jetpack Compose UI в стиле iOS Messages Dark
- [ ] Экраны: ChatList, Conversation, SecretChat, Calls, Settings
- [ ] Firebase Cloud Messaging (push)
- [ ] Android Keystore (аппаратное хранение ключей)
- [ ] BiometricPrompt (fingerprint / face unlock)
- [ ] CameraX + MediaStore (фото, видео)
- [ ] Foreground Service для звонков
- [ ] Google Play Internal Testing

---

## Фаза 4: iOS (Недели 55–66, 12 недель)

- [ ] SwiftUI UI: NavigationStack, .ultraThinMaterial
- [ ] CallKit: системная интеграция звонков
- [ ] PushKit + Notification Service Extension (E2E в push)
- [ ] Keychain + Secure Enclave
- [ ] Core Haptics (Tapback)
- [ ] Live Activities + Dynamic Island
- [ ] ShareExtension
- [ ] TestFlight → App Store

---

## Фаза 5: Синхронизация и финализация (Недели 67–74, 8 недель)

- [ ] Multi-device: Sesame Protocol
- [ ] Web ↔ Android ↔ iOS синхронизация
- [ ] Desktop: Tauri обёртка
- [ ] Единый Push-сервис (FCM + APNs + Web Push)
- [ ] Accessibility: VoiceOver, TalkBack
- [ ] Локализация: RU, EN, KZ

---

## Документация

### Обязательная документация (ведётся с Sprint 1)
- [ ] **README.md** — инструкция по запуску проекта:
  - Системные требования (Node.js, pnpm/npm)
  - Клонирование репозитория
  - Установка зависимостей
  - Запуск dev-сервера, тестов, сборки
  - Переменные окружения (.env.example)
- [ ] **API-документация** (OpenAPI / Swagger):
  - REST endpoints (аутентификация, профиль, контакты, файлы)
  - WebSocket events (сообщения, статусы, typing)
  - Примеры запросов/ответов
- [ ] **ADR (Architecture Decision Records)**:
  - ADR-001: Выбор React + TypeScript + Vite
  - ADR-002: Zustand vs Redux для state management
  - ADR-003: Signal Protocol mock для MVP
  - ADR-004: Tailwind CSS 4 для стилизации
  - ADR-005: WebSocket vs SSE для real-time
  - Шаблон: Контекст → Решение → Последствия → Статус

---

## Команда и роли

| Роль | Зона ответственности | Стек |
|------|---------------------|------|
| **Frontend-разработчик** | UI/UX, компоненты, state management, тесты | React, TypeScript, Tailwind CSS, Vitest, Playwright, Storybook |
| **Backend-разработчик** | API, WebSocket, real-time, БД, аутентификация | Elixir/Phoenix, Rust (Actix/Axum), Go, PostgreSQL, Redis |
| **Mobile-разработчик** | Shared Core, Android, iOS приложения | Kotlin Multiplatform (KMP), Jetpack Compose, SwiftUI |
| **DevOps-инженер** | CI/CD, инфраструктура, деплой, мониторинг | GitHub Actions, Docker, Kubernetes, Prometheus, Grafana |
| **QA-инженер** | Тестирование (manual + automated), регрессия, нагрузочное | Vitest, Playwright, Appium, k6, BrowserStack |

> **Минимальная команда для MVP (Фаза 0):** 1 Frontend + 1 QA (или совмещение).
> **Полная команда (Фазы 1–5):** 2 Frontend + 2 Backend + 1 Mobile + 1 DevOps + 1 QA.

---

## Риски и митигация

| # | Риск | Вероятность | Влияние | Митигация |
|---|------|------------|---------|-----------|
| 1 | **Срыв сроков Фазы 0** — недооценка сложности UI (анимации, адаптив, crypto mock) | Высокая | Высокое | Буферные недели в Sprint 7; MVP-подход — сначала ядро, потом полировка; еженедельные демо |
| 2 | **Производительность при большом количестве сообщений** — DOM-замедление при >1000 сообщениях | Средняя | Высокое | Виртуализация (IntersectionObserver) с Sprint 6; профилирование React DevTools; бенчмарки в CI |
| 3 | **Совместимость браузеров** — различия в CSS backdrop-filter, Web Crypto API, WebSocket | Средняя | Среднее | BrowserStack для кросс-браузерного тестирования; progressive enhancement; feature detection |
| 4 | **Безопасность криптографического модуля** — mock-реализация может создать ложное чувство безопасности | Низкая | Критическое | Четкая маркировка "MOCK — не для продакшн"; в Фазе 2 замена на libsignal-protocol; security audit перед релизом |
| 5 | **Потеря данных при отсутствии бэкенда** — все данные в памяти на Фазе 0 | Высокая | Среднее | IndexedDB для локального кэша (Sprint 7); Service Worker для offline; предупреждение пользователю |
| 6 | **Текучка кадров / bus factor** — зависимость от одного разработчика | Средняя | Высокое | ADR-документация; code review; Storybook как живая документация; парное программирование |
| 7 | **Сложность интеграции KMP** — проблемы совместимости shared-кода между платформами | Средняя | Высокое | Раннее прототипирование KMP в Фазе 1; изоляция platform-specific кода; CI для всех таргетов |

---

## Критерии качества

| Метрика | Цель |
|---------|------|
| Lighthouse Performance | ≥ 90 |
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Bundle size (gzipped) | < 200KB |
| Тестовое покрытие | ≥ 80% |
| Accessibility | WCAG 2.1 AA |
| Поддержка браузеров | Chrome 90+, Safari 15+, Firefox 90+, Edge 90+ |
