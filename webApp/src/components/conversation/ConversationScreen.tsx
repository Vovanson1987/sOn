import { useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Phone, Video } from 'lucide-react';
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

    // Разделитель дат
    if (msgDate !== lastDate) {
      groups.push({ type: 'date', date: msg.createdAt });
      lastDate = msgDate;
      lastSenderId = '';
    }

    // Группировка последовательных от одного отправителя
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

/** Экран переписки в стиле iMessage (Mac) */
export function ConversationScreen({ chat, onBack }: ConversationScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const getMessages = useMessageStore((s) => s.getMessages);
  const sendMessage = useMessageStore((s) => s.sendMessage);

  const messages = getMessages(chat.id);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  const other = chat.members.find((m) => m.id !== 'user-me');
  const chatName = chat.name ?? other?.displayName ?? 'Неизвестный';
  const isGroup = chat.type === 'group';
  const chatSubtitle = chat.type === 'secret' ? 'Секретный чат' : 'iMessage';

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
      {/* Шапка — стиль iMessage Mac */}
      <FrostedGlassBar className="flex items-center px-3 py-2">
        {/* Кнопка назад */}
        <button
          onClick={onBack}
          className="flex-shrink-0"
          style={{ color: '#007AFF' }}
          aria-label="Назад к списку чатов"
        >
          <ChevronLeft size={26} />
        </button>

        {/* Центр: Новое сообщение (иконка) */}
        <div className="flex-shrink-0 ml-1">
          {/* Пустое место — в оригинале тут иконка нового сообщения */}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Аватар + имя по центру */}
        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
          <Avatar size={35} name={chatName} src={other?.avatarUrl} />
          <button className="flex items-center gap-[2px] mt-[2px]">
            <span className="text-[12px] font-semibold text-white">{chatName}</span>
            <ChevronRight size={12} color="#8E8E93" />
          </button>
          <span className="text-[10px]" style={{ color: '#8E8E93' }}>
            {chatSubtitle}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Иконки звонков справа */}
        <div className="flex items-center gap-3 flex-shrink-0">
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
        {/* Верхний отступ */}
        <div className="h-2" />

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
                <div className="flex justify-end pr-4 mt-[2px]">
                  <DeliveryStatus status={message.status} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />

        {/* Нижний отступ */}
        <div className="h-2" />
      </div>

      {/* Панель ввода */}
      <InputBar
        onSend={handleSend}
        placeholder={chat.type === 'secret' ? 'Секретное сообщение...' : 'Текстовое сообщение...'}
      />
    </div>
  );
}
