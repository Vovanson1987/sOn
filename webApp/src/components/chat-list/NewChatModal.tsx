import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import * as api from '@/api/client';
import { useChatStore } from '@stores/chatStore';

interface NewChatModalProps {
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

interface UserResult {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  is_online: boolean;
}

/** Модальное окно создания нового чата (поиск пользователей) */
export function NewChatModal({ onClose, onChatCreated }: NewChatModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const createChat = useChatStore((s) => s.createChat);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => previousFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }

    setSearching(true);
    try {
      const data = await api.searchUsers(q);
      setResults(data.users as UserResult[]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelect = useCallback(async (user: UserResult) => {
    const chatId = await createChat([user.id]);
    if (chatId) {
      onChatCreated(chatId);
    }
  }, [createChat, onChatCreated]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Новый чат"
    >
      <div
        className="w-full max-w-[400px] mx-4 rounded-[16px] overflow-hidden"
        style={{ background: '#1C1C1E' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#38383A' }}>
          <h2 className="text-[17px] font-semibold text-white">Новый чат</h2>
          <button onClick={onClose}><X size={20} color="#8E8E93" /></button>
        </div>

        {/* Поиск */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-[8px] rounded-[10px]" style={{ background: '#2C2C2E' }}>
            <Search size={16} color="#8E8E93" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск по email или имени"
              autoFocus
              className="flex-1 bg-transparent text-[15px] text-white placeholder-[#636366] outline-none"
            />
          </div>
        </div>

        {/* Результаты */}
        <div className="max-h-[300px] overflow-y-auto">
          {searching && (
            <p className="text-center py-4 text-[14px]" style={{ color: '#8E8E93' }}>Поиск...</p>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-center py-4 text-[14px]" style={{ color: '#8E8E93' }}>
              Пользователи не найдены
            </p>
          )}

          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className="w-full flex items-center gap-3 px-4 py-[10px] hover:bg-[#2C2C2E] text-left"
            >
              <div className="relative">
                <Avatar size={40} name={user.display_name} src={user.avatar_url} />
                {user.is_online && (
                  <div
                    className="absolute bottom-0 right-0 w-[10px] h-[10px] rounded-full"
                    style={{ background: '#30D158', border: '2px solid #1C1C1E' }}
                  />
                )}
              </div>
              <div>
                <p className="text-[15px] text-white font-medium">{user.display_name}</p>
                <p className="text-[13px]" style={{ color: '#8E8E93' }}>{user.email}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Подсказка */}
        {query.length < 2 && (
          <p className="text-center py-6 text-[13px]" style={{ color: '#636366' }}>
            Введите email или имя для поиска
          </p>
        )}
      </div>
    </div>
  );
}
