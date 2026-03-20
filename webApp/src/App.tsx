import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { ChatList } from '@components/chat-list/ChatList';
import { TabBar, type TabId } from '@components/layout/TabBar';

// Lazy-загрузка тяжёлых компонентов (code splitting)
const ConversationScreen = lazy(() => import('@components/conversation/ConversationScreen').then(m => ({ default: m.ConversationScreen })));
const CallScreen = lazy(() => import('@components/calls/CallScreen').then(m => ({ default: m.CallScreen })));
const SettingsScreen = lazy(() => import('@components/settings/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const AuthScreen = lazy(() => import('@components/auth/AuthScreen').then(m => ({ default: m.AuthScreen })));
import { useChatStore } from '@stores/chatStore';
import { useMessageStore } from '@stores/messageStore';
import { useCallStore } from '@stores/callStore';
import { useAuthStore } from '@stores/authStore';
import { connectWS, disconnectWS, onWS } from '@/api/client';
import { handleSignaling } from '@/utils/webrtc';

/** Хук для определения ширины окна */
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLogin = useAuthStore((s) => s.login);
  const restore = useAuthStore((s) => s.restore);

  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const activeCall = useCallStore((s) => s.activeCall);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const handleBack = useCallback(() => setActiveChat(null), [setActiveChat]);

  const width = useWindowWidth();
  const isMobile = width < 768;

  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const unreadChats = chats.filter((c) => c.unreadCount > 0).length;

  // Восстановить сессию при загрузке
  useEffect(() => { restore(); }, [restore]);

  const fetchChats = useChatStore((s) => s.fetchChats);
  const addMessage = useMessageStore((s) => s.addMessage);

  // Подключить WebSocket и загрузить чаты при авторизации
  useEffect(() => {
    if (isAuthenticated) {
      connectWS();
      fetchChats();

      // Слушать входящие события через WebSocket
      const unsub = onWS((data: unknown) => {
        const msg = data as Record<string, unknown>;

        // Новое сообщение
        if (msg.type === 'new_message') {
          const m = msg.message as Record<string, string>;
          addMessage(m.chat_id, {
            id: m.id,
            chatId: m.chat_id,
            senderId: m.sender_id,
            senderName: m.sender_name || '',
            content: m.content,
            type: (m.type as import('@/types/message').MessageType) || 'text',
            status: 'delivered',
            reactions: {},
            isDestroyed: false,
            createdAt: m.created_at,
          });
        }

        // WebRTC signaling события
        if (['call_answer', 'ice_candidate', 'call_end', 'call_reject'].includes(msg.type as string)) {
          handleSignaling(msg as Record<string, unknown>);
        }
      });

      return () => { disconnectWS(); unsub(); };
    }
  }, [isAuthenticated, fetchChats, addMessage]);

  // Горячие клавиши
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Поиск чатов"]')?.focus();
      }
      if (e.key === 'Escape' && activeChatId) setActiveChat(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeChatId, setActiveChat, isAuthenticated]);

  // Обработчик авторизации
  const handleAuth = useCallback((token: string, user: { id: string; email: string; display_name: string }) => {
    authLogin(token, user);
  }, [authLogin]);

  // Экран авторизации (если не залогинен)
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-full bg-black" />}>
        <AuthScreen onAuth={handleAuth} />
      </Suspense>
    );
  }

  // Мобильная версия: полноэкранные режимы
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-black">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-black focus:text-white">Перейти к контенту</a>
        {/* Экран звонка поверх всего */}
        <Suspense fallback={null}>
          {activeCall && <CallScreen />}
        </Suspense>

        <main className="flex-1 overflow-hidden" id="main-content">
          {activeTab === 'chats' && !activeChat && <ChatList />}
          <Suspense fallback={<div className="flex items-center justify-center h-full bg-black" role="status"><span className="sr-only">Загрузка...</span></div>}>
            {activeTab === 'chats' && activeChat && (
              <ConversationScreen chat={activeChat} onBack={handleBack} />
            )}
            {activeTab === 'settings' && <SettingsScreen />}
          </Suspense>
          {activeTab === 'calls' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[15px]" style={{ color: '#ABABAF' }}>Журнал звонков</p>
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[15px]" style={{ color: '#ABABAF' }}>Контакты</p>
            </div>
          )}
        </main>

        {/* Tab bar (скрывается когда открыт чат) */}
        {!(activeTab === 'chats' && activeChat) && (
          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            unreadChats={unreadChats}
          />
        )}
      </div>
    );
  }

  // Desktop/Tablet: двухколоночный layout
  return (
    <div className="flex h-full w-full bg-black">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-black focus:text-white">Перейти к контенту</a>
      {/* Экран звонка поверх всего */}
      <Suspense fallback={null}>
        {activeCall && <CallScreen />}
      </Suspense>

      {/* Sidebar — список чатов */}
      <div className="w-[340px] flex-shrink-0 h-full">
        <ChatList />
      </div>

      {/* Область чата */}
      <main className="flex-1 h-full" id="main-content">
        <Suspense fallback={<div className="flex items-center justify-center h-full bg-black" />}>
        {activeChat ? (
          <ConversationScreen chat={activeChat} onBack={handleBack} />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#000' }}>
            <p className="text-[15px]" style={{ color: '#ABABAF' }}>
              Выберите чат
            </p>
          </div>
        )}
        </Suspense>
      </main>
    </div>
  );
}
