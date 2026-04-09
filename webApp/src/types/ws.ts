/**
 * Discriminated Union для WebSocket событий (паттерн из MAX).
 * Обеспечивает type-safe обработку через switch/if.
 */

import type { Message } from './message';
import type { User } from './user';
import type { Chat, SenderAction } from './chat';

// ==================== Входящие события (сервер → клиент) ====================

export interface MessageCreatedEvent {
  type: 'new_message';
  chatId: string;
  message: Message;
}

export interface MessageEditedEvent {
  type: 'message_edited';
  chatId: string;
  messageId: string;
  content: string;
  editedAt: string;
}

export interface MessageDeletedEvent {
  type: 'message_deleted';
  chatId: string;
  messageId: string;
}

export interface MessageCallbackEvent {
  type: 'message_callback';
  callbackId: string;
  chatId: string;
  messageId: string;
  payload: string;
  user: User;
}

export interface TypingEvent {
  type: 'typing';
  chat_id: string;
  user_id: string;
  user_name: string;
  action?: SenderAction;
}

export interface StopTypingEvent {
  type: 'stop_typing';
  chat_id: string;
  user_id: string;
}

export interface ReactionEvent {
  type: 'reaction';
  chatId: string;
  messageId: string;
  emoji: string;
  userId: string;
  action: 'added' | 'removed';
  reactions: Record<string, string[]>;
}

export interface ReadReceiptEvent {
  type: 'read';
  chatId: string;
  userId: string;
  messageId: string;
  readAt: string;
}

export interface DeliveredEvent {
  type: 'delivered';
  chatId: string;
  messageId: string;
  deliveredAt: string;
}

export interface UserAddedEvent {
  type: 'user_added';
  chatId: string;
  user: User;
  invitedBy?: User;
}

export interface UserRemovedEvent {
  type: 'user_removed';
  chatId: string;
  userId: string;
  removedBy?: string;
}

export interface ChatCreatedEvent {
  type: 'chat_created';
  chat: Chat;
}

export interface ChatUpdatedEvent {
  type: 'chat_updated';
  chatId: string;
  changes: Partial<Chat>;
}

export interface ChatDeletedEvent {
  type: 'chat_deleted';
  chatId: string;
}

export interface ChatTitleChangedEvent {
  type: 'chat_title_changed';
  chatId: string;
  title: string;
  changedBy: string;
}

export interface MessagePinnedEvent {
  type: 'message_pinned';
  chatId: string;
  messageId: string;
  pinnedBy: string;
}

export interface MessageUnpinnedEvent {
  type: 'message_unpinned';
  chatId: string;
  unpinnedBy: string;
}

export interface UserOnlineEvent {
  type: 'user_online';
  userId: string;
}

export interface UserOfflineEvent {
  type: 'user_offline';
  userId: string;
  lastSeenAt: string;
}

export interface CallStartedEvent {
  type: 'call_started';
  chatId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
  isGroup: boolean;
  roomName?: string;
}

export interface CallEndedEvent {
  type: 'call_ended';
  chatId: string;
  duration: number;
}

export interface GroupCallStartedEvent {
  type: 'group_call_started';
  chatId: string;
  roomName: string;
  initiator: User;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

/** Discriminated union — все входящие WS события */
export type WSIncomingEvent =
  | MessageCreatedEvent
  | MessageEditedEvent
  | MessageDeletedEvent
  | MessageCallbackEvent
  | TypingEvent
  | StopTypingEvent
  | ReactionEvent
  | ReadReceiptEvent
  | DeliveredEvent
  | UserAddedEvent
  | UserRemovedEvent
  | ChatCreatedEvent
  | ChatUpdatedEvent
  | ChatDeletedEvent
  | ChatTitleChangedEvent
  | MessagePinnedEvent
  | MessageUnpinnedEvent
  | UserOnlineEvent
  | UserOfflineEvent
  | CallStartedEvent
  | CallEndedEvent
  | GroupCallStartedEvent
  | ErrorEvent;

// ==================== Исходящие события (клиент → сервер) ====================

export interface SendTypingCommand {
  type: 'typing';
  chat_id: string;
}

export interface SendStopTypingCommand {
  type: 'stop_typing';
  chat_id: string;
}

export interface AuthCommand {
  type: 'auth';
  token: string;
}

export interface PingCommand {
  type: 'ping';
}

/** Discriminated union — все исходящие WS команды */
export type WSOutgoingCommand =
  | SendTypingCommand
  | SendStopTypingCommand
  | AuthCommand
  | PingCommand;

// ==================== Утилиты ====================

/** Тип входящего события */
export type WSEventType = WSIncomingEvent['type'];

/** Извлечь конкретный тип события */
export type ExtractWSEvent<T extends WSEventType> = Extract<WSIncomingEvent, { type: T }>;
