import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { ChevronRight, Video } from 'lucide-react';
import { FrostedGlassBar } from '@components/ui/FrostedGlassBar';
import { Avatar } from '@components/ui/Avatar';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { DeliveryStatus } from './DeliveryStatus';
import { InputBar } from './InputBar';
import { ReplyQuote } from './ReplyQuote';
import { TypingIndicator } from './TypingIndicator';
import { TapbackOverlay } from '@components/reactions/TapbackOverlay';
import type { TapbackEmoji } from '@components/reactions/TapbackOverlay';
import { useMessageStore } from '@stores/messageStore';
import { useAutoReply } from '@hooks/useAutoReply';
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
  const messages = useMessageStore((s) => s.messages[chat.id] ?? []);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const addReaction = useMessageStore((s) => s.addReaction);
  const deleteMessageFn = useMessageStore((s) => s.deleteMessage);
  const typingUsers = useMessageStore((s) => s.typingUsers);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  const other = chat.members.find((m) => m.id !== 'user-me');
  const chatName = chat.name ?? other?.displayName ?? 'Неизвестный';
  const isGroup = chat.type === 'group';
  const chatSubtype = chat.type === 'secret' ? 'Секретный чат' : 'iMessage';

  const lastMessageDate = messages.length > 0
    ? formatHeaderDate(messages[messages.length - 1].createdAt)
    : '';

  const isTyping = (typingUsers[chat.id] ?? []).length > 0;

  // Автоответы
  useAutoReply(chat);

  // Состояние Tapback оверлея
  const [tapbackMessage, setTapbackMessage] = useState<Message | null>(null);

  // Состояние reply
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const lastOwnMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === 'user-me' && messages[i].type !== 'system') {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(chat.id, text);
      setReplyTo(null);
    },
    [chat.id, sendMessage],
  );

  const handleReact = useCallback(
    (emoji: TapbackEmoji) => {
      if (tapbackMessage) {
        addReaction(chat.id, tapbackMessage.id, emoji, 'user-me');
        setTapbackMessage(null);
      }
    },
    [chat.id, tapbackMessage, addReaction],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, msg: Message) => {
      e.preventDefault();
      if (msg.type !== 'system' && !msg.isDestroyed) {
        setTapbackMessage(msg);
      }
    },
    [],
  );

  const handleCopy = useCallback(() => {
    if (tapbackMessage) {
      navigator.clipboard.writeText(tapbackMessage.content);
      setTapbackMessage(null);
    }
  }, [tapbackMessage]);

  const handleDelete = useCallback(() => {
    if (tapbackMessage) {
      deleteMessageFn(chat.id, tapbackMessage.id);
      setTapbackMessage(null);
    }
  }, [chat.id, tapbackMessage, deleteMessageFn]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Шапка */}
      <FrostedGlassBar className="flex items-center px-6 py-2 relative min-h-[70px]">
        <div className="w-[60px]" />
        <div className="flex-1 flex flex-col items-center">
          <Avatar size={40} name={chatName} src={other?.avatarUrl} />
          <button className="flex items-center gap-[2px] mt-[3px]">
            <span className="text-[13px] font-semibold text-white">{chatName}</span>
            <ChevronRight size={13} color="#8E8E93" />
          </button>
          <span className="text-[10px]" style={{ color: '#8E8E93' }}>{chatSubtype}</span>
          {lastMessageDate && (
            <span className="text-[10px]" style={{ color: '#8E8E93' }}>{lastMessageDate}</span>
          )}
        </div>
        <div className="w-[60px] flex justify-end pr-1">
          <button aria-label="Видеозвонок"><Video size={22} color="#8E8E93" /></button>
        </div>
      </FrostedGlassBar>

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="h-3" />
        {grouped.map((item, i) => {
          if (item.type === 'date') {
            return <DateSeparator key={`date-${i}`} date={item.date} />;
          }
          const { message, isFirstInGroup, isLastInGroup } = item;
          const isOwn = message.senderId === 'user-me';
          const isLastOwn = lastOwnMessage?.id === message.id;

          return (
            <div
              key={message.id}
              onContextMenu={(e) => handleContextMenu(e, message)}
            >
              <MessageBubble
                message={message}
                isOwn={isOwn}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                chatType={chat.type}
                showSenderName={isGroup}
              />
              {isOwn && isLastOwn && message.type !== 'system' && (
                <div className="flex justify-end mt-[2px]" style={{ paddingRight: '24px' }}>
                  <DeliveryStatus status={message.status} readAt={message.readAt} />
                </div>
              )}
            </div>
          );
        })}

        {/* Индикатор "печатает..." */}
        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
        <div className="h-3" />
      </div>

      {/* Цитата при ответе */}
      {replyTo && (
        <ReplyQuote
          senderName={replyTo.senderName}
          preview={replyTo.content.slice(0, 100)}
          onCancel={() => setReplyTo(null)}
        />
      )}

      {/* Панель ввода */}
      <InputBar
        onSend={handleSend}
        placeholder={chat.type === 'secret' ? 'Секретное сообщение...' : 'iMessage'}
      />

      {/* Tapback оверлей */}
      {tapbackMessage && (
        <TapbackOverlay
          message={tapbackMessage}
          isOwn={tapbackMessage.senderId === 'user-me'}
          onReact={handleReact}
          onReply={() => { setReplyTo(tapbackMessage); setTapbackMessage(null); }}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onClose={() => setTapbackMessage(null)}
        />
      )}
    </div>
  );
}
