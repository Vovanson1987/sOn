# Аудит UI/UX/A11y/Code Quality — sOn Messenger (2026-03-20)

## Сводка

| Агент | CRITICAL | HIGH | MEDIUM | LOW | Итого |
|-------|----------|------|--------|-----|-------|
| UI Design | 2 | 6 | 10 | 8 | 26 |
| UX Flows | 7 | 9 | 13 | 10 | 39 |
| Accessibility | 7 | 12 | 12 | 6 | 37 |
| Code Quality | 5 | 14 | 7 | 2 | 28 |
| **Итого** | **21** | **41** | **42** | **26** | **130** |

---

## CRITICAL

### CR-01: Hook вызван в JSX (Rules of Hooks)
- **Файл:** `ConversationScreen.tsx:197`
- **Проблема:** `useAuthStore()` вызывается внутри JSX-пропа `<VerificationModal>`, условно. Крашит в StrictMode.
- **Исправление:** Вынести в переменную на уровне компонента.

### CR-02: Устаревший rgba(52,199,89) вместо #30D158
- **Файл:** `CallScreen.tsx:70,77`
- **Проблема:** Пульсирующие кольца используют старый iOS 13 Green вместо iOS 15+.
- **Исправление:** Заменить на `rgba(48,209,88,...)`.

### CR-03: Кнопки вложений/голоса/эмодзи не работают (нет onClick)
- **Файл:** `InputBar.tsx:53-59,91-97`
- **Проблема:** Plus, Mic, Smile — декораторы без обработчиков.
- **Исправление:** Подключить AttachmentPicker, VoiceRecorder, EmojiPicker.

### CR-04: MessageBubble игнорирует attachments
- **Файл:** `MessageBubble.tsx:100-104`
- **Проблема:** Рендерится только текст, `message.attachment` игнорируется.
- **Исправление:** Добавить switch по `message.type` с ImageViewer, FileAttachment, VoiceMessage.

### CR-05: Нет loading state при загрузке чатов
- **Файл:** `ChatList.tsx`
- **Проблема:** `isLoading` из chatStore не используется — показывается "Нет чатов".
- **Исправление:** Рендерить skeleton при `isLoading === true`.

### CR-06: Reply не сохраняется в сообщении
- **Файл:** `ConversationScreen.tsx:139-145`
- **Проблема:** `replyTo` не передаётся в `sendMessage()`.
- **Исправление:** Расширить `sendMessage(chatId, content, replyTo?)`.

### CR-07: Удаление сообщений только локальное
- **Файл:** `messageStore.ts:138`
- **Проблема:** Нет API-вызова, нет подтверждения. При reload восстанавливается.
- **Исправление:** Добавить DELETE API + confirm dialog.

### CR-08: Нет deep linking / URL routing
- **Файл:** `App.tsx`
- **Проблема:** URL не меняется, F5 сбрасывает контекст.
- **Исправление:** Интегрировать react-router-dom.

### CR-09: Focus trap отсутствует во всех модалках (8 шт.)
- **Файлы:** NewChatModal, VerificationModal, EncryptionInfo, SelfDestructPicker, AttachmentPicker, TapbackOverlay, ImageViewer, CallScreen
- **Проблема:** Tab пускает фокус за пределы модалки. Нарушение WCAG 2.1.2.
- **Исправление:** Создать `useFocusTrap` хук.

### CR-10: Контрастность #8E8E93 на #000 = 4.0:1 < 4.5:1 WCAG AA
- **Файлы:** 25 файлов, 64 вхождения
- **Проблема:** Вторичный текст не проходит WCAG AA для мелкого текста.
- **Исправление:** Поднять до `#ABABAF` (5.8:1).

### CR-11: Формы без `<label>` (AuthScreen)
- **Файл:** `AuthScreen.tsx:85-117`
- **Проблема:** Поля ввода используют только placeholder.
- **Исправление:** Добавить `aria-label` на все input.

### CR-12: Нет aria-live для входящих сообщений
- **Файл:** `ConversationScreen.tsx:276`
- **Проблема:** Скринридер не озвучивает новые сообщения.
- **Исправление:** Добавить скрытую aria-live область.

### CR-13: Нет `<main>` в мобильной версии
- **Файл:** `App.tsx:119-156`
- **Исправление:** Заменить div на `<main>`.

### CR-14: Кнопка X в NewChatModal без aria-label
- **Файл:** `NewChatModal.tsx:78`
- **Исправление:** Добавить `aria-label="Закрыть"`.

### CR-15: Map не сериализуется в keyStore (ломает E2EE)
- **Файл:** `keyStore.ts:250`
- **Проблема:** `skippedKeys: Map` → JSON.stringify → `{}`. При загрузке `.get()` падает.
- **Исправление:** Конвертировать Map в Array перед сериализацией.

### CR-16: Stale closure в encryptForSend
- **Файл:** `secretChatStore.ts:181`
- **Проблема:** `session` захвачен в начале, при concurrent encrypt перезаписывает ratchetState.
- **Исправление:** Использовать `s.sessions[chatId]` внутри updater.

### CR-17: sendMessage тип void vs async — race condition
- **Файл:** `messageStore.ts:16,72`
- **Проблема:** Двойной клик → два `msg-${Date.now()}` с возможно одинаковым id.
- **Исправление:** Тип → `Promise<void>`, добавить isSending флаг.

### CR-18: Утечка URL объектов в compressImage
- **Файл:** `fileUpload.ts:73`
- **Проблема:** `URL.createObjectURL()` без `revokeObjectURL()`.
- **Исправление:** Добавить `URL.revokeObjectURL(img.src)` в onload.

### CR-19: Утечка таймеров в callStore
- **Файл:** `callStore.ts:56-61,93-94`
- **Проблема:** setTimeout без cleanup, race при быстром старт/стоп.
- **Исправление:** Хранить timer id, отменять в endCall.

### CR-20: recvChainKey может быть null, используется с !
- **Файл:** `doubleRatchet.ts:221`
- **Проблема:** `kdfChainKey(currentState.recvChainKey!)` → crash если null.
- **Исправление:** Добавить явную проверку.

### CR-21: compressImage — нет onerror, Promise зависнет навсегда
- **Файл:** `fileUpload.ts:43-75`
- **Исправление:** Добавить `img.onerror = () => resolve(file)`.

---

## HIGH

### HI-01: Touch targets 36px в InputBar (нужно 44px)
- **Файл:** `InputBar.tsx:54,84`

### HI-02: Touch target 30px в AttachmentPicker
- **Файл:** `AttachmentPicker.tsx:64`

### HI-03: ChevronRight #38383A невидим в SettingsScreen
- **Файл:** `SettingsScreen.tsx:24`

### HI-04: Кнопка X в VerificationModal без touch target
- **Файл:** `VerificationModal.tsx:56`

### HI-05: Нет slideInRight анимации для ConversationScreen
- **Файл:** `ConversationScreen.tsx:182`

### HI-06: TabBar — нет saturate() в backdropFilter
- **Файл:** `TabBar.tsx:26`

### HI-07: Нет индикатора онлайн/оффлайн соединения
- **Файл:** `App.tsx`, `chatStore.ts:49`

### HI-08: NewChatModal поиск без debounce — race condition
- **Файл:** `NewChatModal.tsx:39-52`

### HI-09: useAutoReply hardcoded 'user-me'
- **Файл:** `useAutoReply.ts:29,42`

### HI-10: ChatListItem hardcoded 'user-me'
- **Файл:** `ChatListItem.tsx:15,25`

### HI-11: Секретный чат не персистируется между сессиями
- **Файл:** `secretChatStore.ts`

### HI-12: fetchMessages ошибка игнорируется
- **Файл:** `messageStore.ts:67-69`

### HI-13: Кнопка "Видеозвонок" не работает
- **Файл:** `ConversationScreen.tsx:272`

### HI-14: Нет обработки ошибки при создании чата
- **Файл:** `NewChatModal.tsx:54-59`

### HI-15: Автоскролл без проверки позиции
- **Файл:** `ConversationScreen.tsx:127-128`

### HI-16: WebSocket без exponential backoff
- **Файл:** `client.ts:191-197`

### HI-17: Fetch без таймаутов (AbortController)
- **Файл:** `client.ts:38`

### HI-18: JWT в localStorage (XSS уязвимость)
- **Файл:** `authStore.ts:30-31`

### HI-19: mapApiChat — нет guard'ов для server response
- **Файл:** `chatStore.ts:9-41`

### HI-20: WS new_message type жёстко 'text'
- **Файл:** `App.tsx:64-78`

### HI-21: Avatar aria-label на div без role="img"
- **Файл:** `Avatar.tsx:58,68`

### HI-22: Online span без role="img"
- **Файл:** `Avatar.tsx:85`

### HI-23: Декоративные иконки без aria-hidden в SettingsScreen
- **Файл:** `SettingsScreen.tsx:15`

### HI-24: TabBar badge не в aria-label
- **Файл:** `TabBar.tsx:48`

### HI-25: Реакции в MessageBubble без доступного описания
- **Файл:** `MessageBubble.tsx:107`

### HI-26: KeyExchangeAnimation прогресс без aria-live
- **Файл:** `KeyExchangeAnimation.tsx:62`

### HI-27: Область сообщений без role="log"
- **Файл:** `ConversationScreen.tsx:277`

### HI-28: SelfDestructPicker опции без aria-pressed
- **Файл:** `SelfDestructPicker.tsx:62`

### HI-29: Нет skip-to-content ссылки
- **Файл:** `App.tsx`

### HI-30: getToken() null в fileUpload Authorization header
- **Файл:** `fileUpload.ts:30`

### HI-31: canvas.getContext('2d')! без проверки null
- **Файл:** `fileUpload.ts:47`

### HI-32: regenerateKeys не обёрнут в useCallback
- **Файл:** `ConversationScreen.tsx:110-115`

### HI-33: Индексы массивов как key (DateSeparator, SelfDestructPicker)
- **Файлы:** `ConversationScreen.tsx:292`, `SelfDestructPicker.tsx:65`

### HI-34: lastOwnMessage useMemo — myUserId не в deps
- **Файл:** `ConversationScreen.tsx:130-137`

### HI-35: DeliveryStatus role="status" без явного aria-live
- **Файл:** `DeliveryStatus.tsx:29,37`

### HI-36: Нет aria-label на input поиска в NewChatModal
- **Файл:** `NewChatModal.tsx:85`

### HI-37: loadedChats Set не сериализуется
- **Файл:** `messageStore.ts:9,64`

### HI-38: fetchMessages loadedChats не обновляется
- **Файл:** `messageStore.ts:54-70`

---

## MEDIUM

### ME-01: AuthScreen заголовок 28px вместо 34px Large Title
### ME-02: VerificationModal заголовок 18px вместо 17px
### ME-03: Нет slideUp анимации для ActionSheet
### ME-04: SettingsScreen профиль 20px (не стандарт)
### ME-05: SearchBar rounded-[8px] вместо 10px
### ME-06: ReplyQuote кнопка X 24px < 44px
### ME-07: ChatList кнопка "Начать чат" < 44px
### ME-08: monospace без SF Mono fallback
### ME-09: Нет анимации для входящих сообщений
### ME-10: Пустые "Звонки"/"Контакты" без оформления
### ME-11: AuthScreen — нет валидации email на клиенте
### ME-12: AuthScreen — счётчик блокировки не live
### ME-13: SettingsScreen — все пункты декоративные
### ME-14: SearchBar нет кнопки очистки
### ME-15: Нет typing events от WebSocket
### ME-16: Нет отправки typing от пользователя
### ME-17: TapbackOverlay всегда по центру экрана
### ME-18: Нет кнопки "Повторить" при failed
### ME-19: SelfDestruct таймер не реализован
### ME-20: ImageViewer нет зума
### ME-21: FilterButton не подключён
### ME-22: Нет анимации перехода экранов
### ME-23: Нет глобального :focus-visible стиля
### ME-24: Кнопки без focus indicator (Settings, Attachment, SelfDestruct)
### ME-25: ConversationScreen header без <header>
### ME-26: DateSeparator без role="separator"
### ME-27: Tapback недоступен с клавиатуры
### ME-28: VoiceMessage без role="progressbar"
### ME-29: FileAttachment FileText без aria-hidden
### ME-30: ChatListHeader aria-pressed={undefined}
### ME-31: Suspense fallback без текста загрузки
### ME-32: VerificationModal emoji grid без описания
### ME-33: Дублирование focus management (6 компонентов)
### ME-34: useWindowWidth без debounce
### ME-35: config.ts window.location при SSR
### ME-36: aria-current="true" → "page"

---

## LOW

### LO-01: colors.ts #FFCC00 → #FFD60A (Yellow)
### LO-02: SettingsScreen #FF9500 → #FF9F0A (Orange)
### LO-03: EncryptionInfo/VerificationModal нет backdrop blur
### LO-04: SelfDestructPicker "Отмена" нет hover
### LO-05: TabBar text-[10px] vs WCAG 12px минимум
### LO-06: KeyExchangeAnimation нет кнопки "Пропустить"
### LO-07: InputBar textarea нет focus border
### LO-08: DateSeparator нет background
### LO-09: Avatar size union → number
### LO-10: ObjectURL утечка (уже в CR-18)
### LO-11: Hardcoded 'chat-900' в useAutoReply
### LO-12: Нет feedback при копировании (toast)
### LO-13: KeyExchangeAnimation блокирует, нет отмены
### LO-14: Нет подтверждения деструктивных действий E2EE
### LO-15: initSession без .catch()
### LO-16: Нет виртуализации списков
### LO-17: VoiceMessage heights пересчитываются
### LO-18: Hotkey Ctrl+K ищет несуществующий aria-label
### LO-19: Lock иконки без aria-hidden
### LO-20: lang="ru" не обновляется при смене языка
### LO-21: aria-live для счётчика непрочитанных
### LO-22: SkippedKeys Map (уже в CR-15)
