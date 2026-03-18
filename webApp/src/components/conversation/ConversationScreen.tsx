import { useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, Phone, Video } from 'lucide-react';
import { FrostedGlassBar } from '@components/ui/FrostedGlassBar';
import { Avatar } from '@components/ui/Avatar';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { DeliveryStatus } from './DeliveryStatus';
import { InputBar } from './InputBar';
import { useMessageStore } from '@stores/messageStore';
import type { Chat } from '@/types/chat';
import type { Message } from '@/types/message';

interface ConversationScreenProps {
  chat: Chat;
  onBack: () => void;
}

/** Группировка сообщений с разделителями дат */
function groupMessages(messages: Message[]) {
  const groups: Array<{ type: 'date'; date: string } | { type: 'message'; message: Message; isFirstInGroup: boolean; isLastInGroup: boolean }> = [];

  let lastDate = '';
  let lastSenderId = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDate = new Date(msg.createdAt).toDateString();
    const nextMsg = messages[i + 1];

    // Разделитель дат
    if (msgDate !== lastDate) {
      groups.push({ type: 'date', date: msg.createdAt });
      lastDate = msgDate;
      lastSenderId = '';
    }

    // Группировка последовательных от одного отправителя
    const isFirst = msg.senderId !== lastSenderId || msg.type === 'system';
    const isLast = !nextMsg || nextMsg.senderId !== msg.senderId || new Date(nextMsg.createdAt).toDateString() !== msgDate || nextMsg.type === 'system';

    groups.push({
      type: 'message',
      message: msg,
      isFirstInGroup: isFirst,
      isLastInGroup: isLast,
    });

    lastSenderId = msg.type === 'system' ? '' : msg.senderId;
  }

  return groups;
}

/** Экран переписки в стиле iOS Messages */
export function ConversationScreen({ chat, onBack }: ConversationScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const getMessages = useMessageStore((s) => s.getMessages);
  const sendMessage = useMessageStore((s) => s.sendMessage);

  const messages = getMessages(chat.id);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  // Имя и аватар собеседника
  const other = chat.members.find((m) => m.id !== 'user-me');
  const chatName = chat.name ?? other?.displayName ?? 'Неизвестный';
  const isGroup = chat.type === 'group';

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Последнее исходящее сообщение для статуса доставки
  const lastOwnMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === 'user-me' && messages[i].type !== 'system') {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => sendMessage(chat.id, text),
    [chat.id, sendMessage],
  );

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Шапка */}
      <FrostedGlassBar className="flex items-center justify-between px-3 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-0"
          style={{ color: '#007AFF' }}
          aria-label="Назад к списку чатов"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="flex flex-col items-center flex-1 min-w-0">
          <Avatar size={35} name={chatName} src={other?.avatarUrl} isOnline={other?.isOnline} />
          <span className="text-[11px] font-semibold text-white mt-[2px] truncate max-w-[200px]">
            {chatName}
          </span>
          <span className="text-[9px]" style={{ color: '#8E8E93' }}>
            {chat.type === 'secret' ? 'Секретный чат' : 'Текстовое сообщение'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button aria-label="Видеозвонок">
            <Video size={22} color="#8E8E93" />
          </button>
          <button aria-label="Аудиозвонок">
            <Phone size={20} color="#8E8E93" />
          </button>
        </div>
      </FrostedGlassBar>

      {/* Область сообщений */}
      <div
        className="flex-1 overflow-y-auto py-2"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {grouped.map((item, i) => {
          if (item.type === 'date') {
            return <DateSeparator key={`date-${i}`} date={item.date} />;
          }
          const { message, isFirstInGroup, isLastInGroup } = item;
          const isOwn = message.senderId === 'user-me';
          const isLastOwn = lastOwnMessage?.id === message.id;

          return (
            <div key={message.id}>
              <MessageBubble
                message={message}
                isOwn={isOwn}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                chatType={chat.type}
                showSenderName={isGroup}
              />
              {/* Статус доставки под последним исходящим */}
              {isOwn && isLastOwn && message.type !== 'system' && (
                <div className="flex justify-end px-4 mt-[2px]">
                  <DeliveryStatus status={message.status} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Панель ввода */}
      <InputBar
        onSend={handleSend}
        placeholder={chat.type === 'secret' ? 'Секретное сообщение...' : 'Текстовое сообщение...'}
      />
    </div>
  );
}
