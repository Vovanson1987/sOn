# Паттерны из MAX Messenger для sOn

Анализ 4 репозиториев: max-ui, max-bot-api-client-ts, max-botapi-python, max-bot-api-client-go.

---

## 1. UI-компоненты (max-ui)

### Архитектура
- **Compound Components** — Avatar.Container/Image/Text/OnlineDot, Typography.Headline/Body/Label
- **Полиморфизм** через `asChild` (Radix UI Slot) — кнопка рендерится как `<a>`, `<div>` и т.д.
- **InnerClassNames** — тип-безопасная кастомизация внутренних элементов без prop drilling
- **Платформенный контекст** — `usePlatform()` → iOS vs Android (ripple vs highlight, иконки)

### Дизайн-токены

**Спейсинг:**
```
2xs: 2px, xs: 4px, s: 6px, m: 8px, l: 10px, xl: 12px, 2xl: 16px, 3xl: 20px, 4xl: 24px
```

**Радиусы:**
```
action-small: 10px, action-medium: 12px, action-large: 16px
card: 16px, rounded: 48px
```

**Типографика (iOS / SF Pro):**
```
display: 1.75rem, headline-large: 1.5rem, body-large: 1rem, label-small: 0.625rem
```

### Компоненты для адаптации в sOn

| MAX Компонент | Описание | Адаптация для sOn |
|---|---|---|
| Avatar (compound) | Image/Text/OnlineDot/CloseButton, squircle, 5 градиентов | Заменить текущий Avatar на compound |
| CellSimple | Ячейка списка: before/title/subtitle/after/chevron | Использовать для ChatListItem |
| CellList | Контейнер с header, island/full-width режимы | Секции настроек |
| Typography (namespace) | Display/Headline/Title/Body/Label/Action | Единая типографика |
| Button | 6 appearance × 4 mode, loading, stretched, asChild | Унификация кнопок |
| EllipsisText | line-clamp через CSS var | Замена ручного truncate |
| Input/SearchInput | Clear button, compact mode, platform-aware | Замена полей ввода |
| Tappable | Базовый интерактивный wrapper (ripple/highlight) | Для мобильной версии |

### Хуки

| Хук | Назначение |
|---|---|
| `useImageLoadingStatus` | Прелоад → idle/loading/loaded/error для аватарок |
| `useSystemColorScheme` | matchMedia dark/light + realtime listener |
| `useCallbackRef` | Стабильная ref-обёртка (предотвращает ре-рендер) |
| `useButtonLikeProps` | ARIA для полиморфных кнопок (disabled, tabIndex, role) |

### CSS-паттерны
- CSS Custom Properties для runtime-значений: `--size`, `--gap`, `--linesCount`
- BEM-style модули: `.Button_appearance_themed:where(.Button_mode_primary)`
- Reset-миксины: `reset-text-field`, `reset-clickable`
- Mixin-builder для appearance × mode комбинаций

---

## 2. Bot API — Типы и Интерфейсы

### Типы сообщений (адаптировать для sOn types/message.ts)

```typescript
// Типы чатов
type ChatType = 'dialog' | 'chat' | 'channel';
type ChatStatus = 'active' | 'removed' | 'left' | 'closed' | 'suspended';

// Действия отправителя (typing индикатор)
type SenderAction = 'typing_on' | 'sending_photo' | 'sending_video'
                  | 'sending_audio' | 'sending_file' | 'mark_seen';

// Права администраторов
type ChatPermissions = 'read_all_messages' | 'add_remove_members' | 'add_admins'
                     | 'change_chat_info' | 'pin_message' | 'write';

// Участник чата
type ChatMember = {
  user_id: number;
  name: string;
  username: string | null;
  is_bot: boolean;
  is_owner: boolean;
  is_admin: boolean;
  permissions: ChatPermissions[] | null;
  join_time: number;
  last_access_time: number;
  avatar_url?: string;
};

// Связанное сообщение (reply/forward)
type LinkedMessage = {
  type: 'forward' | 'reply';
  sender?: User | null;
  chat_id?: number;
  message: MessageBody;
};

// Статистика сообщения
type MessageStat = { views: number };
```

### 8 типов вложений

```typescript
type Attachment =
  | { type: 'image'; payload: { url: string; token: string; photo_id: number } }
  | { type: 'video'; payload: { url: string; token: string }; thumbnail?: string; width?: number; height?: number; duration?: number }
  | { type: 'audio'; payload: { url: string; token: string } }
  | { type: 'file'; payload: { url: string; token: string }; filename: string; size: number }
  | { type: 'sticker'; payload: { url: string; code: string }; width: number; height: number }
  | { type: 'contact'; payload: { vcf_info?: string; tam_info?: User } }
  | { type: 'share'; payload: { url?: string }; title?: string; description?: string; image_url?: string }
  | { type: 'location'; latitude: number; longitude: number }
  | { type: 'inline_keyboard'; payload: { buttons: Button[][] } };
```

### 7 типов inline-кнопок

```typescript
type Button =
  | { type: 'callback'; text: string; payload: string; intent?: 'default' | 'positive' | 'negative' }
  | { type: 'link'; text: string; url: string }
  | { type: 'request_contact'; text: string }
  | { type: 'request_geo_location'; text: string; quick?: boolean }
  | { type: 'chat'; text: string; chat_title: string; chat_description?: string }
  | { type: 'open_app'; text: string; url: string; payload?: string }
  | { type: 'clipboard'; text: string; payload: string };
```

### 15 типов событий (Update Types)

```
message_created, message_edited, message_removed, message_callback,
message_chat_created, bot_added, bot_removed, bot_started, bot_stopped,
user_added, user_removed, chat_title_changed, dialog_cleared,
dialog_muted, dialog_unmuted
```

---

## 3. API-эндпоинты (полная карта)

### Сообщения
| Метод | Описание | Есть в sOn |
|---|---|---|
| POST /messages | Отправить сообщение | ✅ |
| PUT /messages | Редактировать | ✅ |
| DELETE /messages | Удалить | ✅ |
| GET /messages | Получить по ID | ✅ |
| GET /messages?chat_id=&from=&to= | Пагинация | ✅ |
| POST /answers | Ответ на callback кнопки | ❌ |

### Чаты
| Метод | Описание | Есть в sOn |
|---|---|---|
| GET /chats | Список чатов (пагинация) | ✅ |
| GET /chats/{id} | Детали чата | ✅ |
| GET /chats?link= | Чат по ссылке | ✅ |
| PATCH /chats/{id} | Редактировать чат | ✅ |
| POST /chats/{id}/members | Добавить участников | ✅ |
| DELETE /chats/{id}/members/{uid} | Удалить участника | ✅ |
| GET /chats/{id}/members | Участники | ✅ |
| GET /chats/{id}/admins | Админы | ❌ |
| GET /chats/{id}/membership | Мой статус | ❌ |
| POST /chats/{id}/actions | Typing индикатор | ✅ (WS) |
| PUT /chats/{id}/pin | Пин сообщения | ✅ |
| DELETE /chats/{id}/pin | Анпин | ✅ |
| DELETE /chats/{id}/members/me | Покинуть чат | ❌ |

### Медиа
| Метод | Описание | Есть в sOn |
|---|---|---|
| POST /uploads | Получить upload URL | ✅ (MinIO) |
| Content-Range upload | Chunk-загрузка | ❌ |
| Multipart upload | FormData загрузка | ✅ |

### Подписки (для ботов)
| Метод | Описание | Есть в sOn |
|---|---|---|
| GET /subscriptions | Список webhook-ов | ❌ |
| POST /subscriptions | Подписаться | ❌ |
| DELETE /subscriptions | Отписаться | ❌ |
| GET /updates | Long polling | ❌ |

---

## 4. Паттерны для внедрения

### 4.1 Discriminated Union Updates (вместо generic event)
```typescript
// Текущий подход sOn (generic):
sendWS({ type: 'typing', chat_id })

// MAX подход (type-safe):
type WSEvent =
  | { type: 'message_created'; message: Message }
  | { type: 'message_edited'; message: Message }
  | { type: 'typing'; chat_id: string; user: User }
  | { type: 'user_added'; chat_id: string; user: User; inviter: User }
  // ...
```

### 4.2 Marker-based пагинация
```typescript
// Вместо offset/limit — marker для стабильной пагинации
type PaginatedResponse<T> = {
  items: T[];
  marker: number | null; // null = конец
};

// GET /api/chats?marker=1234&count=50
```

### 4.3 Retry для attachment-not-ready
```typescript
async function sendWithRetry(params: SendParams, retries = 3): Promise<Message> {
  try {
    return await api.messages.send(params);
  } catch (err) {
    if (err.code === 'attachment.not.ready' && retries > 0) {
      await new Promise(r => setTimeout(r, 1000 * (4 - retries)));
      return sendWithRetry(params, retries - 1);
    }
    throw err;
  }
}
```

### 4.4 Content-Range загрузка (для больших файлов)
```typescript
// Шаг 1: Получить upload URL
const { url, token } = await api.uploads.getUrl({ type: 'video' });

// Шаг 2: Загрузить чанками
for (const chunk of chunks) {
  await fetch(url, {
    method: 'POST',
    body: chunk.data,
    headers: {
      'Content-Range': `bytes ${chunk.start}-${chunk.end}/${totalSize}`,
      'Content-Type': 'application/x-binary',
    }
  });
}
```

### 4.5 Compound Avatar (из max-ui)
```tsx
// Вместо текущего <Avatar size={48} name="User" src={url} />
// Compound паттерн:
<Avatar.Container size={48} rightBottomCorner={<Avatar.OnlineDot />}>
  <Avatar.Image src={url} fallback="U" fallbackGradient="blue" />
</Avatar.Container>
```

### 4.6 Middleware для Bot API (Python-стиль)
```typescript
// Для будущего Bot API sOn:
class Dispatcher {
  on(event: UpdateType, handler: Handler): void
  use(middleware: Middleware): void
  
  async dispatch(update: Update): Promise<void> {
    const chain = [...this.middlewares, this.findHandler(update)];
    await compose(chain)(update);
  }
}
```

---

## 5. Что НЕ нужно из MAX

- **SCSS модули** — sOn использует Tailwind, переход на SCSS нецелесообразен
- **Radix UI Slot** — overkill для текущего масштаба sOn
- **Platform detection (iOS/Android)** — sOn desktop-first, мобильная версия позже
- **Storybook** — пока нет компонентной библиотеки
- **Webhook subscriptions** — нет Bot API, не актуально
- **VCF (vCard) парсинг** — контакты через другой механизм

---

## 6. Приоритеты внедрения

### Сейчас (следующие коммиты)
1. ✅ Дизайн-токены уже адаптированы (globals.css)
2. ❌ Compound Avatar → заменить текущий
3. ❌ EllipsisText → использовать вместо ручного truncate
4. ❌ useImageLoadingStatus → для аватарок в списке чатов

### Среднесрочно (Bot API, P3)
5. ❌ Типизация вложений (discriminated union)
6. ❌ Inline-кнопки для ботов
7. ❌ Marker-based пагинация
8. ❌ Content-Range загрузка для видео

### Долгосрочно
9. ❌ Bot API с middleware/dispatcher
10. ❌ Webhook подписки
11. ❌ Platform-aware компоненты (когда React Native)
