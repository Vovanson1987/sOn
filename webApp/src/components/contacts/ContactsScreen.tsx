import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, Star, Search, X, UserPlus, Trash2 } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { SearchBar } from '@components/ui/SearchBar';
import { useFocusTrap } from '@hooks/useFocusTrap';
import { useChatStore } from '@stores/chatStore';
import * as api from '@/api/client';

// ==================== TYPES ====================

interface Contact {
  id: string;
  nickname: string | null;
  is_favorite: boolean;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface UserResult {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  is_online: boolean;
}

// ==================== ADD CONTACT MODAL ====================

interface AddContactModalProps {
  onClose: () => void;
  onContactAdded: () => void;
}

function AddContactModal({ onClose, onContactAdded }: AddContactModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const focusTrapRef = useFocusTrap();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setError(null);
    if (q.length < 2) {
      setResults([]);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchUsers(q);
        setResults(data.users as UserResult[]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleAdd = useCallback(
    async (user: UserResult) => {
      setError(null);
      setAddingId(user.id);
      try {
        await api.addContact(user.id);
        onContactAdded();
      } catch {
        setError('Не удалось добавить контакт. Попробуйте ещё раз.');
      } finally {
        setAddingId(null);
      }
    },
    [onContactAdded],
  );

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Добавить контакт"
    >
      <div
        className="w-full max-w-[400px] mx-4 rounded-[16px] overflow-hidden"
        style={{ background: '#1e1e2e' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-[17px] font-semibold text-white">Добавить контакт</h2>
          <button onClick={onClose} aria-label="Закрыть">
            <X size={20} color="#8E8E93" aria-hidden="true" />
          </button>
        </div>

        {/* Поиск */}
        <div className="px-4 py-2">
          <div
            className="flex items-center gap-2 px-3 py-[8px] rounded-[10px]"
            style={{ background: '#282840' }}
          >
            <Search size={16} color="#8E8E93" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск по email или имени"
              aria-label="Поиск пользователей"
              autoFocus
              className="flex-1 bg-transparent text-[15px] text-white placeholder-[#636366] outline-none"
            />
          </div>
        </div>

        {/* Результаты */}
        <div className="max-h-[300px] overflow-y-auto">
          {searching && (
            <p className="text-center py-4 text-[14px]" style={{ color: '#ABABAF' }}>
              Поиск...
            </p>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-center py-4 text-[14px]" style={{ color: '#ABABAF' }}>
              Пользователи не найдены
            </p>
          )}

          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleAdd(user)}
              disabled={addingId === user.id}
              className="w-full flex items-center gap-3 px-4 py-[10px] hover:bg-[#282840] text-left disabled:opacity-50"
            >
              <div className="relative">
                <Avatar size={40} name={user.display_name} src={user.avatar_url} />
                {user.is_online && (
                  <div
                    className="absolute bottom-0 right-0 w-[10px] h-[10px] rounded-full"
                    style={{ background: '#30D158', border: '2px solid #1e1e2e' }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white font-medium truncate">{user.display_name}</p>
                <p className="text-[13px] truncate" style={{ color: '#ABABAF' }}>
                  {user.email}
                </p>
              </div>
              {addingId === user.id ? (
                <span className="text-[13px]" style={{ color: '#ABABAF' }}>
                  ...
                </span>
              ) : (
                <UserPlus size={18} color="#5B5FC7" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        {/* Ошибка */}
        {error && (
          <p className="text-center py-2 px-4 text-[13px]" style={{ color: '#FF453A' }}>
            {error}
          </p>
        )}

        {/* Подсказка */}
        {query.length < 2 && !error && (
          <p className="text-center py-6 text-[13px]" style={{ color: '#636366' }}>
            Введите email или имя для поиска
          </p>
        )}
      </div>
    </div>
  );
}

// ==================== CONTACT ROW ====================

interface ContactRowProps {
  contact: Contact;
  onToggleFavorite: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onSelect: (contact: Contact) => void;
}

function ContactRow({ contact, onToggleFavorite, onDelete, onSelect }: ContactRowProps) {
  const [showActions, setShowActions] = useState(false);
  const touchStartXRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = contact.nickname || contact.display_name;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 80) {
      setShowActions(true);
    } else if (diff < -80) {
      setShowActions(false);
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setShowActions((prev) => !prev);
    },
    [],
  );

  // Cleanup long-press timer
  useEffect(() => {
    const timer = longPressTimerRef.current;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Swipe action zone */}
      {showActions && (
        <div className="absolute right-0 top-0 bottom-0 flex items-stretch z-10">
          <button
            onClick={() => {
              onToggleFavorite(contact);
              setShowActions(false);
            }}
            className="flex items-center justify-center w-[64px]"
            style={{ background: '#FF9500' }}
            aria-label={contact.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          >
            <Star size={20} color="#fff" fill={contact.is_favorite ? '#fff' : 'none'} />
          </button>
          <button
            onClick={() => {
              onDelete(contact);
              setShowActions(false);
            }}
            className="flex items-center justify-center w-[64px]"
            style={{ background: '#FF453A' }}
            aria-label="Удалить контакт"
          >
            <Trash2 size={20} color="#fff" />
          </button>
        </div>
      )}

      <button
        onClick={() => {
          if (showActions) {
            setShowActions(false);
          } else {
            onSelect(contact);
          }
        }}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full flex items-center gap-3 px-4 py-[10px] text-left transition-transform"
        style={{
          transform: showActions ? 'translateX(-128px)' : 'translateX(0)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Аватар + онлайн-индикатор */}
        <div className="relative flex-shrink-0">
          <Avatar size={44} name={displayName} src={contact.avatar_url ?? undefined} />
          {contact.is_online && (
            <div
              className="absolute bottom-0 right-0 w-[12px] h-[12px] rounded-full"
              style={{ background: '#30D158', border: '2px solid #1e1e2e' }}
            />
          )}
        </div>

        {/* Имя и статус */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] text-white font-medium truncate">{displayName}</p>
            {contact.is_favorite && (
              <Star size={12} color="#FF9500" fill="#FF9500" aria-label="Избранный" />
            )}
          </div>
          <p className="text-[13px] truncate" style={{ color: '#ABABAF' }}>
            {contact.is_online ? 'в сети' : 'не в сети'}
          </p>
        </div>
      </button>

      {/* Разделитель */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', marginLeft: '68px' }} />
    </div>
  );
}

// ==================== EMPTY STATE ====================

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
      <div
        className="w-[80px] h-[80px] rounded-full flex items-center justify-center"
        style={{ background: '#282840' }}
      >
        <Users size={36} color="#636366" aria-hidden="true" />
      </div>
      <p className="text-[15px] text-center" style={{ color: '#ABABAF' }}>
        У вас пока нет контактов
      </p>
      <button
        onClick={onAdd}
        className="px-5 min-h-[44px] rounded-[10px] text-[15px] font-medium text-white"
        style={{ background: '#5B5FC7' }}
      >
        Добавить первый контакт
      </button>
    </div>
  );
}

// ==================== CONTACTS SCREEN ====================

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const createChat = useChatStore((s) => s.createChat);
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  // ---------- Загрузка контактов ----------

  const loadContacts = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getContacts();
      setContacts(data.contacts);
    } catch {
      setError('Не удалось загрузить контакты');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // ---------- Фильтрация ----------

  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          (c.nickname && c.nickname.toLowerCase().includes(q)) ||
          c.email.toLowerCase().includes(q),
      );
    }

    // Избранные сверху, затем по имени
    return result.sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      const nameA = (a.nickname || a.display_name).toLowerCase();
      const nameB = (b.nickname || b.display_name).toLowerCase();
      return nameA.localeCompare(nameB, 'ru');
    });
  }, [contacts, searchQuery]);

  // ---------- Действия ----------

  const handleToggleFavorite = useCallback(async (contact: Contact) => {
    const newVal = !contact.is_favorite;
    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, is_favorite: newVal } : c)),
    );
    try {
      await api.updateContact(contact.id, { is_favorite: newVal });
    } catch {
      // Revert on error
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, is_favorite: !newVal } : c)),
      );
    }
  }, []);

  const handleDelete = useCallback(async (contact: Contact) => {
    // Optimistic removal
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    try {
      await api.deleteContact(contact.id);
    } catch {
      // Reload on error
      loadContacts();
    }
  }, [loadContacts]);

  const handleSelect = useCallback(
    async (contact: Contact) => {
      try {
        const chatId = await createChat([contact.user_id]);
        if (chatId) {
          setActiveChat(chatId);
        }
      } catch {
        console.error('Failed to open chat with contact');
      }
    },
    [createChat, setActiveChat],
  );

  const handleContactAdded = useCallback(() => {
    setShowAddModal(false);
    loadContacts();
  }, [loadContacts]);

  // ---------- Render ----------

  return (
    <div className="flex flex-col h-full bg-[#141420]">
      {/* Заголовок */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-[22px] font-bold text-white">Контакты</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
          style={{ background: '#282840' }}
          aria-label="Добавить контакт"
        >
          <UserPlus size={18} color="#5B5FC7" aria-hidden="true" />
        </button>
      </div>

      {/* Поиск */}
      <div className="px-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск контактов"
        />
      </div>

      {/* Состояния загрузки / ошибки */}
      {isLoading ? (
        <div className="flex-1 px-1" role="status" aria-label="Загрузка контактов">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-[10px] animate-pulse">
              <div
                className="w-[44px] h-[44px] rounded-full flex-shrink-0"
                style={{ background: '#282840' }}
              />
              <div className="flex-1 space-y-2">
                <div
                  className="h-[14px] rounded"
                  style={{ background: '#282840', width: '50%' }}
                />
                <div
                  className="h-[12px] rounded"
                  style={{ background: '#282840', width: '30%' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
          <p className="text-[15px] text-center" style={{ color: '#FF453A' }}>
            {error}
          </p>
          <button
            onClick={loadContacts}
            className="px-5 min-h-[44px] rounded-[10px] text-[15px] font-medium text-white"
            style={{ background: '#5B5FC7' }}
          >
            Повторить
          </button>
        </div>
      ) : contacts.length === 0 && !searchQuery ? (
        <EmptyState onAdd={() => setShowAddModal(true)} />
      ) : filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-[14px]" style={{ color: '#ABABAF' }}>
            Ничего не найдено
          </p>
        </div>
      ) : (
        /* Список контактов */
        <div className="flex-1 overflow-y-auto" role="list" aria-label="Контакты">
          {filteredContacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Модальное окно добавления контакта */}
      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onContactAdded={handleContactAdded}
        />
      )}
    </div>
  );
}
