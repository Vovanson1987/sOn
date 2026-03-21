import { useCallback, useEffect, useRef, useState, useSyncExternalStore, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChatList } from '@components/chat-list/ChatList';
import { TabBar, type TabId } from '@components/layout/TabBar';
import { Phone, Users } from 'lucide-react';

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

/** Хук для отслеживания онлайн/офлайн статуса */
function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
  );
}

/** Хук для определения ширины окна (с debounce) */
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setWidth(window.innerWidth), 150);
    };
    window.addEventListener('resize', handler);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handler);
    };
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
  const isOnline = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const unreadChats = chats.filter((c) => c.unreadCount > 0).length;

  // CR-08: URL routing sync
  const navigate = useNavigate();
  const location = useLocation();
  const isSyncingFromUrl = useRef(false);

  // URL -> state (browser back/forward, direct URL entry)
  useEffect(() => {
    isSyncingFromUrl.current = true;
    const path = location.pathname;
    if (path === '/settings') {
      setActiveTab('settings');
    } else if (path === '/calls') {
      setActiveTab('calls');
    } else if (path === '/contacts') {
      setActiveTab('contacts');
    } else {
      setActiveTab('chats');
      const match = path.match(/^\/chat\/([^/]+)$/);
      const urlChatId = match ? match[1] : null;
      if (urlChatId !== useChatStore.getState().activeChatId) {
        setActiveChat(urlChatId);
      }
    }
    isSyncingFromUrl.current = false;
  }, [location.pathname, setActiveChat]);

  // State -> URL (user clicks chat in ChatList, changes tab)
  useEffect(() => {
    if (isSyncingFromUrl.current) return;
    let target: string;
    if (activeTab === 'settings') target = '/settings';
    else if (activeTab === 'calls') target = '/calls';
    else if (activeTab === 'contacts') target = '/contacts';
    else target = activeChatId ? `/chat/${activeChatId}` : '/';

    if (location.pathname !== target) {
      navigate(target);
    }
  }, [activeChatId, activeTab, navigate, location.pathname]);

  // Восстановить сессию при загрузке
  useEffect(() => { restore(); }, [restore]);

  const fetchChats = useChatStore((s) => s.fetchChats);
  const addServerMessage = useMessageStore((s) => s.addServerMessage);

  // HI-11: Восстановить E2EE сессии при авторизации
  useEffect(() => {
    if (isAuthenticated) {
      import('@stores/secretChatStore').then(({ useSecretChatStore }) => {
        useSecretChatStore.getState().restoreSessions();
      });
    }
  }, [isAuthenticated]);

  // Подключить WebSocket и загрузить чаты при авторизации
  useEffect(() => {
    if (isAuthenticated) {
      connectWS();
      fetchChats();

      // Слушать входящие события через WebSocket
      const unsub = onWS((data: unknown) => {
        const msg = data as Record<string, unknown>;

        // Новое сообщение (от других пользователей)
        if (msg.type === 'new_message') {
          const m = msg.message as Record<string, unknown>;
          // Пропустить свои сообщения — они уже добавлены через optimistic update
          const myId = useAuthStore.getState().user?.id;
          if (m.sender_id === myId) return;
          void addServerMessage(m);
        }

        // Удаление чатов от других пользователей
        if (msg.type === 'chat_deleted') {
          const chatId = msg.chat_id as string;
          if (chatId) {
            useChatStore.getState().removeChatLocal(chatId);
          }
        }

        // CR-07: Удаление сообщений от других пользователей
        if (msg.type === 'message_deleted') {
          const messageId = msg.message_id as string;
          const chatId = msg.chat_id as string;
          if (messageId) {
            if (chatId) {
              useMessageStore.getState().removeMessageLocal(chatId, messageId);
            } else {
              // Fallback: поискать сообщение во всех чатах
              const state = useMessageStore.getState();
              for (const cId of Object.keys(state.messages)) {
                if (state.messages[cId]?.some(m => m.id === messageId)) {
                  state.removeMessageLocal(cId, messageId);
                  break;
                }
              }
            }
          }
        }

        // ME-15: Typing events от других пользователей
        if (msg.type === 'typing') {
          const chatId = msg.chat_id as string;
          const userName = msg.display_name as string;
          if (chatId && userName) {
            useMessageStore.getState().setTyping(chatId, userName);
          }
        }
        if (msg.type === 'stop_typing') {
          const chatId = msg.chat_id as string;
          const userName = msg.display_name as string;
          if (chatId && userName) {
            useMessageStore.getState().clearTyping(chatId, userName);
          }
        }

        // WebRTC signaling события
        if (['call_answer', 'ice_candidate', 'call_end', 'call_reject'].includes(msg.type as string)) {
          handleSignaling(msg as Record<string, unknown>);
        }
      });

      return () => { disconnectWS(); unsub(); };
    }
  }, [isAuthenticated, fetchChats, addServerMessage]);

  // Горячие клавиши
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Поиск чатов"]')?.focus();
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
      <Suspense fallback={<div className="flex items-center justify-center h-full bg-black" role="status"><span className="sr-only">Загрузка...</span></div>}>
        <AuthScreen onAuth={handleAuth} />
      </Suspense>
    );
  }

  // Мобильная версия: полноэкранные режимы
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-black">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-black focus:text-white">Перейти к контенту</a>
        {!isOnline && (
          <div role="alert" className="w-full text-center text-[13px] font-semibold text-white py-1" style={{ background: '#FF453A' }}>
            Нет соединения
          </div>
        )}
        {/* Экран звонка поверх всего */}
        <Suspense fallback={null}>
          {activeCall && <CallScreen />}
        </Suspense>

        <main className="flex-1 overflow-hidden" id="main-content" style={{ animation: 'fadeIn 0.2s ease-out' }} key={activeTab + (activeChatId || '')}>
          {activeTab === 'chats' && !activeChat && <ChatList />}
          <Suspense fallback={<div className="flex items-center justify-center h-full bg-black" role="status"><span className="sr-only">Загрузка...</span></div>}>
            {activeTab === 'chats' && activeChat && (
              <ConversationScreen chat={activeChat} onBack={handleBack} />
            )}
            {activeTab === 'settings' && <SettingsScreen />}
          </Suspense>
          {activeTab === 'calls' && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Phone size={48} color="#636366" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-white">Нет звонков</p>
              <p className="text-[14px] text-center px-8" style={{ color: '#ABABAF' }}>
                Здесь будет отображаться журнал ваших звонков
              </p>
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Users size={48} color="#636366" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-white">Нет контактов</p>
              <p className="text-[14px] text-center px-8" style={{ color: '#ABABAF' }}>
                Здесь будут отображаться ваши контакты
              </p>
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
    <div className="flex flex-col h-full w-full bg-black">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-black focus:text-white">Перейти к контенту</a>
      {!isOnline && (
        <div role="alert" className="w-full text-center text-[13px] font-semibold text-white py-1" style={{ background: '#FF453A' }}>
          Нет соединения
        </div>
      )}
      {/* Экран звонка поверх всего */}
      <Suspense fallback={null}>
        {activeCall && <CallScreen />}
      </Suspense>

      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar — список чатов */}
      <div className="w-[340px] flex-shrink-0 h-full">
        <ChatList />
      </div>

      {/* Область чата */}
      <main className="flex-1 h-full" id="main-content">
        <Suspense fallback={<div className="flex items-center justify-center h-full bg-black" role="status"><span className="sr-only">Загрузка...</span></div>}>
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
    </div>
  );
}
