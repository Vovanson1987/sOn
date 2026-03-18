import { useCallback, useEffect, useState } from 'react';
import { ChatList } from '@components/chat-list/ChatList';
import { ConversationScreen } from '@components/conversation/ConversationScreen';
import { CallScreen } from '@components/calls/CallScreen';
import { SettingsScreen } from '@components/settings/SettingsScreen';
import { TabBar, type TabId } from '@components/layout/TabBar';
import { useChatStore } from '@stores/chatStore';
import { useCallStore } from '@stores/callStore';

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
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const activeCall = useCallStore((s) => s.activeCall);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const handleBack = useCallback(() => setActiveChat(null), [setActiveChat]);

  const width = useWindowWidth();
  const isMobile = width < 768;

  // Мобильный tab bar
  const [activeTab, setActiveTab] = useState<TabId>('chats');

  // Подсчёт непрочитанных
  const unreadChats = chats.filter((c) => c.unreadCount > 0).length;

  // Горячие клавиши: Ctrl+K (поиск), Ctrl+N (новый чат), Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[aria-label="Поиск чатов"]');
        input?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        // TODO: открыть экран нового чата
      }
      if (e.key === 'Escape') {
        if (activeChatId) setActiveChat(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeChatId, setActiveChat]);

  // Мобильная версия: полноэкранные режимы
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-black">
        {/* Экран звонка поверх всего */}
        {activeCall && <CallScreen />}

        <div className="flex-1 overflow-hidden">
          {activeTab === 'chats' && !activeChat && <ChatList />}
          {activeTab === 'chats' && activeChat && (
            <ConversationScreen chat={activeChat} onBack={handleBack} />
          )}
          {activeTab === 'settings' && <SettingsScreen />}
          {activeTab === 'calls' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[15px]" style={{ color: '#8E8E93' }}>Журнал звонков</p>
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[15px]" style={{ color: '#8E8E93' }}>Контакты</p>
            </div>
          )}
        </div>

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
      {/* Экран звонка поверх всего */}
      {activeCall && <CallScreen />}

      {/* Sidebar — список чатов */}
      <div className="w-[340px] flex-shrink-0 h-full">
        <ChatList />
      </div>

      {/* Область чата */}
      <main className="flex-1 h-full">
        {activeChat ? (
          <ConversationScreen chat={activeChat} onBack={handleBack} />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#000' }}>
            <p className="text-[15px]" style={{ color: '#8E8E93' }}>
              Выберите чат
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
