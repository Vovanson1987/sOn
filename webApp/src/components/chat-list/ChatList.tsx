import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useChatStore } from '@stores/chatStore';
import { SearchBar } from '@components/ui/SearchBar';
import { ChatListHeader } from './ChatListHeader';
import { ChatListItem } from './ChatListItem';
import { NewChatModal } from './NewChatModal';

export function ChatList() {
  const [showNewChat, setShowNewChat] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const chats = useChatStore((s) => s.chats);
  const isLoading = useChatStore((s) => s.isLoading);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const filter = useChatStore((s) => s.filter);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 200);
  }, [setSearchQuery]);

  // Синхронизировать при внешних изменениях
  useEffect(() => { setLocalSearch(searchQuery); }, [searchQuery]);

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
      <ChatListHeader
        onNewChat={() => setShowNewChat(true)}
        onFilter={() => {
          const filters: Array<typeof filter> = ['all', 'unread', 'groups', 'secret'];
          const idx = filters.indexOf(filter);
          const next = filters[(idx + 1) % filters.length];
          useChatStore.getState().setFilter(next);
        }}
        filterActive={filter !== 'all'}
      />
      <div className="px-2 pb-1">
        <SearchBar value={localSearch} onChange={handleSearchChange} placeholder="Поиск чатов" />
      </div>

      <div
        className="flex-1 overflow-y-auto px-3"
        role="list"
        aria-label="Чаты"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Skeleton при загрузке */}
        {isLoading && chats.length === 0 ? (
          <div className="space-y-1 px-1" role="status" aria-label="Загрузка чатов">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-[10px] animate-pulse">
                <div className="w-[50px] h-[50px] rounded-full" style={{ background: '#2C2C2E' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-[14px] rounded" style={{ background: '#2C2C2E', width: '60%' }} />
                  <div className="h-[12px] rounded" style={{ background: '#2C2C2E', width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <p className="text-[14px]" style={{ color: '#ABABAF' }}>
              {searchQuery ? 'Ничего не найдено' : 'Нет чатов'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowNewChat(true)}
                className="px-4 min-h-[44px] rounded-[10px] text-[14px] font-medium text-white"
                style={{ background: '#007AFF' }}
              >
                Начать чат
              </button>
            )}
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

      {/* Модальное окно "Новый чат" */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={(chatId) => {
            setShowNewChat(false);
            setActiveChat(chatId);
          }}
        />
      )}
    </nav>
  );
}
