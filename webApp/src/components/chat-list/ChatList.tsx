import { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties, type ReactElement } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { MessageSquarePlus, SearchX } from 'lucide-react';
import { useChatStore } from '@stores/chatStore';
import { SearchBar } from '@components/ui/SearchBar';
import { ChatListItemSkeleton } from '@components/ui/Skeleton';
import { EmptyState } from '@components/ui/EmptyState';
import { Button } from '@components/ui/Button';
import { ChatListHeader } from './ChatListHeader';
import { ChatListItem } from './ChatListItem';
import { NewChatModal } from './NewChatModal';
import { StoriesBar } from '@components/stories/StoriesBar';
import type { Chat } from '@/types/chat';

/** LO-16: Виртуализированная строка чата для react-window */
interface ChatRowCustomProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
}

function ChatRow({ index, style, ariaAttributes, chats, activeChatId, onSelect }: RowComponentProps<ChatRowCustomProps>): ReactElement | null {
  const chat = chats[index];
  if (!chat) return null;
  return (
    <div style={style} {...ariaAttributes}>
      <ChatListItem chat={chat} isActive={chat.id === activeChatId} onSelect={onSelect} />
    </div>
  );
}

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

  // LO-16: Отслеживание высоты контейнера для react-window
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Клавиатурная навигация: ↑/↓ — предыдущий/следующий чат, Home/End — крайние.
  // Работает, когда фокус находится внутри nav (и не в инпуте поиска).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (filteredChats.length === 0) return;
      const curIdx = filteredChats.findIndex((c) => c.id === activeChatId);
      let next = curIdx;
      switch (e.key) {
        case 'ArrowDown':
          next = curIdx < 0 ? 0 : Math.min(filteredChats.length - 1, curIdx + 1);
          break;
        case 'ArrowUp':
          next = curIdx < 0 ? filteredChats.length - 1 : Math.max(0, curIdx - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = filteredChats.length - 1;
          break;
        default:
          return;
      }
      if (next !== curIdx && filteredChats[next]) {
        e.preventDefault();
        setActiveChat(filteredChats[next].id);
      }
    },
    [filteredChats, activeChatId, setActiveChat],
  );

  return (
    <nav
      className="flex flex-col h-full outline-none"
      style={{ background: '#1e1e2e' }}
      aria-label="Список чатов"
      tabIndex={0}
      onKeyDown={handleKeyDown}
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
      {/* P2.11: Stories bar */}
      <StoriesBar />

      <div className="px-2 pb-1">
        <SearchBar value={localSearch} onChange={handleSearchChange} placeholder="Поиск чатов" />
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-3"
        aria-label="Чаты"
      >
        {/* Shimmer-скелетоны при первичной загрузке */}
        {isLoading && chats.length === 0 ? (
          <div role="status" aria-label="Загрузка чатов">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ChatListItemSkeleton key={i} />
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          searchQuery ? (
            <EmptyState
              icon={<SearchX size={24} />}
              title="Ничего не найдено"
              description={`По запросу «${searchQuery}» чатов нет`}
            />
          ) : (
            <EmptyState
              icon={<MessageSquarePlus size={24} />}
              title="Нет чатов"
              description="Начните первый разговор — выберите контакт или создайте группу"
              action={
                <Button
                  variant="primary"
                  leftIcon={<MessageSquarePlus size={16} />}
                  onClick={() => setShowNewChat(true)}
                >
                  Начать чат
                </Button>
              }
            />
          )
        ) : containerHeight > 0 ? (
          /* LO-16: Виртуализированный список чатов */
          <List
            rowComponent={ChatRow}
            rowCount={filteredChats.length}
            rowHeight={72}
            rowProps={{ chats: filteredChats, activeChatId, onSelect: handleSelect }}
            style={{ height: containerHeight, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as CSSProperties}
            role="list"
            aria-label="Чаты"
          />
        ) : (
          /* Fallback: обычный список (для тестов / SSR) */
          <div role="list" aria-label="Чаты">
            {filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                onSelect={handleSelect}
              />
            ))}
          </div>
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
