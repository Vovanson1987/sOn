import { useEffect, useRef, useMemo, useCallback, useState, type CSSProperties, type ReactElement } from 'react';
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from 'react-window';
import { Video, Shield, Timer } from 'lucide-react';
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
import { useChatStore } from '@stores/chatStore';
import { uploadImage, uploadFile } from '@/utils/fileUpload';
import { sendMessage as apiSendMessage } from '@/api/client';
import { PinnedBanner } from './PinnedBanner';
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

/** LO-16: Виртуализированная строка сообщения для react-window */
interface MessageRowProps {
  grouped: ReturnType<typeof groupMessages>;
  myUserId: string;
  lastOwnMessageId: string | null;
  chatType: import('@/types/chat').ChatType;
  isGroup: boolean;
  onContextMenu: (e: React.MouseEvent, msg: Message) => void;
  setRowHeight: (index: number, height: number) => void;
}

function MessageRow({
  index, style, ariaAttributes,
  grouped, myUserId, lastOwnMessageId, chatType, isGroup, onContextMenu, setRowHeight,
}: RowComponentProps<MessageRowProps>): ReactElement | null {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);

  // C-F5: Явные зависимости вместо вызова на каждый рендер
  useEffect(() => {
    if (contentRef.current) {
      const h = contentRef.current.offsetHeight;
      if (h > 0 && h !== lastHeightRef.current) {
        lastHeightRef.current = h;
        setRowHeight(index, h);
      }
    }
  }, [index, setRowHeight]);

  // Typing indicator (виртуальная строка после всех сообщений)
  if (index >= grouped.length) {
    return (
      <div style={style} {...ariaAttributes}>
        <div ref={contentRef}><TypingIndicator /></div>
      </div>
    );
  }

  const item = grouped[index];
  if (!item) return null;

  if (item.type === 'date') {
    return (
      <div style={style} {...ariaAttributes}>
        <div ref={contentRef}><DateSeparator date={item.date} /></div>
      </div>
    );
  }

  const { message, isFirstInGroup, isLastInGroup } = item;
  const isOwn = message.senderId === myUserId;
  const isLastOwn = lastOwnMessageId === message.id;

  return (
    <div style={style} {...ariaAttributes}>
      <div ref={contentRef} onContextMenu={(e) => onContextMenu(e, message)}>
        <MessageBubble
          message={message}
          isOwn={isOwn}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          chatType={chatType}
          showSenderName={isGroup}
        />
        {isOwn && isLastOwn && message.type !== 'system' && (
          <div className="flex justify-end mt-[2px]" style={{ paddingRight: '18px' }}>
            <DeliveryStatus status={message.status} readAt={message.readAt} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Экран переписки в стиле iMessage Mac */
export function ConversationScreen({ chat, onBack: _onBack }: ConversationScreenProps) {
  void _onBack; // Используется в мобильной версии
  // LO-16: Виртуализация сообщений
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 60, key: chat.id });
  const listRef = useListRef(null);
  const messages = useMessageStore((s) => s.messages[chat.id] ?? []);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const addReaction = useMessageStore((s) => s.addReaction);
  const deleteMessageFn = useMessageStore((s) => s.deleteMessage);
  const typingUsers = useMessageStore((s) => s.typingUsers);
  const editingMessage = useMessageStore((s) => s.editingMessage);
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);
  const clearEditingMessage = useMessageStore((s) => s.clearEditingMessage);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  // P2.4: Pinned message
  const pinnedMessage = useMemo(
    () => chat.pinnedMessageId ? messages.find((m) => m.id === chat.pinnedMessageId) : undefined,
    [chat.pinnedMessageId, messages]
  );

  // Загрузить сообщения с сервера при открытии чата
  useEffect(() => {
    fetchMessages(chat.id);
  }, [chat.id, fetchMessages]);

  // ME-19: Self-destruct таймеры — уничтожить сообщения после истечения
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const msg of messages) {
      if (msg.selfDestructAt && !msg.isDestroyed) {
        const remaining = new Date(msg.selfDestructAt).getTime() - Date.now();
        if (remaining <= 0) {
          // Уже истекло — пометить как уничтоженное
          useMessageStore.setState((s) => ({
            messages: {
              ...s.messages,
              [chat.id]: s.messages[chat.id]?.map((m) =>
                m.id === msg.id ? { ...m, isDestroyed: true, content: '' } : m
              ) ?? [],
            },
          }));
        } else {
          timers.push(setTimeout(() => {
            useMessageStore.setState((s) => ({
              messages: {
                ...s.messages,
                [chat.id]: s.messages[chat.id]?.map((m) =>
                  m.id === msg.id ? { ...m, isDestroyed: true, content: '' } : m
                ) ?? [],
              },
            }));
          }, remaining));
        }
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [messages, chat.id]);

  const authUserId = useAuthStore((s) => s.user?.id);
  const myDisplayName = useAuthStore((s) => s.user?.display_name) || 'Вы';
  const myUserId = authUserId || 'user-me';
  const other = chat.members.find((m) => m.id !== myUserId);
  const chatName = chat.name ?? other?.displayName ?? 'Неизвестный';
  const isGroup = chat.type === 'group';
  const isSecret = chat.type === 'secret';
  const chatSubtype = isSecret ? 'Секретный чат' : 'iMessage';

  const isTyping = (typingUsers[chat.id] ?? []).length > 0;
  const markAsRead = useChatStore((s) => s.markAsRead);

  // Сбросить счётчик непрочитанных при открытии чата
  useEffect(() => {
    markAsRead(chat.id);
  }, [chat.id, markAsRead]);


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

  // LO-16: Контейнер + автоскролл для виртуализированного списка
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const [msgContainerHeight, setMsgContainerHeight] = useState(0);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setMsgContainerHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalRows = grouped.length + (isTyping ? 1 : 0);

  useEffect(() => {
    if (isNearBottomRef.current && listRef.current && totalRows > 0) {
      listRef.current.scrollToRow({ index: totalRows - 1, align: 'end', behavior: 'smooth' });
    }
  }, [totalRows, listRef]);

  const handleListScroll = useCallback(() => {
    const el = listRef.current?.element;
    if (el) {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    }
  }, [listRef]);

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

  /** Обработка вложений: фото/видео, документ, камера */
  const handleAttachment = useCallback(
    async (type: 'camera' | 'photo' | 'document' | 'location') => {
      if (type === 'photo') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            const result = await uploadImage(file);
            // C-F6: Отправляем на сервер через API (не только локально)
            const msgType = file.type.startsWith('video/') ? 'video' : 'image';
            await apiSendMessage(chat.id, result.url, msgType, undefined, undefined, {
              url: result.url, fileName: file.name, fileSize: result.size, mimeType: result.mimeType,
            });
          } catch (err) {
            console.error('Ошибка загрузки изображения:', err);
          }
        };
        input.click();
      } else if (type === 'document') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            const result = await uploadFile(file);
            // C-F6: Отправляем на сервер через API
            await apiSendMessage(chat.id, file.name, 'file', undefined, undefined, {
              url: result.url, fileName: file.name, fileSize: result.size, mimeType: result.mimeType,
            });
          } catch (err) {
            console.error('Ошибка загрузки файла:', err);
          }
        };
        input.click();
      } else if (type === 'camera') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          await video.play();
          // Wait a frame for camera to initialize
          await new Promise((r) => setTimeout(r, 500));
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          stream.getTracks().forEach((t) => t.stop());
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.85),
          );
          if (!blob) return;
          const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const result = await uploadImage(file);
          // C-F6: Отправляем на сервер через API
          await apiSendMessage(chat.id, result.url, 'image', undefined, undefined, {
            url: result.url, fileName: file.name, fileSize: result.size, mimeType: result.mimeType,
          });
        } catch (err) {
          console.error('Ошибка камеры:', err);
        }
      }
      // 'location' — не реализовано
    },
    [chat.id],
  );

  const handleReact = useCallback(
    (emoji: TapbackEmoji) => {
      if (tapbackMessage) {
        addReaction(chat.id, tapbackMessage.id, emoji, myUserId);
        setTapbackMessage(null);
      }
    },
    [chat.id, tapbackMessage, addReaction, myUserId],
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

  // LO-12: Toast для уведомления о копировании
  const [showCopyToast, setShowCopyToast] = useState(false);

  const handleCopy = useCallback(() => {
    if (tapbackMessage) {
      navigator.clipboard.writeText(tapbackMessage.content);
      setTapbackMessage(null);
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 1500);
    }
  }, [tapbackMessage]);

  const handleDelete = useCallback(() => {
    if (tapbackMessage) {
      deleteMessageFn(chat.id, tapbackMessage.id);
      setTapbackMessage(null);
    }
  }, [chat.id, tapbackMessage, deleteMessageFn]);

  const handleEdit = useCallback((msg: Message) => {
    setEditingMessage(msg);
    setTapbackMessage(null);
  }, [setEditingMessage]);

  // Forwarding state
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const allChats = useChatStore((s) => s.chats);

  const handleForward = useCallback((msg: Message) => {
    setTapbackMessage(null);
    setForwardMessage(msg);
  }, []);

  const handleForwardToChat = useCallback((targetChatId: string) => {
    if (forwardMessage) {
      const prefix = `[Переслано от ${forwardMessage.senderName}]\n`;
      sendMessage(targetChatId, prefix + forwardMessage.content);
      setForwardMessage(null);
    }
  }, [forwardMessage, sendMessage]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#141420', animation: 'slideInRight 0.35s cubic-bezier(0.25,0.1,0.25,1) both' }}>
      {/* Анимация обмена ключами */}
      {showKeyExchange && isSecret && (
        <KeyExchangeAnimation
          contactName={chatName}
          onComplete={() => {
            const peerId = chat.members?.find((m: { id: string }) => m.id !== myUserId)?.id || '';
            initSession(chat.id, peerId)
              .then(() => setShowKeyExchange(false))
              .catch((err) => { console.error('[secretChat] initSession failed', err); setShowKeyExchange(false); });
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
          onRegenerateKeys={() => {
            if (window.confirm('Пересоздать ключи шифрования? Текущая сессия будет сброшена.')) {
              regenerateKeys(chat.id)
                .then(() => { setShowEncryptionInfo(false); setShowKeyExchange(true); })
                .catch((err) => console.error('[secretChat] regenerateKeys failed', err));
            }
          }}
          onEndSecretChat={() => {
            if (window.confirm('Завершить секретный чат? Все сообщения будут удалены.')) {
              endSession(chat.id); setShowEncryptionInfo(false);
            }
          }}
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

      {/* Шапка — стиль MAX (горизонтальный: аватар + имя слева, поиск справа) */}
      <FrostedGlassBar
        as="header"
        className="flex items-center px-4 relative"
        style={{
          height: '60px',
          background: '#1e1e2e',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar size={40} name={chatName} src={other?.avatarUrl} />
          <div className="min-w-0">
            <span className="text-[17px] font-semibold text-white block truncate">{chatName}</span>
            <span className="text-[13px] block" style={{ color: isSecret ? '#30D158' : 'rgba(255,255,255,0.45)' }}>{chatSubtype}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[12px]" style={{ color: isSecret ? '#30D158' : 'rgba(255,255,255,0.35)' }}></span>
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
          <button onClick={() => alert('Видеозвонки скоро будут доступны')} className="w-[44px] h-[44px] flex items-center justify-center" aria-label="Видеозвонок"><Video size={22} color="#8E8E93" /></button>
        </div>
      </FrostedGlassBar>

      {/* P2.4: Pinned message banner */}
      {chat.pinnedMessageId && pinnedMessage && (
        <PinnedBanner
          content={pinnedMessage.content}
          senderName={pinnedMessage.senderName}
          onTap={() => {
            // TODO: scroll to pinned message
          }}
          onUnpin={() => {
            import('@/api/client').then(({ unpinMessage }) => {
              unpinMessage(chat.id).catch((err) => console.error('[unpin] failed', err));
            }).catch((err) => console.error('[unpin] import failed', err));
          }}
          canUnpin={chat.type === 'group'}
        />
      )}

      {/* Область сообщений */}
      <div
        ref={msgContainerRef}
        className="flex-1 overflow-hidden"
        role="log"
        aria-label={`Переписка с ${chatName}`}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-8">
            <p className="text-[17px] font-semibold text-white">Нет сообщений</p>
            <p className="text-[14px] text-center" style={{ color: '#ABABAF' }}>
              {isSecret ? 'Начните защищённый разговор' : 'Отправьте первое сообщение'}
            </p>
          </div>
        ) : msgContainerHeight > 0 ? (
          /* LO-16: Виртуализированный список сообщений */
          <List
            listRef={listRef}
            rowComponent={MessageRow}
            rowCount={totalRows}
            rowHeight={dynamicRowHeight}
            rowProps={{
              grouped,
              myUserId,
              lastOwnMessageId: lastOwnMessage?.id ?? null,
              chatType: chat.type,
              isGroup,
              onContextMenu: handleContextMenu,
              setRowHeight: dynamicRowHeight.setRowHeight,
            }}
            style={{ height: msgContainerHeight, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as CSSProperties}
            onScroll={handleListScroll}
          />
        ) : (
          /* Fallback: обычный рендеринг (для тестов / SSR) */
          <div style={{ overflowY: 'auto', height: '100%', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
            <div className="h-3" />
            {grouped.map((item) => {
              if (item.type === 'date') {
                return <DateSeparator key={`date-${item.date}`} date={item.date} />;
              }
              const { message, isFirstInGroup, isLastInGroup } = item;
              const isOwn = message.senderId === myUserId;
              const isLastOwn = lastOwnMessage?.id === message.id;
              return (
                <div key={message.id} onContextMenu={(e) => handleContextMenu(e, message)}>
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
            {isTyping && <TypingIndicator />}
            <div className="h-3" />
          </div>
        )}
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
        onAttachment={handleAttachment}
        placeholder={chat.type === 'secret' ? 'Секретное сообщение...' : 'iMessage'}
        chatId={chat.id}
        editingMessage={editingMessage}
        onCancelEdit={clearEditingMessage}
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
          onEdit={handleEdit}
          onForward={handleForward}
          onClose={() => setTapbackMessage(null)}
        />
      )}

      {/* Forward chat picker modal */}
      {forwardMessage && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setForwardMessage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Переслать сообщение"
        >
          <div
            className="w-full max-w-[400px] mx-4 rounded-[16px] overflow-hidden"
            style={{ background: '#1C1C1E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#38383A' }}>
              <h2 className="text-[17px] font-semibold text-white">Переслать в чат</h2>
              <button onClick={() => setForwardMessage(null)} aria-label="Закрыть" className="text-[#8E8E93] text-[20px]">&times;</button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {allChats.filter((c) => c.id !== chat.id).length === 0 && (
                <p className="text-center py-6 text-[14px]" style={{ color: '#ABABAF' }}>Нет доступных чатов</p>
              )}
              {allChats.filter((c) => c.id !== chat.id).map((c) => {
                const otherMember = c.members.find((m) => m.id !== myUserId);
                const displayName = c.name ?? otherMember?.displayName ?? 'Чат';
                return (
                  <button
                    key={c.id}
                    onClick={() => handleForwardToChat(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-[10px] hover:bg-[#2C2C2E] text-left"
                  >
                    <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[16px] font-semibold text-white" style={{ background: '#636366' }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[15px] text-white font-medium">{displayName}</p>
                      <p className="text-[13px]" style={{ color: '#ABABAF' }}>{c.type === 'group' ? 'Группа' : c.type === 'secret' ? 'Секретный' : 'Личный'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LO-12: Toast «Скопировано» */}
      {showCopyToast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full text-[14px] text-white"
          style={{ background: 'rgba(60,60,67,0.9)', animation: 'fadeIn 0.2s ease forwards' }}
          role="status"
          aria-live="polite"
        >
          Скопировано
        </div>
      )}
    </div>
  );
}
