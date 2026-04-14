import type { User } from './user';
import type { Message } from './message';

// ==================== Chat Types (расширено из MAX) ====================

export type ChatType = 'direct' | 'group' | 'secret' | 'channel';
export type ChatStatus = 'active' | 'removed' | 'left' | 'closed' | 'suspended';

/** Действия отправителя (typing индикатор, как в MAX) */
export type SenderAction =
  | 'typing_on'
  | 'sending_photo'
  | 'sending_video'
  | 'sending_audio'
  | 'sending_file'
  | 'mark_seen';

/** Права администратора (как в MAX) */
export type ChatPermission =
  | 'read_all_messages'
  | 'add_remove_members'
  | 'add_admins'
  | 'change_chat_info'
  | 'pin_message'
  | 'write'
  | 'delete_messages'
  | 'ban_members';

/** Участник чата с правами (расширенный из MAX) */
export interface ChatMember {
  userId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  isBot: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  permissions: ChatPermission[] | null;
  joinTime: string;
  lastAccessTime?: string;
  /** Кем добавлен */
  invitedBy?: string;
}

/** Пригласительная ссылка */
export interface InviteLink {
  id: string;
  chatId: string;
  code: string;
  url: string;
  createdBy: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  status?: ChatStatus;
  name?: string;
  description?: string;
  members: User[];
  lastMessage?: Message;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  /** Закреплён ли чат в списке (отображает значок булавки) */
  isPinned?: boolean;
  isVerified?: boolean;
  isPublic?: boolean;
  /** Ссылка (для публичных чатов/каналов) */
  link?: string;
  /** Иконка чата */
  iconUrl?: string;
  selfDestruct?: number;
  pinnedMessageId?: string;
  /** Количество участников (для больших групп/каналов) */
  participantsCount?: number;
  /** Количество сообщений */
  messagesCount?: number;
  updatedAt: string;
}

// ==================== Пагинация (marker-based из MAX) ====================

/** Универсальный ответ с пагинацией */
export interface PaginatedResponse<T> {
  items: T[];
  /** null = конец списка */
  marker: string | null;
  /** Общее количество (опционально) */
  total?: number;
}
