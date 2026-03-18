import type { User } from './user';
import type { Message } from './message';

export type ChatType = 'direct' | 'group' | 'secret';

export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  members: User[];
  lastMessage?: Message;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  isVerified?: boolean;
  selfDestruct?: number;
  updatedAt: string;
}
