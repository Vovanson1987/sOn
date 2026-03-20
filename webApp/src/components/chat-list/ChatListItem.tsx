import { memo, useState, useCallback } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { formatChatDate } from '@utils/dateFormat';
import { useAuthStore } from '@stores/authStore';
import { useChatStore } from '@stores/chatStore';
import type { Chat } from '@/types/chat';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: (chatId: string) => void;
}

function getChatName(chat: Chat, myUserId: string): string {
  if (chat.name) return chat.name;
  const other = chat.members.find((m) => m.id !== myUserId);
  return other?.displayName ?? 'Неизвестный';
}

function getChatAvatar(chat: Chat, myUserId: string) {
  const other = chat.members.find((m) => m.id !== myUserId);
  const isGroup = chat.type === 'group';
  return {
    name: getChatName(chat, myUserId),
    src: isGroup ? undefined : other?.avatarUrl,
    isOnline: isGroup ? false : other?.isOnline,
    groupMembers: isGroup ? chat.members.filter((m) => m.id !== myUserId).map((m) => m.displayName) : undefined,
  };
}

export const ChatListItem = memo(function ChatListItem({ chat, isActive, onSelect }: ChatListItemProps) {
  const myUserId = useAuthStore((s) => s.user?.id) || 'user-me';
  const deleteChat = useChatStore((s) => s.deleteChat);
  const name = getChatName(chat, myUserId);
  const avatar = getChatAvatar(chat, myUserId);
  const preview = chat.lastMessage?.content ?? '';
  const date = chat.lastMessage ? formatChatDate(chat.lastMessage.createdAt) : '';
  const isSecret = chat.type === 'secret';

  // Контекстное меню для удаления
  const [showDelete, setShowDelete] = useState(false);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDelete(true);
  }, []);

  const handleDelete = useCallback(() => {
    const confirmMsg = isSecret
      ? 'Удалить секретный чат? Все сообщения и ключи будут удалены.'
      : 'Удалить чат? Все сообщения будут потеряны.';
    if (window.confirm(confirmMsg)) {
      deleteChat(chat.id);
    }
    setShowDelete(false);
  }, [chat.id, deleteChat, isSecret]);

  return (
    <div className="relative" onContextMenu={handleContextMenu}>
      <button
        onClick={() => onSelect(chat.id)}
        className="w-full flex items-center gap-[12px] px-4 py-[8px] text-left rounded-[10px] active:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007AFF]"
        style={{
          background: isActive ? '#007AFF' : 'transparent',
        }}
        aria-label={`Чат с ${name}${chat.unreadCount > 0 ? `, ${chat.unreadCount} непрочитанных` : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Avatar size={50} name={avatar.name} src={avatar.src} isOnline={avatar.isOnline} groupMembers={avatar.groupMembers} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isSecret && <Lock size={13} color={isActive ? '#fff' : '#30D158'} aria-hidden="true" />}
              <span className="text-[15px] font-semibold truncate text-white">
                {name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span
                className="text-[13px]"
                style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#ABABAF' }}
              >
                {date}
              </span>
              {chat.unreadCount > 0 && !isActive && (
                <div
                  className="min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-[5px]"
                  style={{ background: '#007AFF' }}
                >
                  <span className="text-[11px] font-bold text-white">
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </span>
                </div>
              )}
            </div>
          </div>
          <p
            className="text-[13px] leading-[1.35] mt-[1px] line-clamp-2"
            style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#ABABAF' }}
          >
            {preview}
          </p>
        </div>
      </button>

      {/* Контекстное меню удаления */}
      {showDelete && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDelete(false)} />
          <div
            className="absolute right-2 top-0 z-50 rounded-[10px] overflow-hidden shadow-lg"
            style={{ background: '#2C2C2E', border: '0.5px solid #38383A', minWidth: '160px' }}
          >
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-4 py-[10px] text-left"
              style={{ color: '#FF453A' }}
            >
              <Trash2 size={16} color="#FF453A" aria-hidden="true" />
              <span className="text-[14px] font-medium">Удалить чат</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
});
