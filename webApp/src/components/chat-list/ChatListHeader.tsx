/**
 * Redesign: ChatListHeader в стиле MAX — заголовок "Чаты" + кнопка [+] с dropdown.
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, Users, Hash, Phone, Search, Link2 } from 'lucide-react';
import { t } from '@/i18n';

interface ChatListHeaderProps {
  onNewChat?: () => void;
  onNewChannel?: () => void;
  onNewGroupCall?: () => void;
  onFindByNumber?: () => void;
  onInviteByLink?: () => void;
  onFilter?: () => void;
  filterActive?: boolean;
}

const MENU_ITEMS = [
  { id: 'group', label: 'Создать группу', icon: Users },
  { id: 'channel', label: 'Создать приватный канал', icon: Hash },
  { id: 'call', label: 'Создать групповой звонок', icon: Phone },
  { id: 'find', label: 'Найти по номеру', icon: Search },
  { id: 'invite', label: 'Пригласить по ссылке', icon: Link2 },
] as const;

export function ChatListHeader({
  onNewChat,
  onNewChannel,
  onNewGroupCall,
  onFindByNumber,
  onInviteByLink,
}: ChatListHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрыть dropdown по клику вне
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleAction = (id: string) => {
    setShowMenu(false);
    switch (id) {
      case 'group': onNewChat?.(); break;
      case 'channel': onNewChannel?.(); break;
      case 'call': onNewGroupCall?.(); break;
      case 'find': onFindByNumber?.(); break;
      case 'invite': onInviteByLink?.(); break;
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-3 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h1 className="text-[22px] font-bold text-white">
        {t('nav.chats')}
      </h1>

      {/* Кнопка [+] с dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-[36px] h-[36px] rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#5B5FC7' }}
          aria-label="Создать"
          aria-expanded={showMenu}
        >
          <Plus size={18} color="white" />
        </button>

        {showMenu && (
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-50 rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: '#282840',
              border: '1px solid rgba(255,255,255,0.08)',
              minWidth: '240px',
            }}
          >
            {MENU_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleAction(id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ color: '#fff' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span className="text-[14px]">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
