import type { Chat } from '@/types/chat';
import type { User } from '@/types/user';

const currentUser: User = {
  id: 'user-me',
  phone: '+79001234567',
  displayName: 'Владимир',
  statusText: 'Available',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
};

const users: User[] = [
  { id: 'user-900', phone: '900', displayName: '900', statusText: '', isOnline: false, lastSeenAt: '2026-03-17T14:30:00Z' },
  { id: 'user-ksenka', phone: '+79002222222', displayName: 'Ксенька Доч', avatarUrl: undefined, statusText: '', isOnline: true, lastSeenAt: '2026-03-16T10:00:00Z' },
  { id: 'user-papa', phone: '+79003333333', displayName: 'Папа Петропавловск', statusText: '', isOnline: false, lastSeenAt: '2026-03-11T09:00:00Z' },
  { id: 'user-miratorg', phone: '900100', displayName: 'MIRATORG', statusText: '', isOnline: false, lastSeenAt: '2026-03-11T08:00:00Z' },
  { id: 'user-rshb', phone: '900200', displayName: 'Рсхб', statusText: '', isOnline: false, lastSeenAt: '2026-03-10T12:00:00Z' },
  { id: 'user-artem', phone: '+79005555555', displayName: 'Артем Клиент', statusText: '', isOnline: false, lastSeenAt: '2026-02-28T15:00:00Z' },
  { id: 'user-vladimir', phone: '+79006666666', displayName: 'Vladimir', statusText: 'Working', isOnline: true, lastSeenAt: '2026-03-18T09:00:00Z' },
  { id: 'user-mama', phone: '+79007777777', displayName: 'Мама', statusText: '', isOnline: false, lastSeenAt: '2026-03-18T07:00:00Z' },
  { id: 'user-alexey', phone: '+79008888888', displayName: 'Алексей', statusText: '', isOnline: true, lastSeenAt: '2026-03-18T10:15:00Z' },
  { id: 'user-work1', phone: '+79009999901', displayName: 'Дмитрий', statusText: '', isOnline: true, lastSeenAt: '2026-03-18T08:00:00Z' },
  { id: 'user-work2', phone: '+79009999902', displayName: 'Анна', statusText: '', isOnline: false, lastSeenAt: '2026-03-17T18:00:00Z' },
];

export { currentUser, users };

export const mockChats: Chat[] = [
  {
    id: 'chat-900',
    type: 'direct',
    members: [currentUser, users[0]],
    lastMessage: {
      id: 'msg-1', chatId: 'chat-900', senderId: 'user-900', senderName: '900',
      content: 'Владимир Николаевич, вы можете получить до 2 987 р. н...', type: 'text',
      status: 'delivered', reactions: {}, isDestroyed: false, createdAt: '2026-03-17T14:30:00Z',
    },
    unreadCount: 1, isMuted: false, isArchived: false, updatedAt: '2026-03-17T14:30:00Z',
  },
  {
    id: 'chat-ksenka',
    type: 'direct',
    members: [currentUser, users[1]],
    lastMessage: {
      id: 'msg-2', chatId: 'chat-ksenka', senderId: 'user-ksenka', senderName: 'Ксенька Доч',
      content: '\u{1F4CE} Файл: 49574f08d447...', type: 'text',
      status: 'read', reactions: {}, isDestroyed: false, createdAt: '2026-03-16T10:00:00Z',
    },
    unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-03-16T10:00:00Z',
  },
  {
    id: 'chat-papa',
    type: 'direct',
    members: [currentUser, users[2]],
    lastMessage: {
      id: 'msg-3', chatId: 'chat-papa', senderId: 'user-me', senderName: 'Владимир',
      content: 'Тест', type: 'text',
      status: 'delivered', reactions: {}, isDestroyed: false, createdAt: '2026-03-11T09:00:00Z',
    },
    unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-03-11T09:00:00Z',
  },
  {
    id: 'chat-miratorg',
    type: 'direct',
    members: [currentUser, users[3]],
    lastMessage: {
      id: 'msg-4', chatId: 'chat-miratorg', senderId: 'user-miratorg', senderName: 'MIRATORG',
      content: 'Код для подтверждения списания баллов Мираторг 1871', type: 'text',
      status: 'read', reactions: {}, isDestroyed: false, createdAt: '2026-03-11T08:00:00Z',
    },
    unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-03-11T08:00:00Z',
  },
  {
    id: 'chat-rshb',
    type: 'direct',
    members: [currentUser, users[4]],
    lastMessage: {
      id: 'msg-5', chatId: 'chat-rshb', senderId: 'user-rshb', senderName: 'Рсхб',
      content: 'Этот абонент снова в сети. билайн', type: 'text',
      status: 'read', reactions: {}, isDestroyed: false, createdAt: '2026-03-10T12:00:00Z',
    },
    unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-03-10T12:00:00Z',
  },
  {
    id: 'chat-artem',
    type: 'direct',
    members: [currentUser, users[5]],
    lastMessage: {
      id: 'msg-6', chatId: 'chat-artem', senderId: 'user-artem', senderName: 'Артем Клиент',
      content: 'Сейчас не могу говорить', type: 'text',
      status: 'read', reactions: {}, isDestroyed: false, createdAt: '2026-02-28T15:00:00Z',
    },
    unreadCount: 0, isMuted: false, isArchived: false, updatedAt: '2026-02-28T15:00:00Z',
  },
  {
    id: 'chat-vladimir',
    type: 'direct',
    members: [currentUser, users[6]],
    lastMessage: {
      id: 'msg-7', chatId: 'chat-vladimir', senderId: 'user-vladimir', senderName: 'Vladimir',
      content: 'Привет! Как дела?', type: 'text',
      status: 'read', reactions: {}, isDestroyed: false, createdAt: '2026-03-18T09:00:00Z',
    },
    unreadCount: 2, isMuted: false, isArchived: false, updatedAt: '2026-03-18T09:00:00Z',
  },
  {
    id: 'chat-family',
    type: 'group',
    name: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467} Семья',
    members: [currentUser, users[7], users[2], users[1]],
    lastMessage: {
      id: 'msg-8', chatId: 'chat-family', senderId: 'user-mama', senderName: 'Мама',
      content: 'Всех с праздником!', type: 'text',
      status: 'read', reactions: { '\u2764\uFE0F': ['user-me', 'user-ksenka'] }, isDestroyed: false, createdAt: '2026-03-18T07:00:00Z',
    },
    unreadCount: 3, isMuted: false, isArchived: false, updatedAt: '2026-03-18T07:00:00Z',
  },
  {
    id: 'chat-work',
    type: 'group',
    name: '\u{1F4BC} Работа SCIF',
    members: [currentUser, users[6], users[9], users[10], users[5]],
    lastMessage: {
      id: 'msg-9', chatId: 'chat-work', senderId: 'user-work1', senderName: 'Дмитрий',
      content: 'Совещание перенесено на 15:00', type: 'text',
      status: 'delivered', reactions: {}, isDestroyed: false, createdAt: '2026-03-18T08:30:00Z',
    },
    unreadCount: 1, isMuted: true, isArchived: false, updatedAt: '2026-03-18T08:30:00Z',
  },
  {
    id: 'chat-secret-alexey',
    type: 'secret',
    name: 'Алексей',
    members: [currentUser, users[8]],
    lastMessage: {
      id: 'msg-10', chatId: 'chat-secret-alexey', senderId: 'user-alexey', senderName: 'Алексей',
      content: '\u{1F512} Зашифрованное сообщение', type: 'text',
      status: 'read', reactions: {}, isDestroyed: false, createdAt: '2026-03-18T10:15:00Z',
    },
    unreadCount: 0, isMuted: false, isArchived: false, isVerified: true, selfDestruct: 30, updatedAt: '2026-03-18T10:15:00Z',
  },
];
