import { ChatList } from '@components/chat-list/ChatList';
import { ConversationScreen } from '@components/conversation/ConversationScreen';
import { useChatStore } from '@stores/chatStore';
import { useCallback } from 'react';

export default function App() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  const activeChat = chats.find((c) => c.id === activeChatId);

  const handleBack = useCallback(() => setActiveChat(null), [setActiveChat]);

  return (
    <div className="flex h-full w-full bg-black">
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
