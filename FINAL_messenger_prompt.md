# ФИНАЛЬНЫЙ ПРОМТ — Защищённый мессенджер в стиле iOS Messages

> Скопируй всё содержимое между ``` ``` и вставь в новый чат Claude

---

```
Создай детальную техническую спецификацию и архитектуру полнофункционального защищённого веб-мессенджера. Результат — единый React-артефакт (.jsx) с полной UI-реализацией фронтенда + подробные комментарии по архитектуре бэкенда.

═══════════════════════════════════════════════════════════════
1. ВИЗУАЛЬНЫЙ СТИЛЬ — iOS Messages (Dark Mode, pixel-perfect)
═══════════════════════════════════════════════════════════════

Интерфейс — ТОЧНАЯ копия приложения "Сообщения" (Messages) на iPhone с iOS 17+ в тёмной теме.

### 1.1 Общие параметры
- Фон: чисто чёрный #000000 (OLED dark mode)
- Шрифт: system-ui, -apple-system, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif
- Основной текст: белый #FFFFFF
- Вторичный текст: серый #8E8E93
- Акцентный цвет (iMessage): #007AFF
- Акцентный цвет (SMS): #34C759
- Акцентный цвет (секретный чат): зелёный градиент #34C759 → #30D158
- Разделители: 0.5px, цвет #38383A, с отступом слева от аватара
- Дизайн: полностью плоский (flat), без теней — чистый iOS-стиль
- Скругления: аватары — полный круг (50%), пузыри — 18px, кнопки — pill shape
- Анимации: все переходы 300ms ease, spring-анимация для пузырей

### 1.2 Экран списка чатов (главный)
- Левый верхний угол: кнопка "Править" (синий текст #007AFF)
- Правый верхний угол: круглая чёрная кнопка с иконкой фильтра (три горизонтальные линии)
- Заголовок: "Сообщения" — 34px, font-weight: 800, белый, отступ слева 16px (Large Title стиль iOS)
- Каждый чат в списке:
  - Аватар 50px (круг): фото / инициалы на цветном фоне / серый силуэт человека для контактов без фото
  - Имя (белый, 17px, semibold) + дата справа (серый #8E8E93, 15px) + шеврон "›"
  - Превью сообщения (серый, 15px, max 2 строки, overflow: hidden)
  - Вложения: "📎 Файл: имя..." 
  - Синяя точка слева от аватара для непрочитанных
  - Иконка 🔒 у имени секретного чата
- Нижний toolbar:
  - "🔍 Поиск" — серый rounded rectangle (#1C1C1E) слева
  - Иконка микрофона по центру (серая)
  - Кнопка нового сообщения справа — синий квадрат с карандашом (#007AFF)

### 1.3 Экран чата (переписка)

#### Шапка:
- Фон: rgba(0,0,0,0.85) + backdrop-filter: blur(20px) saturate(180%) — frosted glass
- Слева: "‹" назад — синий #007AFF
- Центр: аватар 35px сверху + имя (белый, 11px, semibold) + подпись "Текстовое сообщение • SMS" (серый, 9px)
- Справа: иконка видеозвонка 📹 (серая) + иконка телефона 📞

#### Пузыри сообщений:

Исходящие iMessage:
- Фон: #007AFF (чистый синий Apple)
- Текст: белый, 17px
- Расположение: справа, max-width: 75%
- Скругление: 18px
- "Хвостик" справа внизу (CSS clip-path / pseudo-element)

Исходящие SMS:
- Фон: #34C759 (зелёный Apple)
- Остальное — как iMessage

Исходящие секретного чата:
- Фон: линейный градиент #34C759 → #30D158
- Иконка 🔒 мелкая у времени

Входящие:
- Фон: #26252A (тёмно-серый)
- Текст: белый
- "Хвостик" слева внизу
- Расположение: слева, max-width: 75%

Группировка последовательных:
- Отступ между склеенными: 2px (вместо 8px)
- Хвостик только у последнего в группе
- Средние углы: 4px, крайние: 18px

#### Разделители дат:
- По центру, серый текст
- Форматы: "Сегодня 01:45" / "Вчера" / "Ср, 22 окт., 09:31" / "11.03.2026"

#### Статусы доставки:
- Под последним исходящим, справа, мелкий серый текст
- "Доставлено" / "Прочитано" (синим)
- Ошибка: красный круг ⚠ + "Не доставлено" (#FF3B30)

#### Системные сообщения:
- По центру, серый текст: "Номер изменен на Основной"
- С иконками: "🌙 Vladimir заглушает уведомления"
- "Неизвестный номер" — серый пузырь входящего

#### Панель ввода:
- Фон: чёрный + blur, прибита к низу (position: sticky / fixed)
- Кнопка "+" серый круг слева (30px)
- Текстовое поле: rounded rectangle #1C1C1E, placeholder "Текстовое сообщение..." серым
- Текст введён → справа синяя круглая кнопка ↑ (отправить)
- Текст пуст → справа серая иконка микрофона 🎙
- Поле расширяется до 5 строк (auto-resize textarea)
- В секретном чате: доп. кнопка ⏱ (таймер самоуничтожения)

### 1.4 Аватары (как на iOS)
1. Без фото: серый круг #636366 + белый силуэт человека (SVG)
2. Инициалы: 2 буквы на цветном круге (палитра Apple: #FF3B30, #FF9500, #FFCC00, #34C759, #007AFF, #AF52DE, #8E8E93)
3. С фото: круглое фото контакта
4. Групповой: составной аватар 2-4 мини-кружка в сетке


═══════════════════════════════════════════════════════════════
2. АДАПТИВНЫЙ ДИЗАЙН (Mobile-first + Desktop)
═══════════════════════════════════════════════════════════════

### 2.1 Мобильная версия (< 768px) — ПРИОРИТЕТ
- Полноэкранные режимы: СПИСОК ЧАТОВ или ОТКРЫТЫЙ ЧАТ (не одновременно)
- Переход в чат: slide-in справа (transform: translateX, 300ms ease)
- Назад к списку: slide-out влево
- Кнопка "‹ Назад" в шапке чата
- Нижняя панель ввода: padding-bottom: env(safe-area-inset-bottom) для iPhone с вырезом
- Нижний tab bar (стиль iOS): Чаты | Звонки | Контакты | Настройки
- Касание и удержание сообщения → Tapback реакции (с blur-фоном)
- Полноширинные элементы списка чатов, аватар 52px
- Свайп по сообщению вправо → reply
- Свайп по чату в списке влево → "Удалить" / "Архивировать" (красная/серая кнопка)
- touch-action: manipulation на всех интерактивных элементах
- -webkit-overflow-scrolling: touch для плавного скролла

### 2.2 Планшетная версия (768px — 1024px)
- Двухколоночный layout: sidebar (300px) + чат (flex)
- Info-панель: overlay поверх чата по клику на аватар в шапке
- Sidebar: собственный скролл, hover на чатах

### 2.3 Десктопная версия (≥ 1024px)
- Трёхколоночный layout: sidebar (380px) | чат (flex) | info-панель (320px, collapsible)
- Разделители: вертикальная линия 0.5px #38383A
- Sidebar: hover-эффект (#1C1C1E), selection (#007AFF20)
- Info-панель: выдвигается по клику на аватар/имя в шапке
- Горячие клавиши:
  - Enter = отправить
  - Shift+Enter = перенос строки
  - Esc = закрыть info / отмена
  - Ctrl+K = поиск по чатам
  - Ctrl+N = новый чат
- Правый клик на сообщении → контекстное меню (Ответить, Копировать, Переслать, Удалить)
- Drag & drop файлов в область чата (drop zone с подсветкой)
- Resize sidebar (cursor: col-resize)


═══════════════════════════════════════════════════════════════
3. ФУНКЦИОНАЛ
═══════════════════════════════════════════════════════════════

### 3.1 Личные чаты (1-на-1)
- Полная история с разделителями дат (формат iOS)
- Статусы: "Доставлено" / "Прочитано" / "Не доставлено ⚠"
- Индикатор "печатает..." — три анимированные точки в сером пузыре слева (CSS @keyframes)
- Онлайн-статус: зелёная точка на аватаре (10px, border: 2px solid #000)
- Автоответ собеседника через 1-3 сек с предварительным "печатает..."
- Время отправки: мелко внутри пузыря, справа внизу (серый/белый полупрозрачный)

### 3.2 Групповые чаты
- Составной аватар (2×2 сетка мини-кружков)
- Имя отправителя НАД входящим сообщением (уникальный цвет из палитры Apple)
- Создание: "+" → модальное окно → поиск + чекбоксы контактов → название группы → фото → "Создать"
- Системное сообщение при создании: "Группа «Название» создана"
- Info-панель группы: список участников с ролями (admin / member), кнопка "Добавить"
- Выход из группы (красная кнопка внизу info-панели)

### 3.3 Вложения и медиа
- Кнопка "+" → iOS Action Sheet (модальное снизу, с blur-фоном):
  - 📷 Камера
  - 🖼 Фото и видео
  - 📄 Документ
  - 📍 Геолокация
- Фото в чате: скруглённый прямоугольник (12px), max-width: 260px, при клике → fullscreen с затемнением + pinch-to-zoom
- Файлы: серая карточка (#1C1C1E), иконка типа файла + имя + размер
- Голосовые сообщения:
  - Кнопка 🎙 → удержание = запись (красная точка + "Запись 0:05")
  - В чате: волна (SVG / canvas), кнопка ▶ play, длительность "0:12"
  - Анимация проигрывания: бегущий индикатор по волне
- Drag & drop: визуальная подсветка зоны (border: 2px dashed #007AFF, фон затемнённый)
- Медиа-галерея в info-панели: сетка 3×N из превью

### 3.4 Аудио / Видео звонки
- Иконки 📞 и 📹 в шапке чата
- Полноэкранное модальное окно в стиле iOS Call Screen:
  - Фон: backdrop-filter: blur(40px), тёмный overlay
  - Аватар по центру (120px)
  - Имя + статус: "Вызов..." → "Звонок 00:00" (таймер mm:ss)
  - Пульсирующие кольца при вызове (CSS @keyframes pulse: scale 1→1.5, opacity 1→0)
  - Нижняя панель — круглые кнопки (60px):
    - 🔇 Микрофон вкл/выкл (toggle, фон меняется на белый при выкл)
    - 📹 Камера вкл/выкл (только для видео)
    - 🔊 Динамик
    - 🔴 Завершить (красный круг #FF3B30, всегда по центру внизу)
  - Имитация: через 2-3 сек → "принятие звонка" → таймер стартует
  - Видеозвонок: градиентный фон-заглушка вместо видеопотока + маленькое окно "своей камеры" (picture-in-picture, 100×140px, правый верхний угол, draggable)
- Экран входящего звонка:
  - Аватар + "Входящий звонок от [имя]"
  - Кнопки: "Отклонить" (красная) / "Принять" (зелёная)

### 3.5 Tapback реакции (iMessage)
- Долгое нажатие (500ms) или двойной тап → фон затемняется + blur(10px)
- Сообщение "приподнимается": scale(1.05), z-index: 100
- НАД пузырём: панель реакций (pill shape, тёмный фон #1C1C1E):
  - ❤️ 👍 👎 😂 ‼️ ❓
  - Каждая реакция — 36px, с hover-увеличением
- Выбранная реакция: бейдж 20px в правом верхнем углу пузыря (или левом для входящих)
- Тап вне = закрыть меню

### 3.6 Контекстное меню сообщений
- Появляется вместе с Tapback (под реакциями)
- Опции (каждая — строка с иконкой):
  - 💬 Ответить (reply с цитатой)
  - 📋 Копировать текст
  - ↗️ Переслать
  - 🗑 Удалить (красный текст)
- Reply: над полем ввода появляется цитата (серая полоска слева + превью текста + кнопка ✕ отмены)


═══════════════════════════════════════════════════════════════
4. СКВОЗНОЕ ШИФРОВАНИЕ (E2E) — СЕКРЕТНЫЕ ЧАТЫ
═══════════════════════════════════════════════════════════════

Реализация аналогична Telegram Secret Chats + элементы Signal Protocol.

### 4.1 Создание секретного чата
- В меню "+" → "🔒 Новый секретный чат" (отдельная кнопка с зелёным акцентом)
- Выбор контакта → анимация установки соединения:
  - Модальное окно на чёрном фоне
  - Два замка 🔒 по краям экрана
  - Между ними: анимированные летящие частицы (ключи/точки, CSS particles)
  - Прогресс-бар с этапами:
    1. "Генерация ключевой пары (Curve25519)..." ✓
    2. "Обмен ключами (X3DH)..." ✓
    3. "Инициализация Double Ratchet..." ✓
    4. "🔒 Защищённое соединение установлено"
  - Каждый этап появляется с задержкой 800ms, галочка с анимацией

### 4.2 Визуальные отличия секретных чатов
- Шапка: зелёный акцент, иконка 🔒 рядом с именем
- Пузыри исходящих: зелёный градиент (#34C759 → #30D158) вместо синих
- Пузыри входящих: чуть более тёмные (#1E1E22)
- Плашка в начале чата (серый rounded rect):
  "🔒 Сообщения в этом чате защищены сквозным шифрованием по протоколу Signal. Только вы и [имя] можете их читать. Ни сервер, ни третьи лица не имеют доступа к содержимому."
- В списке чатов: иконка 🔒 перед именем, зелёный бордюр слева (3px)

### 4.3 Криптографические функции (имитация для UI)

```javascript
// Генерация ключевой пары (Curve25519 mock)
function generateKeyPair() {
  const randomBytes = (n) => Array.from({length: n}, () => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  return {
    publicKey: btoa(randomBytes(32)),   // Base64-encoded 256-bit
    privateKey: btoa(randomBytes(32)),
    algorithm: 'Curve25519',
    created: new Date().toISOString()
  };
}

// Имитация X3DH обмена ключами
function performX3DH(myIdentityKey, myEphemeralKey, theirIdentityKey, theirSignedPreKey) {
  // DH1 = DH(IKa, SPKb)
  // DH2 = DH(EKa, IKb)  
  // DH3 = DH(EKa, SPKb)
  // SK = KDF(DH1 || DH2 || DH3)
  const sharedSecret = btoa(
    xorStrings(atob(myIdentityKey.privateKey), atob(theirSignedPreKey.publicKey))
  );
  return { sharedSecret, protocol: 'X3DH', timestamp: Date.now() };
}

// Double Ratchet — симметричное обновление ключей
function ratchetStep(chainKey) {
  // Имитация: каждое сообщение использует новый ключ
  return {
    messageKey: btoa(hashMock(chainKey + ':msg')),
    nextChainKey: btoa(hashMock(chainKey + ':chain')),
    ratchetIndex: Date.now()
  };
}

// Шифрование сообщения (AES-256-GCM mock)
function encryptMessage(plaintext, messageKey) {
  const iv = generateIV(); // 12 bytes random
  const encrypted = xorCipher(plaintext, messageKey); // Simplified XOR for demo
  return {
    ciphertext: btoa(encrypted),
    iv: btoa(iv),
    algorithm: 'AES-256-GCM',
    authTag: btoa(generateHMAC(encrypted, messageKey))
  };
}

// Дешифрация
function decryptMessage(encryptedObj, messageKey) {
  const decrypted = xorCipher(atob(encryptedObj.ciphertext), messageKey);
  return decrypted; // Plaintext
}
```

### 4.4 Экран верификации ключей
- Доступ: нажатие на 🔒 в шапке секретного чата
- Модальное окно (fullscreen на мобильном, centered на десктопе):
  - Заголовок: "Верификация шифрования"
  - Два аватара: "Вы" ↔ "Собеседник" с линией между ними
  - **Эмодзи-отпечаток** — сетка 4×4 из эмодзи (генерируется из хеша shared secret):
    ```
    🐶 🌺 🎸 🚀
    ☀️ 🎭 🔑 🌊  
    🎪 🍎 ⚡ 🏔️
    🎵 💎 🌙 🔥
    ```
  - **Hex fingerprint** (моноширинный шрифт, копируемый):
    `A1B2 C3D4 E5F6 7890 ABCD EF12 3456 7890 DEAD BEEF CAFE 0123`
  - **QR-код** — SVG-паттерн из хеша (для сканирования камерой собеседника)
  - Текст: "Сравните эти символы на устройствах обоих собеседников. Если они совпадают — канал защищён."
  - Кнопка "✓ Подтвердить верификацию" (зелёная, full-width)
  - После подтверждения: статус "✓ Verified" зелёным в шапке чата

### 4.5 Информация о шифровании (в info-панели)
- Секция "🔒 Шифрование":
  - Протокол: Signal Protocol (X3DH + Double Ratchet)
  - Алгоритмы: Curve25519, AES-256-GCM, HMAC-SHA256
  - Дата создания сессии: "15 марта 2026, 14:32"
  - Статус верификации: "✓ Подтверждено" / "⚠ Не верифицировано"
  - Ratchet index: #47 (количество обновлений ключа)
- Кнопка "Пересоздать ключи" → повторяет анимацию обмена
- Кнопка "Завершить секретный чат" (красная) → удаляет все сообщения и ключи

### 4.6 Анимация шифрования при отправке
- При нажатии "Отправить" в секретном чате:
  1. Текст в поле ввода → мерцание (opacity flash)
  2. Текст "рассыпается" на символы (CSS letter-spacing + opacity)
  3. Иконка 🔒 появляется по центру (scale: 0→1, 200ms)
  4. Зашифрованный пузырь "улетает" вверх в ленту сообщений
- Tooltip при наведении на сообщение: показывает зашифрованный вид:
  "🔒 aGVsbG8gd29ybGQhIFRoaXMgaXMgZW5jcnlwdGVkLi4u"

### 4.7 Таймер самоуничтожения
- Кнопка ⏱ в панели ввода (только в секретных чатах)
- При нажатии: iOS-стиль picker снизу:
  - Опции: Выкл | 5с | 15с | 30с | 1 мин | 5 мин | 1 час | 1 день
  - Выбранное значение → бейдж на кнопке ⏱
- Сообщения с таймером:
  - Иконка ⏱ + время рядом со временем отправки
  - После прочтения: запускается countdown
  - Круговой прогресс-бар (SVG circle, stroke-dashoffset) вокруг пузыря
  - По истечении: анимация — fade out + scale(0.8) + blur(10px), 500ms
  - Заменяется на: "🔒 Сообщение удалено" (серый курсив, не кликабельный)


═══════════════════════════════════════════════════════════════
5. РЕКОМЕНДУЕМЫЙ ТЕХНИЧЕСКИЙ СТЕК (в комментариях к коду)
═══════════════════════════════════════════════════════════════

В артефакте — только фронтенд (React). Но добавь подробные комментарии-блоки в начале файла, описывающие полную продакшн-архитектуру:

### 5.1 Frontend
- **SolidJS** или **React + TypeScript** — UI-фреймворк
- **Web Crypto API** — нативное аппаратно-ускоренное шифрование в браузере
- **libsodium.js** — fallback для Curve25519/XSalsa20
- **IndexedDB** — локальный кэш сообщений и ключей (зашифрованный)
- **Service Workers** — offline-режим, push-уведомления, фоновая синхронизация
- **WebSocket** — real-time (с fallback на SSE → long polling)
- **Web Audio API** — звуки уведомлений, воспроизведение голосовых
- **MediaRecorder API** — запись голосовых сообщений
- **WebRTC** — аудио/видео звонки (peer-to-peer с STUN/TURN)

### 5.2 Backend — Гибридная архитектура
- **Elixir + Phoenix** — WebSocket gateway, presence (онлайн-статусы), pub/sub
  - Phoenix Channels — миллионы одновременных подключений
  - OTP Supervisors — самовосстановление при сбоях
  - Кластеризация через libcluster
- **Rust (Actix-web / Axum + Tokio)** — криптографические операции:
  - Генерация и управление ключами (libsignal-protocol)
  - Обработка медиа (сжатие, thumbnail generation)
  - Валидация и санитизация файлов
  - Высоконагруженные API endpoints
- **Go** (опционально) — микросервисы:
  - Push-уведомления (FCM/APNs)
  - Модерация контента
  - Analytics pipeline

### 5.3 Протоколы
- **Signal Protocol** (полная реализация):
  - X3DH (Extended Triple Diffie-Hellman) — начальный обмен ключами
  - Double Ratchet — обновление ключей после каждого сообщения
  - Sesame — управление множеством устройств
- **Curve25519** — эллиптические кривые для DH
- **AES-256-GCM** — симметричное шифрование сообщений
- **HMAC-SHA256** — аутентификация
- **HKDF** — деривация ключей
- **MTProto 2.0** (опционально) — бинарный транспортный протокол (как Telegram)
- **QUIC / HTTP3** — улучшенная производительность на мобильных сетях
- **gRPC** — inter-service communication (между микросервисами)
- **WebSocket** — client ↔ server real-time
- **WebRTC + SRTP** — зашифрованные аудио/видео звонки
- **STUN/TURN** (coturn) — NAT traversal для звонков

### 5.4 Базы данных
- **ScyllaDB** — хранение сообщений (high-write, low-latency, как Discord)
- **PostgreSQL** — пользователи, контакты, группы, метаданные
- **Redis Cluster** — presence (онлайн-статусы), сессии, rate limiting, pub/sub
- **MinIO (S3-compatible)** — файлы, медиа, аватары
- **ClickHouse** — аналитика, логи (опционально)

### 5.5 Инфраструктура
- **Kubernetes** — оркестрация контейнеров
- **Istio** — service mesh, mTLS между сервисами, traffic management
- **Envoy** — edge proxy, TLS termination, rate limiting
- **Kafka** — очередь сообщений между сервисами
- **Prometheus + Grafana** — мониторинг
- **Jaeger** — distributed tracing
- **Vault (HashiCorp)** — управление секретами и ключами

### 5.6 Безопасность
- **TLS 1.3** — транспортное шифрование
- **Certificate Pinning** — защита от MITM
- **Key Transparency** — аудитируемый реестр публичных ключей (как у Meta Messenger)
- **Perfect Forward Secrecy** — компрометация ключа не раскрывает прошлые сообщения
- **Zero-Knowledge Architecture** — сервер никогда не видит plaintext
- **CSP + HSTS + X-Frame-Options** — защита веб-клиента
- **Rate Limiting** — защита от брутфорса и спама
- **PBKDF2 / Argon2id** — хеширование паролей


═══════════════════════════════════════════════════════════════
6. НАСТРОЙКИ
═══════════════════════════════════════════════════════════════

- Отдельный экран на мобильном / секция в sidebar на десктопе
- Профиль: аватар (кликабельный для смены) + имя + статус + номер телефона
- Тема: переключатель iOS-стиля (тёмная / светлая / системная)
- Уведомления: вкл/выкл, звук, предпросмотр на заблокированном экране
- Конфиденциальность:
  - "Кто видит мой статус онлайн": Все / Мои контакты / Никто
  - "Отчёты о прочтении": вкл/выкл
  - "Блокировка приложения": PIN / биометрия (визуализация)
- Хранилище: "Использовано: 1.2 ГБ", кнопка "Очистить кэш"
- Секция "Шифрование": информация о ключах устройства, экспорт ключей (mock)
- О приложении: версия, лицензии, ссылка на исходный код


═══════════════════════════════════════════════════════════════
7. МОКОВЫЕ ДАННЫЕ (реалистичные, из реальных скриншотов)
═══════════════════════════════════════════════════════════════

### Контакты:
1. "900" — аватар: серый силуэт. Превью: "Владимир Николаевич, вы можете получить до 2 987 р. н..." — Вчера
2. "Ксенька Доч..." — аватар: фото-placeholder (розовый). Превью: "📎 Файл: 49574f08d447..." — воскресенье
3. "Папа Петропа..." — аватар: "ПП" серый. Превью: "Тест" — 11.03.2026
4. "MIRATORG" — аватар: "M" зелёный. Превью: "Код для подтверждения списания баллов Мираторг 1871" — 11.03.2026
5. "Рсхб" — аватар: "Р" зелёный. Превью: "Этот абонент снова в сети. билайн" — 10.03.2026
6. "Артем Клиет..." — аватар: серый силуэт. Превью: "Сейчас не могу говорить" — 28.02.2026
7. "Vladimir" — аватар: фото-placeholder (синий). Чат с историей

### Групповые чаты:
1. "👨‍👩‍👧 Семья" — 4 участника (Мама, Папа, Ксенька, Владимир)
2. "💼 Работа SCIF" — 5 участников

### Секретный чат:
1. "🔒 Алексей" — зелёные пузыри, ключи сгенерированы, verified
   - Плашка шифрования в начале
   - Одно сообщение с таймером самоуничтожения (30с)
   - Одно "уничтоженное" сообщение: "🔒 Сообщение удалено"

### История сообщений:
- Разные типы: текст, фото-плейсхолдеры (серые прямоугольники с иконкой 🖼), файлы, голосовые
- Даты: от сегодня до месяца назад
- Статусы: "Доставлено", "Прочитано", "Не доставлено ⚠"
- Системные: "Номер изменен на Основной", "🌙 Vladimir заглушает уведомления"
- Tapback-реакции на 2-3 сообщениях
- Reply-цитата на 1 сообщение
- Сообщение с ошибкой доставки (красный !, "Не доставлено")

### Автоответы:
- Через 1-3 сек после отправки (randomized)
- Предварительно: "печатает..." (1-2 сек)
- Пул ответов: ["Ок", "Хорошо, принял", "👍", "Понял, спасибо!", "Перезвоню позже", "Сейчас занят", "Да, всё верно", "Нет, давай обсудим завтра"]


═══════════════════════════════════════════════════════════════
8. ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ К АРТЕФАКТУ
═══════════════════════════════════════════════════════════════

- Единый JSX-файл, export default
- React hooks: useState, useEffect, useRef, useCallback, useMemo
- Стилизация: Tailwind CSS + inline styles для специфичного (градиенты, blur, clip-path, animations)
- Иконки: lucide-react — ChevronLeft, ChevronRight, Phone, Video, Plus, Mic, Send, Lock, Search, SlidersHorizontal, Pencil, Smile, Paperclip, Camera, File, MapPin, X, Check, CheckCheck, AlertCircle, Clock, Moon, Settings, Users, Image, Trash2, Reply, Copy, Forward, Play, Pause, Shield, Key, QrCode, Timer, Volume2, VolumeX, VideoOff, MicOff, PhoneOff
- НЕ использовать: localStorage, sessionStorage, внешние API
- Оптимизация:
  - React.memo для MessageBubble, ChatListItem
  - useMemo для отсортированных списков
  - useCallback для обработчиков событий
  - Виртуализация: при > 100 сообщениях — рендерить только видимые (IntersectionObserver)
- CSS:
  - env(safe-area-inset-bottom) для iPhone
  - -webkit-backdrop-filter для Safari
  - @supports для проверки поддержки backdrop-filter
  - prefers-color-scheme для автоматической темы
- Медиа-запросы через Tailwind: sm:, md:, lg:, xl:
- touch-action: manipulation
- Анимации: CSS @keyframes (объявлены в <style> внутри компонента):
  - typingDots — пульсация точек
  - pulseRing — кольца при звонке
  - fadeOut — исчезновение при самоуничтожении
  - slideIn / slideOut — переходы экранов
  - encryptFlash — мерцание при шифровании
  - springBounce — появление пузырей
- Web Audio API: короткий синусоидальный тон (440Hz, 100ms) для уведомлений


═══════════════════════════════════════════════════════════════
9. МОБИЛЬНАЯ СТРАТЕГИЯ — Android + iOS (Kotlin Multiplatform)
═══════════════════════════════════════════════════════════════

Веб-версия — первый этап. Далее — нативные приложения для Android и iOS
с максимальным переиспользованием кода через Kotlin Multiplatform (KMP).

Добавь в начало JSX-артефакта подробный комментарий-блок с полной
архитектурой мобильного развития проекта.

### 9.1 Почему KMP, а не Flutter / React Native

Для мессенджера с E2E-шифрованием KMP — оптимальный выбор:
- Криптографический модуль (Signal Protocol) пишется ОДИН РАЗ на Kotlin
  и работает нативно на Android + компилируется в native binary для iOS
- UI остаётся полностью нативным: Jetpack Compose (Android) + SwiftUI (iOS) —
  максимальная производительность, нативные жесты, push-уведомления, камера, микрофон
- Нет overhead от JS-моста (React Native) или рендер-движка (Flutter)
- Прямой доступ к нативным API без плагинов: CallKit (iOS), Telecom (Android),
  CryptoKit (iOS), Android Keystore, биометрия, PushKit/FCM
- Инкрементальная миграция: можно начать с одного общего модуля и постепенно расширять

### 9.2 Архитектура KMP-проекта

```
messenger-kmp/
│
├── shared/                          # ← Общий код (Kotlin) — 60-70% кодовой базы
│   ├── build.gradle.kts
│   └── src/
│       ├── commonMain/kotlin/com/messenger/
│       │   ├── crypto/              # Signal Protocol реализация
│       │   │   ├── X3DH.kt                    # Extended Triple Diffie-Hellman
│       │   │   ├── DoubleRatchet.kt            # Double Ratchet Algorithm
│       │   │   ├── SignalSession.kt            # Управление сессиями
│       │   │   ├── KeyPairGenerator.kt         # Curve25519 ключи
│       │   │   ├── MessageEncryptor.kt         # AES-256-GCM шифрование
│       │   │   ├── KeyStore.kt                 # Хранение ключей (expect/actual)
│       │   │   ├── FingerprintGenerator.kt     # Визуальные отпечатки (эмодзи + hex)
│       │   │   └── SelfDestructTimer.kt        # Таймер самоуничтожения
│       │   │
│       │   ├── network/             # Сетевой слой
│       │   │   ├── WebSocketClient.kt          # WebSocket соединение (Ktor)
│       │   │   ├── ApiClient.kt                # REST API (Ktor HttpClient)
│       │   │   ├── GrpcClient.kt               # gRPC для inter-service
│       │   │   ├── MessageTransport.kt         # Отправка/получение сообщений
│       │   │   ├── PresenceManager.kt          # Онлайн-статусы
│       │   │   ├── SyncEngine.kt               # Синхронизация offline → online
│       │   │   ├── RetryPolicy.kt              # Reconnect + exponential backoff
│       │   │   └── CertificatePinner.kt        # Certificate pinning
│       │   │
│       │   ├── data/                # Модели данных и репозитории
│       │   │   ├── models/
│       │   │   │   ├── User.kt
│       │   │   │   ├── Chat.kt
│       │   │   │   ├── Message.kt
│       │   │   │   ├── Attachment.kt
│       │   │   │   ├── SecretChat.kt
│       │   │   │   ├── GroupChat.kt
│       │   │   │   ├── CallSession.kt
│       │   │   │   └── EncryptionKey.kt
│       │   │   ├── repository/
│       │   │   │   ├── ChatRepository.kt
│       │   │   │   ├── MessageRepository.kt
│       │   │   │   ├── ContactRepository.kt
│       │   │   │   ├── KeyRepository.kt
│       │   │   │   └── MediaRepository.kt
│       │   │   └── database/
│       │   │       ├── MessengerDatabase.sq     # SQLDelight схема
│       │   │       ├── ChatQueries.sq
│       │   │       └── MessageQueries.sq
│       │   │
│       │   ├── domain/              # Бизнес-логика (use cases)
│       │   │   ├── SendMessageUseCase.kt
│       │   │   ├── ReceiveMessageUseCase.kt
│       │   │   ├── CreateSecretChatUseCase.kt
│       │   │   ├── VerifyKeysUseCase.kt
│       │   │   ├── InitiateCallUseCase.kt
│       │   │   ├── CreateGroupUseCase.kt
│       │   │   ├── UploadAttachmentUseCase.kt
│       │   │   ├── SearchMessagesUseCase.kt
│       │   │   └── SelfDestructUseCase.kt
│       │   │
│       │   ├── viewmodel/           # Shared ViewModels (KMP-ViewModel)
│       │   │   ├── ChatListViewModel.kt
│       │   │   ├── ConversationViewModel.kt
│       │   │   ├── SecretChatViewModel.kt
│       │   │   ├── CallViewModel.kt
│       │   │   ├── SettingsViewModel.kt
│       │   │   └── ContactsViewModel.kt
│       │   │
│       │   └── util/                # Утилиты
│       │       ├── DateFormatter.kt             # Формат дат в стиле iOS
│       │       ├── Base64.kt
│       │       ├── Logger.kt                    # expect/actual логирование
│       │       └── CoroutineDispatchers.kt      # expect/actual диспатчеры
│       │
│       ├── androidMain/kotlin/      # Android-специфичный код
│       │   ├── crypto/AndroidKeyStore.kt        # Android Keystore для ключей
│       │   ├── network/AndroidWebSocket.kt      # OkHttp WebSocket
│       │   ├── notifications/FcmService.kt      # Firebase Cloud Messaging
│       │   ├── media/AndroidMediaRecorder.kt    # Запись голосовых
│       │   └── biometric/AndroidBiometric.kt    # Fingerprint / Face Unlock
│       │
│       ├── iosMain/kotlin/          # iOS-специфичный код
│       │   ├── crypto/IosKeyChain.kt            # iOS Keychain для ключей
│       │   ├── network/IosWebSocket.kt          # URLSessionWebSocketTask
│       │   ├── notifications/ApnsPush.kt        # Apple Push Notification Service
│       │   ├── media/IosMediaRecorder.kt        # AVAudioRecorder
│       │   ├── biometric/IosBiometric.kt        # Face ID / Touch ID
│       │   └── calls/CallKitIntegration.kt      # Интеграция с CallKit
│       │
│       └── commonTest/              # Общие тесты
│           ├── crypto/X3DHTest.kt
│           ├── crypto/DoubleRatchetTest.kt
│           ├── crypto/EncryptionTest.kt
│           └── domain/SendMessageTest.kt
│
├── androidApp/                      # ← Android UI (Jetpack Compose)
│   ├── build.gradle.kts
│   └── src/main/
│       ├── kotlin/com/messenger/android/
│       │   ├── MainActivity.kt
│       │   ├── MessengerApp.kt               # Navigation + DI (Koin)
│       │   ├── ui/
│       │   │   ├── theme/
│       │   │   │   ├── Theme.kt              # iOS Messages Dark тема
│       │   │   │   ├── Colors.kt             # #000, #007AFF, #34C759, #26252A
│       │   │   │   └── Typography.kt         # SF Pro-подобные стили
│       │   │   ├── chatlist/
│       │   │   │   ├── ChatListScreen.kt     # Список чатов (LazyColumn)
│       │   │   │   └── ChatListItem.kt       # Элемент: аватар + имя + превью
│       │   │   ├── conversation/
│       │   │   │   ├── ConversationScreen.kt # Экран переписки
│       │   │   │   ├── MessageBubble.kt      # Пузыри (синие/зелёные/серые)
│       │   │   │   ├── BubbleTail.kt         # Хвостики пузырей (Canvas)
│       │   │   │   ├── InputBar.kt           # Панель ввода (+ / текст / 🎙 / ↑)
│       │   │   │   ├── TapbackOverlay.kt     # Реакции (❤️👍👎😂‼️❓)
│       │   │   │   └── ReplyQuote.kt         # Цитата при ответе
│       │   │   ├── secretchat/
│       │   │   │   ├── SecretChatScreen.kt   # Зелёные пузыри + 🔒
│       │   │   │   ├── KeyExchangeAnimation.kt # Анимация обмена ключами
│       │   │   │   ├── VerificationScreen.kt # Эмодзи-сетка + hex fingerprint
│       │   │   │   └── SelfDestructOverlay.kt # Countdown + исчезновение
│       │   │   ├── calls/
│       │   │   │   ├── CallScreen.kt         # Экран звонка (blur + кольца)
│       │   │   │   ├── IncomingCallScreen.kt # Входящий звонок
│       │   │   │   └── VideoCallScreen.kt    # Видео + PiP
│       │   │   ├── media/
│       │   │   │   ├── ImageViewer.kt        # Fullscreen просмотр фото
│       │   │   │   ├── VoiceMessagePlayer.kt # Волна + play/pause
│       │   │   │   └── AttachmentPicker.kt   # Action Sheet: фото/файл/гео
│       │   │   ├── settings/
│       │   │   │   └── SettingsScreen.kt     # Профиль, тема, конфиденциальность
│       │   │   └── components/
│       │   │       ├── Avatar.kt             # Фото / инициалы / силуэт
│       │   │       ├── FrostedGlassBar.kt    # Blur-шапка
│       │   │       ├── iOSToggle.kt          # Переключатель в стиле iOS
│       │   │       └── ActionSheet.kt        # Нижнее модальное меню
│       │   └── service/
│       │       ├── MessengerFirebaseService.kt  # FCM push handler
│       │       └── CallService.kt               # Foreground service для звонков
│       └── res/
│           └── ...                              # Иконки, строки, манифест
│
├── iosApp/                          # ← iOS UI (SwiftUI)
│   ├── iosApp.xcodeproj
│   └── iosApp/
│       ├── MessengerApp.swift
│       ├── ContentView.swift                 # Navigation + TabView
│       ├── Views/
│       │   ├── ChatList/
│       │   │   ├── ChatListView.swift        # Список чатов (List + NavigationStack)
│       │   │   └── ChatRowView.swift         # Элемент: аватар + имя + превью
│       │   ├── Conversation/
│       │   │   ├── ConversationView.swift    # Экран переписки (ScrollView)
│       │   │   ├── MessageBubbleView.swift   # Пузыри с хвостиками
│       │   │   ├── InputBarView.swift        # Панель ввода
│       │   │   ├── TapbackView.swift         # Реакции overlay
│       │   │   └── ReplyQuoteView.swift      # Цитата
│       │   ├── SecretChat/
│       │   │   ├── SecretChatView.swift      # Зелёная тема + 🔒
│       │   │   ├── KeyExchangeView.swift     # Анимация ключей
│       │   │   ├── VerificationView.swift    # Сетка эмодзи + QR
│       │   │   └── SelfDestructView.swift    # Таймер уничтожения
│       │   ├── Calls/
│       │   │   ├── CallView.swift            # Экран звонка
│       │   │   └── VideoCallView.swift       # Видео
│       │   ├── Media/
│       │   │   ├── ImageViewerView.swift     # Fullscreen фото
│       │   │   ├── VoicePlayerView.swift     # Голосовое сообщение
│       │   │   └── AttachmentPickerView.swift
│       │   ├── Settings/
│       │   │   └── SettingsView.swift
│       │   └── Components/
│       │       ├── AvatarView.swift
│       │       ├── FrostedNavBar.swift        # .ultraThinMaterial
│       │       └── iOSActionSheet.swift
│       ├── Services/
│       │   ├── NotificationService.swift      # UNNotificationServiceExtension
│       │   ├── CallKitProvider.swift           # CXProvider для входящих звонков
│       │   └── PushHandler.swift              # APNs token registration
│       └── Extensions/
│           ├── Color+Messenger.swift          # Палитра #007AFF, #34C759...
│           └── View+FrostedGlass.swift        # .background(.ultraThinMaterial)
│
├── webApp/                          # ← Веб-версия (React/SolidJS)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/              # Компоненты UI (из JSX-артефакта)
│   │   ├── crypto/                  # Web Crypto API + libsodium.js
│   │   ├── network/                 # WebSocket + fetch
│   │   └── stores/                  # Состояние (Zustand / SolidJS stores)
│   └── package.json
│
├── backend/                         # ← Серверная часть
│   ├── gateway/                     # Elixir/Phoenix — WebSocket gateway
│   ├── crypto-service/              # Rust — управление ключами, верификация
│   ├── media-service/               # Rust — обработка файлов, thumbnails
│   ├── push-service/                # Go — FCM/APNs push-уведомления
│   └── docker-compose.yml
│
└── proto/                           # Protobuf-схемы (общие для всех клиентов)
    ├── messages.proto
    ├── auth.proto
    ├── calls.proto
    └── encryption.proto
```

### 9.3 Общие KMP-модули — что переиспользуется

| Модуль | Описание | % общего кода |
|--------|----------|:-------------:|
| **crypto** | Signal Protocol: X3DH, Double Ratchet, AES-256-GCM, ключи Curve25519, fingerprints | 90% |
| **network** | WebSocket (Ktor), REST API, gRPC, reconnect, certificate pinning | 85% |
| **data/models** | User, Chat, Message, Attachment, SecretChat, EncryptionKey | 100% |
| **data/database** | SQLDelight — локальная БД (кэш сообщений, ключи) | 95% |
| **data/repository** | ChatRepository, MessageRepository, KeyRepository | 90% |
| **domain** | Use cases: SendMessage, CreateSecretChat, VerifyKeys, InitiateCall | 100% |
| **viewmodel** | Shared ViewModels с Kotlin Coroutines + Flow | 85% |
| **util** | Форматирование дат, Base64, логирование | 80% |
| | **ИТОГО общего кода** | **~65%** |

### 9.4 Платформо-специфичный код (expect/actual)

```kotlin
// ═══ commonMain ═══
// Интерфейс — один раз
expect class SecureKeyStorage {
    fun storePrivateKey(keyId: String, keyData: ByteArray)
    fun retrievePrivateKey(keyId: String): ByteArray?
    fun deleteKey(keyId: String)
    fun hasKey(keyId: String): Boolean
}

expect class BiometricAuth {
    suspend fun authenticate(reason: String): BiometricResult
    fun isAvailable(): Boolean
}

expect class PushNotificationManager {
    fun registerForPush()
    fun getToken(): String?
}

// ═══ androidMain ═══
actual class SecureKeyStorage {
    private val keyStore = java.security.KeyStore.getInstance("AndroidKeyStore")
    actual fun storePrivateKey(keyId: String, keyData: ByteArray) {
        // Android Keystore — аппаратное хранилище ключей
        // Ключи никогда не покидают Secure Element / TEE
    }
    // ...
}

actual class BiometricAuth {
    actual suspend fun authenticate(reason: String): BiometricResult {
        // BiometricPrompt API (Fingerprint / Face Unlock)
    }
}

actual class PushNotificationManager {
    actual fun registerForPush() {
        // Firebase Cloud Messaging (FCM)
    }
}

// ═══ iosMain ═══
actual class SecureKeyStorage {
    actual fun storePrivateKey(keyId: String, keyData: ByteArray) {
        // iOS Keychain Services — kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        // С флагом kSecAttrTokenID для Secure Enclave
    }
    // ...
}

actual class BiometricAuth {
    actual suspend fun authenticate(reason: String): BiometricResult {
        // LocalAuthentication framework (Face ID / Touch ID)
        // LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)
    }
}

actual class PushNotificationManager {
    actual fun registerForPush() {
        // Apple Push Notification Service (APNs) + PushKit для VoIP
    }
}
```

### 9.5 Ключевые KMP-библиотеки

| Назначение | Библиотека | Платформы |
|------------|-----------|-----------|
| HTTP-клиент + WebSocket | **Ktor Client** | Android, iOS, Web (JS) |
| Локальная БД | **SQLDelight** | Android (SQLite), iOS (SQLite), Web (IndexedDB adapter) |
| Сериализация | **kotlinx.serialization** | Все |
| Корутины | **kotlinx.coroutines** | Все |
| DI (инъекция зависимостей) | **Koin** | Все |
| Shared ViewModel | **KMP-ViewModel (Rickclephas)** | Android, iOS |
| Криптография | **Libsodium KMP** / **Multiplatform Crypto** | Android, iOS |
| Навигация | **Decompose** или **Voyager** | Android (Compose), iOS (SwiftUI adapter) |
| Дата/время | **kotlinx-datetime** | Все |
| Логирование | **Napier** | Все |
| Настройки | **multiplatform-settings** | Android (SharedPrefs), iOS (UserDefaults) |
| Изображения | **Coil** (Android) / **SDWebImage** (iOS) | Раздельно |
| Protobuf | **pbandk** | Все |
| WebRTC | **nativный** — expect/actual | Google WebRTC (Android), Apple WebRTC (iOS) |

### 9.6 Нативные интеграции (не KMP)

#### Android-only:
- **Foreground Service** — поддержание звонка при свёрнутом приложении
- **Firebase Cloud Messaging** — push-уведомления
- **Android Keystore + StrongBox** — аппаратное хранение ключей шифрования
- **MediaProjection** — screen sharing в видеозвонках
- **Notification Channels** — разделение: сообщения / звонки / системные
- **WorkManager** — фоновая синхронизация сообщений
- **Adaptive Icons** — иконка в стиле iOS Messages (синий градиент + белый пузырь)

#### iOS-only:
- **CallKit** (CXProvider) — интеграция звонков с системным экраном вызова iPhone
- **PushKit** — VoIP push для пробуждения приложения при звонке
- **Notification Service Extension** — дешифрация push-уведомлений на устройстве
- **Keychain + Secure Enclave** — аппаратное хранение ключей шифрования
- **Core Haptics** — тактильная отдача при реакциях (Tapback)
- **ShareExtension** — отправка файлов в мессенджер из других приложений
- **WidgetKit** — виджет на домашнем экране (последние сообщения)
- **Live Activities** — отображение активного звонка на Dynamic Island / Lock Screen
- **App Intents** — интеграция с Siri: "Отправь сообщение [имя] через [мессенджер]"

### 9.7 План миграции: Web → Android → iOS

```
ФАЗА 0: WEB MVP (Месяцы 1-3)                        ← МЫ ЗДЕСЬ
├── React/SolidJS артефакт (из этого промта)
├── Базовый бэкенд: Elixir/Phoenix + PostgreSQL
├── WebSocket для real-time
├── Web Crypto API для E2E-шифрования
├── Деплой: Docker + Kubernetes
└── Результат: работающая веб-версия

ФАЗА 1: SHARED CORE (Месяцы 3-5)
├── Создание KMP-проекта (shared модуль)
├── Перенос моделей данных в Kotlin (commonMain)
├── Реализация Signal Protocol на Kotlin:
│   ├── X3DH + Double Ratchet
│   ├── Curve25519 (через libsodium-kmp)
│   └── AES-256-GCM шифрование
├── Сетевой слой: Ktor Client + WebSocket
├── SQLDelight — локальная БД
├── Покрытие тестами: crypto (100%), domain (90%)
└── Результат: общее ядро, готовое для подключения UI

ФАЗА 2: ANDROID (Месяцы 5-7)
├── androidApp модуль + Jetpack Compose UI
├── Экран списка чатов (LazyColumn, Material3 + iOS-кастомизация)
├── Экран чата: пузыри, хвостики, группировка, Tapback
├── Секретные чаты: зелёная тема, анимация ключей, верификация
├── Звонки: CallScreen + интеграция с ConnectionService
├── Push: Firebase Cloud Messaging
├── Медиа: голосовые, фото, файлы (CameraX + MediaStore)
├── Биометрия: BiometricPrompt для PIN/секретных чатов
├── Beta-тестирование: Google Play Internal Testing
└── Результат: Android-приложение в Google Play

ФАЗА 3: iOS (Месяцы 7-9)
├── iosApp модуль + SwiftUI UI
├── Подключение shared KMP через CocoaPods / SPM
├── UI: NavigationStack, .ultraThinMaterial, нативные жесты
├── Пузыри: идентичные iOS Messages (SwiftUI Canvas для хвостиков)
├── CallKit: системная интеграция звонков
├── PushKit + Notification Service Extension (E2E в push)
├── Keychain + Secure Enclave для ключей
├── Core Haptics для Tapback
├── Live Activities + Dynamic Island для звонков
├── TestFlight beta → App Store
└── Результат: iOS-приложение в App Store

ФАЗА 4: СИНХРОНИЗАЦИЯ И POLISH (Месяцы 9-11)
├── Multi-device: один аккаунт на нескольких устройствах
│   └── Sesame Protocol (расширение Signal для multi-device)
├── Web ↔ Android ↔ iOS: синхронизация сообщений и ключей
├── Desktop: Electron / Tauri обёртка над веб-версией
├── Единый Push-сервис: FCM (Android) + APNs (iOS) + Web Push
├── Performance: профилирование, оптимизация cold start
├── Accessibility: VoiceOver (iOS), TalkBack (Android)
├── Локализация: русский, английский, казахский
└── Результат: полная экосистема на всех платформах

ФАЗА 5: МАСШТАБИРОВАНИЕ (Месяц 12+)
├── Post-Quantum Cryptography (PQC): подготовка к квантовым компьютерам
│   └── CRYSTALS-Kyber для обмена ключами
├── Decentralized identity: без привязки к номеру телефона (как Session)
├── Onion routing: маршрутизация через несколько серверов (анонимность)
├── Open source: публикация клиентских приложений
├── Security audit: независимый аудит криптографии
└── Federation: возможность подключения сторонних серверов
```

### 9.8 Общая схема архитектуры (все платформы)

```
┌─────────────────────────────────────────────────────────────┐
│                      КЛИЕНТЫ                                │
│                                                             │
│  ┌───────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │  Web App  │  │  Android App  │  │      iOS App        │  │
│  │ React/TS  │  │Jetpack Compose│  │      SwiftUI        │  │
│  │ Web Crypto│  │               │  │                     │  │
│  └─────┬─────┘  └──────┬────────┘  └──────────┬──────────┘  │
│        │               │                      │             │
│        │        ┌──────┴──────────────────────┘             │
│        │        │    KMP Shared Module (Kotlin)             │
│        │        │    ┌────────────────────────┐             │
│        │        │    │ Signal Protocol (E2E)  │             │
│        │        │    │ Network (Ktor + WS)    │             │
│        │        │    │ SQLDelight (local DB)  │             │
│        │        │    │ Domain (use cases)     │             │
│        │        │    │ ViewModels (Flow)      │             │
│        │        │    └────────────────────────┘             │
│        │        │                                           │
└────────┼────────┼───────────────────────────────────────────┘
         │        │
    WebSocket  WebSocket + gRPC
         │        │
┌────────┴────────┴───────────────────────────────────────────┐
│                       BACKEND                               │
│                                                             │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Elixir/Phoenix │  │  Rust Service │  │  Go Service  │  │
│  │   WS Gateway     │  │  Crypto + Media│ │  Push + FCM  │  │
│  │   Presence       │  │  Key Mgmt     │  │  APNs        │  │
│  │   Pub/Sub        │  │  File Process │  │  Analytics   │  │
│  └────────┬─────────┘  └──────┬───────┘  └──────┬───────┘  │
│           │                   │                  │          │
│  ┌────────┴───────────────────┴──────────────────┘          │
│  │              Kafka (Message Bus)                          │
│  └───────────────────┬──────────────────────────┘           │
│                      │                                      │
│  ┌─────────┐  ┌──────┴──┐  ┌───────┐  ┌───────┐           │
│  │ScyllaDB │  │PostgreSQL│  │ Redis │  │ MinIO │           │
│  │Messages │  │Users/Meta│  │Cache  │  │Files  │           │
│  └─────────┘  └─────────┘  └───────┘  └───────┘           │
│                                                             │
│  Infrastructure: Kubernetes + Istio + Vault + Prometheus    │
└─────────────────────────────────────────────────────────────┘
```
```

---

## Инструкция по использованию

1. Скопируй **весь текст** между ``` и вставь в **новый чат Claude**
2. Claude сгенерирует один большой JSX-файл — готовый артефакт веб-версии
3. Если код обрезается — напиши: **"Продолжи код с того места, где остановился"**
4. Для итеративных улучшений веб-версии:
   - "Добавь send-эффекты: Slam, Loud, Gentle, Invisible Ink"
   - "Сделай Digital Touch — рисование и отправку скетчей"
   - "Добавь стикеры и GIF-поиск (через GIPHY API mock)"
   - "Реализуй PIN-код / Face ID экран для секретных чатов"
   - "Добавь пересылку сообщений между чатами"
   - "Сделай полнотекстовый поиск по всем чатам"
   - "Добавь светлую тему со всеми стилями"
   - "Добавь экран регистрации / входа с анимацией"
5. Для мобильной разработки (отдельные промты):
   - "Сгенерируй build.gradle.kts для KMP shared-модуля с зависимостями Ktor, SQLDelight, kotlinx.serialization"
   - "Напиши X3DH.kt и DoubleRatchet.kt для commonMain в KMP-проекте"
   - "Создай ChatListScreen.kt на Jetpack Compose в стиле iOS Messages Dark Mode"
   - "Напиши ConversationView.swift на SwiftUI с пузырями и хвостиками iMessage"
   - "Реализуй SecureKeyStorage через expect/actual для Android Keystore и iOS Keychain"
   - "Напиши CallKitProvider.swift для интеграции VoIP-звонков на iOS"
   - "Создай Notification Service Extension для дешифрации E2E push на iOS"
