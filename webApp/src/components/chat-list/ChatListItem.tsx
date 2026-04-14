/**
 * Redesign: ChatListItem в стиле MAX — 72px высота, фиолетовый active,
 * аватар 48px, превью + время, unread badge.
 */

import { memo, useState, useCallback } from 'react';
import { Lock, Pin, BellOff, Trash2 } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { confirm } from '@components/ui/ConfirmDialog';
import { toast } from '@components/ui/Toast';
import { formatChatDate } from '@utils/dateFormat';
import { useSwipeAction } from '@/hooks/useSwipeAction';
import { useAuthStore } from '@stores/authStore';
import { useChatStore } from '@stores/chatStore';
import type { Chat } from '@/types/chat';

const SWIPE_ACTION_WIDTH = 88;

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

  const [showDelete, setShowDelete] = useState(false);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowDelete(true);
  }, []);

  const handleDelete = useCallback(async () => {
    setShowDelete(false);
    const ok = await confirm({
      title: isSecret ? 'Удалить секретный чат?' : 'Удалить чат?',
      description: isSecret
        ? 'Все сообщения и ключи шифрования будут удалены безвозвратно.'
        : 'Все сообщения будут потеряны. Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteChat(chat.id);
      toast.success('Чат удалён');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить чат';
      toast.error(message);
    }
  }, [chat.id, deleteChat, isSecret]);

  // Swipe-to-delete для мобилки (отключается на устройствах без touch)
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const swipe = useSwipeAction({ threshold: 48, maxOffset: SWIPE_ACTION_WIDTH, disabled: !isTouch });

  return (
    <div
      className="relative overflow-hidden"
      onContextMenu={handleContextMenu}
      {...swipe.handlers}
    >
      {/* Задняя action-зона (удаление). Видна только при swipe. */}
      {swipe.offset > 0 && (
        <button
          onClick={() => {
            swipe.reset();
            void handleDelete();
          }}
          className="absolute top-0 right-0 h-full flex items-center justify-center"
          style={{
            width: SWIPE_ACTION_WIDTH,
            background: '#FF453A',
            color: '#fff',
          }}
          aria-label="Удалить чат"
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 size={18} />
            <span className="text-[11px] font-semibold">Удалить</span>
          </div>
        </button>
      )}

      <button
        onClick={() => {
          if (swipe.isOpen) {
            swipe.reset();
            return;
          }
          onSelect(chat.id);
        }}
        className="w-full flex items-center gap-3 px-4 text-left transition-transform"
        style={{
          height: '72px',
          background: isActive
            ? 'rgba(91,95,199,0.15)'
            : '#1e1e2e',
          borderLeft: isActive ? '3px solid #5B5FC7' : '3px solid transparent',
          transform: `translateX(${-swipe.offset}px)`,
          willChange: 'transform',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        aria-label={`Чат с ${name}${chat.unreadCount > 0 ? `, ${chat.unreadCount} непрочитанных` : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Аватар 48px */}
        <Avatar size={48} name={avatar.name} src={avatar.src} isOnline={avatar.isOnline} groupMembers={avatar.groupMembers} />

        {/* Контент */}
        <div className="flex-1 min-w-0">
          {/* Строка 1: имя + иконки + время */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isSecret && <Lock size={13} color="#30D158" className="flex-shrink-0" />}
              <span className="text-[15px] font-semibold truncate text-white">
                {name}
              </span>
              {chat.isMuted && <BellOff size={12} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {date}
              </span>
            </div>
          </div>

          {/* Строка 2: превью + badge */}
          <div className="flex items-center justify-between mt-0.5">
            <p
              className="text-[14px] leading-[1.35] truncate flex-1 mr-2"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              {preview}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {chat.isPinned && (
                <Pin size={12} style={{ color: 'rgba(255,255,255,0.35)' }} aria-label="Закреплённый чат" />
              )}
              {chat.unreadCount > 0 && (
                <div
                  className="min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1"
                  style={{ background: '#5B5FC7' }}
                >
                  <span className="text-[11px] font-bold text-white">
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Контекстное меню */}
      {showDelete && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDelete(false)} />
          <div
            className="absolute right-2 top-2 z-50 rounded-xl overflow-hidden shadow-lg"
            style={{ background: '#282840', border: '1px solid rgba(255,255,255,0.06)', minWidth: '160px' }}
          >
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              style={{ color: '#FF453A' }}
            >
              <Trash2 size={16} />
              <span className="text-[14px] font-medium">Удалить чат</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
});
