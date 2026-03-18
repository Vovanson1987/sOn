import { useCallback } from 'react';
import { useChatStore } from '@stores/chatStore';
import { SearchBar } from '@components/ui/SearchBar';
import { ChatListHeader } from './ChatListHeader';
import { ChatListItem } from './ChatListItem';

export function ChatList() {
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const filteredChats = useChatStore((s) => s.filteredChats);

  const chats = filteredChats();

  const handleSelect = useCallback(
    (chatId: string) => setActiveChat(chatId),
    [setActiveChat],
  );

  return (
    <nav
      className="flex flex-col h-full"
      style={{ backgroundColor: '#1C1C1E', borderRight: '0.5px solid #38383A' }}
      aria-label="Список чатов"
    >
      <ChatListHeader />
      <div className="px-2 pb-1">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Поиск" />
      </div>

      <div
        className="flex-1 overflow-y-auto px-1"
        role="list"
        aria-label="Чаты"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {chats.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-[13px]" style={{ color: '#8E8E93' }}>
            Нет чатов
          </div>
        ) : (
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </nav>
  );
}
