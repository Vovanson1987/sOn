# sOn Messenger — Frontend Specification

## 1. Технологический стек

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| React | 19 | UI-фреймворк |
| TypeScript | 5.7 | Типизация |
| Vite | 6 | Сборка и dev-сервер |
| Tailwind CSS | 4 | Utility-first стилизация |
| Zustand | 5 | Управление состоянием |
| lucide-react | latest | Иконки (ChevronLeft, Phone, Video, Send, Lock, ...) |
| Vitest | latest | Unit/integration тесты |
| @testing-library/react | latest | Тестирование компонентов |

---

## 2. Дизайн-система — iOS Messages Dark Mode

### 2.1 Цветовая палитра

```css
:root {
  /* Backgrounds */
  --bg-primary:         #000000;   /* OLED black — основной фон */
  --bg-secondary:       #1C1C1E;   /* Поля ввода, карточки */
  --bg-tertiary:        #2C2C2E;   /* Hover-состояния */
  --bg-elevated:        #1C1C1E;   /* Модальные окна */

  /* Bubbles */
  --bubble-outgoing:    #007AFF;   /* iMessage синий */
  --bubble-outgoing-sms:#34C759;   /* SMS зелёный */
  --bubble-outgoing-secret-start: #34C759;
  --bubble-outgoing-secret-end:   #30D158;
  --bubble-incoming:    #26252A;   /* Входящие — тёмно-серый */

  /* Text */
  --text-primary:       #FFFFFF;
  --text-secondary:     #8E8E93;
  --text-tertiary:      #636366;

  /* Accents */
  --accent-blue:        #007AFF;   /* Ссылки, кнопки, iMessage */
  --accent-green:       #34C759;   /* SMS, секретные чаты */
  --accent-red:         #FF3B30;   /* Ошибки, удаление */
  --accent-orange:      #FF9500;
  --accent-yellow:      #FFCC00;
  --accent-purple:      #AF52DE;

  /* Separators */
  --separator:          #38383A;
  --separator-width:    0.5px;

  /* Apple Avatar Colors */
  --avatar-red:         #FF3B30;
  --avatar-orange:      #FF9500;
  --avatar-yellow:      #FFCC00;
  --avatar-green:       #34C759;
  --avatar-blue:        #007AFF;
  --avatar-purple:      #AF52DE;
  --avatar-gray:        #8E8E93;
}
```

### 2.2 Типографика

```css
:root {
  --font-family: system-ui, -apple-system, "SF Pro Text", "SF Pro Display",
                 "Helvetica Neue", Arial, sans-serif;

  /* Sizes */
  --font-large-title:   34px;  /* font-weight: 800 — "Сообщения" */
  --font-title:         17px;  /* font-weight: 600 — имена чатов */
  --font-body:          17px;  /* font-weight: 400 — текст сообщений */
  --font-subhead:       15px;  /* font-weight: 400 — превью, даты */
  --font-footnote:      13px;  /* font-weight: 400 — статусы доставки */
  --font-caption:       11px;  /* font-weight: 600 — имя в шапке чата */
  --font-micro:         9px;   /* font-weight: 400 — подпись "Текстовое сообщение" */
}
```

### 2.3 Скругления

```css
:root {
  --radius-avatar:      50%;    /* Круглые аватары */
  --radius-bubble:      18px;   /* Пузыри сообщений */
  --radius-bubble-grouped: 4px; /* Средние пузыри в группе */
  --radius-card:        12px;   /* Карточки, фото */
  --radius-button:      999px;  /* Pill shape */
  --radius-input:       18px;   /* Поле ввода */
}
```

### 2.4 Анимации

```css
/* Базовые переходы */
--transition-default: 300ms ease;
--transition-fast:    150ms ease;

/* Keyframes */
@keyframes typingDots {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30%           { opacity: 1;   transform: translateY(-4px); }
}

@keyframes pulseRing {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes fadeOut {
  0%   { opacity: 1; transform: scale(1);    filter: blur(0); }
  100% { opacity: 0; transform: scale(0.8);  filter: blur(10px); }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

@keyframes slideOutLeft {
  from { transform: translateX(0); }
  to   { transform: translateX(-30%); }
}

@keyframes springBounce {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes encryptFlash {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
```

---

## 3. Адаптивный дизайн (Breakpoints)

### 3.1 Mobile (< 768px) — ПРИОРИТЕТ

```
┌────────────────────┐     ┌────────────────────┐
│    < Сообщения   🔍│     │ ‹  👤 Имя    📹 📞│
│  ──────────────────│     │ ──────────────────  │
│  👤 900           ›│     │                     │
│     Владимир Ник...│     │    💬 Привет!       │
│  ──────────────────│     │              Привет │
│  👤 Ксенька Доч  ›│     │                     │
│     📎 Файл: 4957.│     │    💬 Как дела?     │
│  ──────────────────│     │         Хорошо, а   │
│  👤 Папа Петропа ›│     │         ты? 👍      │
│     Тест           │     │                     │
│  ──────────────────│     │                     │
│                     │     │                     │
│                     │     ├────────────────────┤
│ ───────────────────│     │ ＋ │Сообщение...│ 🎙│
│  💬  📞  👥  ⚙️   │     └────────────────────┘
└────────────────────┘
   Список чатов             Открытый чат
   (полноэкранный)          (полноэкранный)
```

- Полноэкранные режимы: СПИСОК или ЧАТ (не одновременно)
- Slide-переход: in/out (translateX, 300ms ease)
- Нижний tab bar: Чаты | Звонки | Контакты | Настройки
- Свайп по чату → "Удалить" / "Архивировать"
- Свайп по сообщению → reply
- safe-area-inset-bottom для iPhone с вырезом
- touch-action: manipulation
- -webkit-overflow-scrolling: touch

### 3.2 Tablet (768px — 1024px)

```
┌───────────────┬──────────────────────┐
│  Сообщения    │ ‹  👤 Имя    📹 📞  │
│ ─────────────│ ──────────────────── │
│ 👤 900      ›│                      │
│ 👤 Ксенька  ›│   💬 Привет!        │
│ 👤 Папа     ›│            Привет    │
│ 👤 MIRATORG ›│                      │
│               │   💬 Как дела?      │
│               │                      │
│               ├──────────────────────│
│               │ ＋ │Сообщение│ 🎙   │
└───────────────┴──────────────────────┘
  Sidebar 300px        Chat (flex)
```

### 3.3 Desktop (≥ 1024px)

```
┌──────────────┬─────────────────────┬─────────────┐
│  Сообщения   │ ‹  👤 Имя   📹 📞  │ Info Panel  │
│ ─────────────│ ─────────────────── │ ─────────── │
│ 👤 900     ›│                     │ 👤          │
│ 👤 Ксенька ›│   💬 Привет!       │ Алексей     │
│ 👤 Папа    ›│            Привет   │ +79001234567│
│ 👤 MIRATORG›│                     │ ─────────── │
│              │   💬 Как дела?     │ 🔕 Mute     │
│              │                     │ 🔍 Search   │
│              │                     │ 📎 Media    │
│              ├─────────────────────│ ─────────── │
│              │ ＋ │Сообщение│ 🎙  │ Shared      │
│              │                     │ 🖼 🖼 🖼   │
└──────────────┴─────────────────────┴─────────────┘
  Sidebar 380px     Chat (flex)      Info 320px
                                     (collapsible)
```

**Горячие клавиши:**
- `Enter` = отправить
- `Shift+Enter` = перенос строки
- `Esc` = закрыть info / отмена
- `Ctrl+K` = поиск по чатам
- `Ctrl+N` = новый чат
- Правый клик на сообщении → контекстное меню

---

## 4. Компоненты — Детальная спецификация

### 4.1 Avatar

```typescript
interface AvatarProps {
  size: 35 | 50 | 52 | 120;        // px
  src?: string;                      // URL фото
  name: string;                      // Для генерации инициалов
  isOnline?: boolean;                // Зелёная точка
  isGroup?: boolean;                 // Составной 2×2
  groupMembers?: string[];           // Имена для группового аватара
}
```

**Варианты:**
1. С фото: `<img>` в круге
2. Инициалы: 2 буквы на цветном фоне (цвет = hash(name) % palette.length)
3. Без фото: серый круг #636366 + белый SVG-силуэт
4. Групповой: 2×2 сетка мини-аватаров

### 4.2 MessageBubble

```typescript
interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  chatType: 'direct' | 'group' | 'secret';
  showSenderName?: boolean;          // Для групповых чатов
  onLongPress: (msg: Message) => void;
  onSwipeRight: (msg: Message) => void;
}
```

**CSS для хвостика (outgoing):**
```css
.bubble-tail-right::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -8px;
  width: 12px;
  height: 18px;
  background: var(--bubble-outgoing);
  clip-path: path('M0 0 C0 0, 0 18, 12 18 C5 18, 0 12, 0 0');
}
```

### 4.3 InputBar

```typescript
interface InputBarProps {
  chatType: 'direct' | 'group' | 'secret';
  replyTo?: Message | null;
  onSend: (text: string) => void;
  onCancelReply: () => void;
  onAttachment: () => void;
  onVoice: () => void;
}
```

**Состояния:**
- Пустое поле: [+] [Текстовое сообщение...] [🎙]
- С текстом: [+] [Привет, как дела?_____] [↑]
- С reply: [Reply цитата ✕] выше поля ввода
- В секретном чате: [+] [Сообщение...] [⏱] [↑]

### 4.4 CallScreen

```typescript
interface CallScreenProps {
  contact: Contact;
  callType: 'audio' | 'video';
  callStatus: 'ringing' | 'connecting' | 'active' | 'ended';
  duration: number;                  // секунды
  onEndCall: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
}
```

---

## 5. Zustand Stores

### 5.1 chatStore

```typescript
interface ChatStore {
  chats: Chat[];
  activeChatId: string | null;
  searchQuery: string;
  filter: 'all' | 'unread' | 'groups' | 'secret';

  // Actions
  setActiveChat: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  addChat: (chat: Chat) => void;
  updateChat: (id: string, updates: Partial<Chat>) => void;
  deleteChat: (id: string) => void;
  markAsRead: (chatId: string) => void;
}
```

### 5.2 messageStore

```typescript
interface MessageStore {
  messages: Record<string, Message[]>;  // chatId → messages
  typingUsers: Record<string, string[]>; // chatId → user names

  // Actions
  sendMessage: (chatId: string, text: string, replyTo?: string) => void;
  addMessage: (chatId: string, message: Message) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  addReaction: (chatId: string, messageId: string, emoji: string) => void;
  setTyping: (chatId: string, userName: string) => void;
  clearTyping: (chatId: string, userName: string) => void;
  loadMore: (chatId: string, before: string) => Promise<void>;
}
```

### 5.3 uiStore

```typescript
interface UIStore {
  currentScreen: 'chatList' | 'conversation' | 'settings' | 'contacts' | 'calls';
  showInfoPanel: boolean;
  showCreateGroup: boolean;
  showAttachmentPicker: boolean;
  activeCall: CallState | null;
  tapbackMessage: Message | null;     // Сообщение для Tapback overlay
  theme: 'dark' | 'light' | 'system';
  isMobile: boolean;

  // Actions
  navigate: (screen: string) => void;
  toggleInfoPanel: () => void;
  setTapbackMessage: (msg: Message | null) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}
```

---

## 6. TypeScript типы

### 6.1 Core Types

```typescript
type ChatType = 'direct' | 'group' | 'secret';
type MessageType = 'text' | 'image' | 'file' | 'voice' | 'location' | 'system';
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
type CallType = 'audio' | 'video';
type CallStatus = 'ringing' | 'connecting' | 'active' | 'ended';

interface User {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl?: string;
  statusText: string;
  isOnline: boolean;
  lastSeenAt: string;
}

interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  members: User[];
  lastMessage?: Message;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  // Secret chat
  isVerified?: boolean;
  selfDestruct?: number;
  updatedAt: string;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  replyTo?: {
    id: string;
    senderName: string;
    preview: string;
  };
  reactions: Record<string, string[]>;  // emoji → userIds
  attachment?: Attachment;
  selfDestructAt?: string;
  isDestroyed: boolean;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}

interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'voice' | 'location';
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  latitude?: number;
  longitude?: number;
}
```

---

## 7. Оптимизация производительности

| Техника | Применение |
|---------|-----------|
| `React.memo` | MessageBubble, ChatListItem, Avatar |
| `useMemo` | Отсортированные списки чатов, группировка сообщений |
| `useCallback` | Все обработчики событий в списках |
| `Виртуализация` | При > 100 сообщениях — IntersectionObserver, рендер только видимых |
| `CSS containment` | `contain: layout style paint` на пузырях и элементах списка |
| `will-change` | На анимируемых элементах (slide, fade) |
| `Image lazy loading` | `loading="lazy"` для аватаров и вложений вне viewport |
| `Code splitting` | React.lazy для CallScreen, Settings, SecretChat модулей |

---

## 8. Звуки (Web Audio API)

```typescript
function playNotificationSound() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 440;    // A4
  gain.gain.value = 0.1;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.stop(ctx.currentTime + 0.1);
}
```
