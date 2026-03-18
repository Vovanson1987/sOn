import { useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronRight, Phone, Video, Smile } from 'lucide-react';
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
  const groups: Array<
    | { type: 'date'; date: string }
    | { type: 'message'; message: Message; isFirstInGroup: boolean; isLastInGroup: boolean }
  > = [];

  let lastDate = '';
  let lastSenderId = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDate = new Date(msg.createdAt).toDateString();
    const nextMsg = messages[i + 1];

    if (msgDate !== lastDate) {
      groups.push({ type: 'date', date: msg.createdAt });
      lastDate = msgDate;
      lastSenderId = '';
    }

    const isFirst = msg.senderId !== lastSenderId || msg.type === 'system';
    const isLast =
      !nextMsg ||
      nextMsg.senderId !== msg.senderId ||
      new Date(nextMsg.createdAt).toDateString() !== msgDate ||
      nextMsg.type === 'system';

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

/** Форматирование даты для шапки */
function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}, ${time}`;
}

/** Экран переписки в стиле iMessage Mac */
export function ConversationScreen({ chat }: ConversationScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const getMessages = useMessageStore((s) => s.getMessages);
  const sendMessage = useMessageStore((s) => s.sendMessage);

  const messages = getMessages(chat.id);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  const other = chat.members.find((m) => m.id !== 'user-me');
  const chatName = chat.name ?? other?.displayName ?? 'Неизвестный';
  const isGroup = chat.type === 'group';
  const chatSubtype = chat.type === 'secret' ? 'Секретный чат' : 'iMessage';

  // Дата последнего сообщения для шапки
  const lastMessageDate = messages.length > 0
    ? formatHeaderDate(messages[messages.length - 1].createdAt)
    : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
      {/* Шапка — стиль iMessage Mac */}
      <FrostedGlassBar className="flex items-center px-4 py-2 relative min-h-[60px]">
        {/* Левая часть — пустая на десктопе */}
        <div className="w-[60px]" />

        {/* Центр: аватар + имя + подпись */}
        <div className="flex-1 flex flex-col items-center">
          <Avatar size={35} name={chatName} src={other?.avatarUrl} />
          <button className="flex items-center gap-[1px] mt-[2px]">
            <span className="text-[13px] font-semibold text-white">{chatName}</span>
            <ChevronRight size={12} color="#8E8E93" />
          </button>
          <span className="text-[10px]" style={{ color: '#8E8E93' }}>
            {chatSubtype}
          </span>
          {lastMessageDate && (
            <span className="text-[10px]" style={{ color: '#8E8E93' }}>
              {lastMessageDate}
            </span>
          )}
        </div>

        {/* Правая часть: иконки */}
        <div className="flex items-center gap-3 w-[60px] justify-end">
          <button aria-label="Видеозвонок">
            <Video size={20} color="#8E8E93" />
          </button>
          <button aria-label="Аудиозвонок">
            <Phone size={18} color="#8E8E93" />
          </button>
        </div>
      </FrostedGlassBar>

      {/* Область сообщений */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="h-3" />

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
              {isOwn && isLastOwn && message.type !== 'system' && (
                <div className="flex justify-end pr-4 mt-[2px]">
                  <DeliveryStatus status={message.status} readAt={message.readAt} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        <div className="h-3" />
      </div>

      {/* Панель ввода */}
      <InputBar
        onSend={handleSend}
        placeholder={chat.type === 'secret' ? 'Секретное сообщение...' : 'iMessage'}
      />
    </div>
  );
}
