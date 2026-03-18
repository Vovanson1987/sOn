import { memo } from 'react';
import { Lock } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { formatChatDate } from '@utils/dateFormat';
import type { Chat } from '@/types/chat';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: (chatId: string) => void;
}

function getChatName(chat: Chat): string {
  if (chat.name) return chat.name;
  const other = chat.members.find((m) => m.id !== 'user-me');
  return other?.displayName ?? 'Неизвестный';
}

function getChatAvatar(chat: Chat) {
  const other = chat.members.find((m) => m.id !== 'user-me');
  const isGroup = chat.type === 'group';
  return {
    name: getChatName(chat),
    src: isGroup ? undefined : other?.avatarUrl,
    isOnline: isGroup ? false : other?.isOnline,
    groupMembers: isGroup ? chat.members.filter((m) => m.id !== 'user-me').map((m) => m.displayName) : undefined,
  };
}

export const ChatListItem = memo(function ChatListItem({ chat, isActive, onSelect }: ChatListItemProps) {
  const name = getChatName(chat);
  const avatar = getChatAvatar(chat);
  const preview = chat.lastMessage?.content ?? '';
  const date = chat.lastMessage ? formatChatDate(chat.lastMessage.createdAt) : '';
  const isSecret = chat.type === 'secret';

  return (
    <button
      onClick={() => onSelect(chat.id)}
      className="w-full flex items-center gap-[10px] px-3 py-[8px] text-left rounded-[10px] mx-[4px]"
      style={{
        background: isActive ? '#007AFF' : 'transparent',
        width: 'calc(100% - 8px)',
      }}
      role="listitem"
      aria-label={`Чат с ${name}${chat.unreadCount > 0 ? `, ${chat.unreadCount} непрочитанных` : ''}`}
    >
      <Avatar size={50} name={avatar.name} src={avatar.src} isOnline={avatar.isOnline} groupMembers={avatar.groupMembers} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {isSecret && <Lock size={13} color={isActive ? '#fff' : '#34C759'} aria-label="Секретный чат" />}
            <span
              className="text-[15px] font-semibold truncate"
              style={{ color: isActive ? '#fff' : '#fff' }}
            >
              {name}
            </span>
          </div>
          <span
            className="text-[13px] flex-shrink-0 ml-2"
            style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#8E8E93' }}
          >
            {date}
          </span>
        </div>
        <p
          className="text-[13px] leading-[1.35] mt-[1px] line-clamp-2"
          style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#8E8E93' }}
        >
          {preview}
        </p>
      </div>
    </button>
  );
});
