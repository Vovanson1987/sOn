import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { ChevronLeft, Video, Shield, Timer } from 'lucide-react';
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
import { KeyExchangeAnimation } from '@components/secret-chat/KeyExchangeAnimation';
import { VerificationModal } from '@components/secret-chat/VerificationModal';
import { SelfDestructPicker } from '@components/secret-chat/SelfDestructPicker';
import { EncryptionInfo } from '@components/secret-chat/EncryptionInfo';
import { useMessageStore } from '@stores/messageStore';
import { useSecretChatStore } from '@stores/secretChatStore';
import { useAuthStore } from '@stores/authStore';
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

/** Экран переписки в стиле iMessage Mac */
export function ConversationScreen({ chat, onBack }: ConversationScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = useMessageStore((s) => s.messages[chat.id] ?? []);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const addReaction = useMessageStore((s) => s.addReaction);
  const deleteMessageFn = useMessageStore((s) => s.deleteMessage);
  const typingUsers = useMessageStore((s) => s.typingUsers);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  // Загрузить сообщения с сервера при открытии чата
  useEffect(() => {
    fetchMessages(chat.id);
  }, [chat.id, fetchMessages]);

  const authUserId = useAuthStore((s) => s.user?.id);
  const myDisplayName = useAuthStore((s) => s.user?.display_name) || 'Вы';
  const myUserId = authUserId || 'user-me';
  const other = chat.members.find((m) => m.id !== myUserId);
  const chatName = chat.name ?? other?.displayName ?? 'Неизвестный';
  const isGroup = chat.type === 'group';
  const isSecret = chat.type === 'secret';
  const chatSubtype = isSecret ? 'Секретный чат' : 'iMessage';

  const isTyping = (typingUsers[chat.id] ?? []).length > 0;

  // Автоответы
  useAutoReply(chat);

  // Состояние Tapback оверлея
  const [tapbackMessage, setTapbackMessage] = useState<Message | null>(null);

  // Состояние reply
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Секретный чат: состояние
  const secretSession = useSecretChatStore((s) => s.sessions[chat.id]);
  const initSession = useSecretChatStore((s) => s.initSession);
  const verifySession = useSecretChatStore((s) => s.verifySession);
  const setSelfDestruct = useSecretChatStore((s) => s.setSelfDestruct);
  // HI-32: Wrap regenerateKeys in useCallback to prevent unnecessary re-renders
  const regenerateKeys = useCallback(async (chatId: string) => {
    useSecretChatStore.getState().endSession(chatId);
    // peerId из участников чата (первый кто не текущий пользователь)
    const peerId = chat.members?.find((m: { id: string }) => m.id !== myUserId)?.id || '';
    await useSecretChatStore.getState().initSession(chatId, peerId);
  }, [chat.members, myUserId]);
  const endSession = useSecretChatStore((s) => s.endSession);

  // Начальное значение: показать анимацию обмена ключами при первом открытии секретного чата
  const [showKeyExchange, setShowKeyExchange] = useState<boolean>(
    () => !!(isSecret && !secretSession),
  );
  const [showVerification, setShowVerification] = useState(false);
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false);
  const [showSelfDestructPicker, setShowSelfDestructPicker] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); return; }
    // Скроллить вниз только если пользователь уже внизу (с запасом 150px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isTyping]);

  const lastOwnMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === myUserId && messages[i].type !== 'system') {
        return messages[i];
      }
    }
    return null;
  }, [messages, myUserId]);

  const handleSend = useCallback(
    (text: string) => {
      const reply = replyTo ? {
        id: replyTo.id,
        senderName: replyTo.senderName,
        preview: replyTo.content.slice(0, 100),
      } : undefined;
      sendMessage(chat.id, text, reply);
      setReplyTo(null);
    },
    [chat.id, sendMessage, replyTo],
  );

  const handleReact = useCallback(
    (emoji: TapbackEmoji) => {
      if (tapbackMessage) {
        addReaction(chat.id, tapbackMessage.id, emoji, myUserId);
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
      {/* Анимация обмена ключами */}
      {showKeyExchange && isSecret && (
        <KeyExchangeAnimation
          contactName={chatName}
          onComplete={() => {
            const peerId = chat.members?.find((m: { id: string }) => m.id !== myUserId)?.id || '';
            initSession(chat.id, peerId).then(() => setShowKeyExchange(false));
          }}
        />
      )}

      {/* Верификация ключей */}
      {showVerification && secretSession && (
        <VerificationModal
          myName={myDisplayName}
          theirName={chatName}
          emojiGrid={secretSession.emojiGrid}
          hexFingerprint={secretSession.hexFingerprint}
          isVerified={secretSession.isVerified}
          onVerify={() => verifySession(chat.id)}
          onClose={() => setShowVerification(false)}
        />
      )}

      {/* Info-панель шифрования */}
      {showEncryptionInfo && secretSession && (
        <EncryptionInfo
          protocol="Signal Protocol (X3DH + Double Ratchet)"
          algorithms="Curve25519, AES-256-GCM, HMAC-SHA256"
          sessionDate={new Date(secretSession.sessionDate).toLocaleDateString('ru-RU')}
          ratchetIndex={secretSession.ratchetState?.sendCount || 0}
          isVerified={secretSession.isVerified}
          onVerify={() => { setShowEncryptionInfo(false); setShowVerification(true); }}
          onRegenerateKeys={() => { regenerateKeys(chat.id).then(() => { setShowEncryptionInfo(false); setShowKeyExchange(true); }); }}
          onEndSecretChat={() => { endSession(chat.id); setShowEncryptionInfo(false); }}
          onClose={() => setShowEncryptionInfo(false)}
        />
      )}

      {/* Picker таймера самоуничтожения */}
      {showSelfDestructPicker && (
        <SelfDestructPicker
          isOpen
          currentValue={secretSession?.selfDestructTimer ?? null}
          onSelect={(val) => setSelfDestruct(chat.id, val)}
          onClose={() => setShowSelfDestructPicker(false)}
        />
      )}

      {/* Шапка */}
      <FrostedGlassBar
        className="flex items-center px-2 relative"
        style={{
          paddingTop: 'max(8px, env(safe-area-inset-top))',
          paddingBottom: '8px',
          borderBottom: '0.5px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="w-[60px] flex items-center">
          <button
            onClick={onBack}
            className="w-[44px] h-[44px] flex items-center"
            style={{ color: '#007AFF' }}
            aria-label="Назад к списку чатов"
          >
            <ChevronLeft size={28} color="#007AFF" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <Avatar size={40} name={chatName} src={other?.avatarUrl} />
          <span className="text-[17px] font-semibold text-white mt-[2px]">{chatName}</span>
          <div className="flex items-center gap-1">
            <span className="text-[12px]" style={{ color: isSecret ? '#30D158' : '#ABABAF' }}>{chatSubtype}</span>
            {isSecret && secretSession?.isVerified && (
              <span className="text-[12px]" style={{ color: '#30D158' }}>✓ Проверено</span>
            )}
          </div>
        </div>
        <div className="w-[60px] flex justify-end gap-1 pr-1">
          {isSecret && (
            <>
              <button onClick={() => setShowSelfDestructPicker(true)} className="w-[44px] h-[44px] flex items-center justify-center" aria-label="Таймер самоуничтожения">
                <Timer size={20} color="#30D158" />
              </button>
              <button onClick={() => setShowEncryptionInfo(true)} className="w-[44px] h-[44px] flex items-center justify-center" aria-label="Информация о шифровании">
                <Shield size={20} color="#30D158" />
              </button>
            </>
          )}
          <button className="w-[44px] h-[44px] flex items-center justify-center" aria-label="Видеозвонок"><Video size={22} color="#8E8E93" /></button>
        </div>
      </FrostedGlassBar>

      {/* Область сообщений */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label={`Переписка с ${chatName}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="h-3" />

        {/* Пустое состояние */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-8">
            <p className="text-[17px] font-semibold text-white">Нет сообщений</p>
            <p className="text-[14px] text-center" style={{ color: '#ABABAF' }}>
              {isSecret ? 'Начните защищённый разговор' : 'Отправьте первое сообщение'}
            </p>
          </div>
        )}

        {grouped.map((item, i) => {
          if (item.type === 'date') {
            return <DateSeparator key={`date-${item.date}`} date={item.date} />;
          }
          const { message, isFirstInGroup, isLastInGroup } = item;
          const isOwn = message.senderId === myUserId;
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
                <div className="flex justify-end mt-[2px]" style={{ paddingRight: '18px' }}>
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
          isOwn={tapbackMessage.senderId === myUserId}
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
