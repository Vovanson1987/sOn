import type { Message } from '@/types/message';

/** Моковые сообщения для чата с Vladimir */
export const vladimirMessages: Message[] = [
  {
    id: 'msg-v-1', chatId: 'chat-vladimir', senderId: 'user-vladimir', senderName: 'Vladimir',
    content: 'Привет! Давно не виделись', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-17T10:00:00Z',
  },
  {
    id: 'msg-v-2', chatId: 'chat-vladimir', senderId: 'user-me', senderName: 'Владимир',
    content: 'Привет! Да, надо встретиться', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-17T10:01:00Z',
    deliveredAt: '2026-03-17T10:01:01Z', readAt: '2026-03-17T10:01:30Z',
  },
  {
    id: 'msg-v-3', chatId: 'chat-vladimir', senderId: 'user-vladimir', senderName: 'Vladimir',
    content: 'Может в пятницу вечером? Я буду свободен после 18:00', type: 'text', status: 'read',
    reactions: { '👍': ['user-me'] }, isDestroyed: false, createdAt: '2026-03-17T10:02:00Z',
  },
  {
    id: 'msg-v-4', chatId: 'chat-vladimir', senderId: 'user-me', senderName: 'Владимир',
    content: 'Отлично, давай! Где встречаемся?', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-17T10:03:00Z',
    deliveredAt: '2026-03-17T10:03:01Z', readAt: '2026-03-17T10:03:15Z',
  },
  // --- Системное сообщение ---
  {
    id: 'msg-v-sys-1', chatId: 'chat-vladimir', senderId: 'system', senderName: '',
    content: '🌙 Vladimir заглушает уведомления', type: 'system', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-17T15:00:00Z',
  },
  // --- Следующий день ---
  {
    id: 'msg-v-5', chatId: 'chat-vladimir', senderId: 'user-vladimir', senderName: 'Vladimir',
    content: 'Давай в том кафе на Арбате, где в прошлый раз были', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T09:00:00Z',
  },
  {
    id: 'msg-v-6', chatId: 'chat-vladimir', senderId: 'user-me', senderName: 'Владимир',
    content: 'Хорошо, принял! В 19:00 буду там', type: 'text', status: 'delivered',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T09:01:00Z',
    deliveredAt: '2026-03-18T09:01:01Z',
  },
  {
    id: 'msg-v-7', chatId: 'chat-vladimir', senderId: 'user-vladimir', senderName: 'Vladimir',
    content: 'Привет! Как дела?', type: 'text', status: 'delivered',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T12:00:00Z',
  },
];

/** Моковые сообщения для чата с 900 (спам) */
export const chat900Messages: Message[] = [
  {
    id: 'msg-900-1', chatId: 'chat-900', senderId: 'user-900', senderName: '900',
    content: 'Владимир Николаевич, вы можете получить до 2 987 р. н...', type: 'text', status: 'delivered',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-17T14:30:00Z',
  },
];

/** Моковые сообщения для секретного чата с Алексеем */
export const secretAlexeyMessages: Message[] = [
  {
    id: 'msg-sa-sys', chatId: 'chat-secret-alexey', senderId: 'system', senderName: '',
    content: '🔒 Сообщения в этом чате защищены сквозным шифрованием по протоколу Signal. Только вы и Алексей можете их читать.',
    type: 'system', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T09:00:00Z',
  },
  {
    id: 'msg-sa-1', chatId: 'chat-secret-alexey', senderId: 'user-alexey', senderName: 'Алексей',
    content: 'Привет, проверяем шифрование', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T10:10:00Z',
  },
  {
    id: 'msg-sa-2', chatId: 'chat-secret-alexey', senderId: 'user-me', senderName: 'Владимир',
    content: 'Да, всё работает!', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T10:11:00Z',
    deliveredAt: '2026-03-18T10:11:01Z', readAt: '2026-03-18T10:11:05Z',
  },
  {
    id: 'msg-sa-3', chatId: 'chat-secret-alexey', senderId: 'user-alexey', senderName: 'Алексей',
    content: '🔒 Зашифрованное сообщение', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T10:15:00Z',
  },
  {
    id: 'msg-sa-destroyed', chatId: 'chat-secret-alexey', senderId: 'user-alexey', senderName: 'Алексей',
    content: '🔒 Сообщение удалено', type: 'text', status: 'read',
    reactions: {}, isDestroyed: true, createdAt: '2026-03-18T10:12:00Z',
  },
];

/** Моковые сообщения для групповго чата "Семья" */
export const familyMessages: Message[] = [
  {
    id: 'msg-f-sys', chatId: 'chat-family', senderId: 'system', senderName: '',
    content: 'Группа «👨‍👩‍👧 Семья» создана', type: 'system', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'msg-f-1', chatId: 'chat-family', senderId: 'user-mama', senderName: 'Мама',
    content: 'Всех с праздником! 🎉', type: 'text', status: 'read',
    reactions: { '❤️': ['user-me', 'user-ksenka'] }, isDestroyed: false, createdAt: '2026-03-18T07:00:00Z',
  },
  {
    id: 'msg-f-2', chatId: 'chat-family', senderId: 'user-ksenka', senderName: 'Ксенька Доч',
    content: 'Спасибо, мам! 💐', type: 'text', status: 'read',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T07:05:00Z',
  },
  {
    id: 'msg-f-3', chatId: 'chat-family', senderId: 'user-me', senderName: 'Владимир',
    content: 'Поздравляю всех! Вечером созвонимся?', type: 'text', status: 'delivered',
    reactions: {}, isDestroyed: false, createdAt: '2026-03-18T07:10:00Z',
    deliveredAt: '2026-03-18T07:10:01Z',
  },
];

/** Сообщение с ошибкой доставки */
export const failedMessage: Message = {
  id: 'msg-fail-1', chatId: 'chat-artem', senderId: 'user-me', senderName: 'Владимир',
  content: 'Перезвоню через 5 минут', type: 'text', status: 'failed',
  reactions: {}, isDestroyed: false, createdAt: '2026-02-28T15:01:00Z',
};

/** Все моковые сообщения по chatId */
export const mockMessages: Record<string, Message[]> = {
  'chat-vladimir': vladimirMessages,
  'chat-900': chat900Messages,
  'chat-secret-alexey': secretAlexeyMessages,
  'chat-family': familyMessages,
  'chat-artem': [
    {
      id: 'msg-a-1', chatId: 'chat-artem', senderId: 'user-artem', senderName: 'Артем Клиент',
      content: 'Сейчас не могу говорить', type: 'text', status: 'read',
      reactions: {}, isDestroyed: false, createdAt: '2026-02-28T15:00:00Z',
    },
    failedMessage,
  ],
};
