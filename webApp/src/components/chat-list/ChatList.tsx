import { useCallback, useMemo } from 'react';
import { useChatStore } from '@stores/chatStore';
import { SearchBar } from '@components/ui/SearchBar';
import { ChatListHeader } from './ChatListHeader';
import { ChatListItem } from './ChatListItem';

export function ChatList() {
  const chats = useChatStore((s) => s.chats);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const filter = useChatStore((s) => s.filter);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  // Фильтрация и поиск через useMemo (без функции в сторе)
  const filteredChats = useMemo(() => {
    let result = chats;

    if (filter === 'unread') result = result.filter((c) => c.unreadCount > 0);
    else if (filter === 'groups') result = result.filter((c) => c.type === 'group');
    else if (filter === 'secret') result = result.filter((c) => c.type === 'secret');
    else if (filter === 'archived') result = result.filter((c) => c.isArchived);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name?.toLowerCase().includes(q) ?? false) ||
          c.members.some((m) => m.displayName.toLowerCase().includes(q)),
      );
    }

    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [chats, searchQuery, filter]);

  const handleSelect = useCallback(
    (chatId: string) => setActiveChat(chatId),
    [setActiveChat],
  );

  return (
    <nav
      className="flex flex-col h-full"
      style={{ background: '#1C1C1E', borderRight: '0.5px solid #38383A' }}
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
        {filteredChats.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-[13px]" style={{ color: '#8E8E93' }}>
            Нет чатов
          </div>
        ) : (
          filteredChats.map((chat) => (
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
