/**
 * Redesign: Вертикальный sidebar в стиле MAX/Telegram Desktop.
 * Слева от основного контента, ~68px шириной.
 * Иконки с подписями: Все, Каналы, Контакты, Звонки. Настройки — внизу.
 */

import { memo } from 'react';
import {
  MessageSquare, Hash, Users, Phone, Settings,
} from 'lucide-react';
// Sidebar использует захардкоженные русские лейблы (как в MAX)

export type SidebarTab = 'chats' | 'channels' | 'contacts' | 'calls' | 'settings';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  unreadChats?: number;
  unreadChannels?: number;
}

const TABS: Array<{
  id: SidebarTab;
  label: string;
  icon: typeof MessageSquare;
  position: 'top' | 'bottom';
}> = [
  { id: 'chats', label: 'Все', icon: MessageSquare, position: 'top' },
  { id: 'channels', label: 'Каналы', icon: Hash, position: 'top' },
  { id: 'contacts', label: 'Контакты', icon: Users, position: 'top' },
  { id: 'calls', label: 'Звонки', icon: Phone, position: 'top' },
  { id: 'settings', label: 'Настройки', icon: Settings, position: 'bottom' },
];

export const Sidebar = memo(function Sidebar({
  activeTab,
  onTabChange,
  unreadChats = 0,
  unreadChannels = 0,
}: SidebarProps) {
  const topTabs = TABS.filter((t) => t.position === 'top');
  const bottomTabs = TABS.filter((t) => t.position === 'bottom');

  const getBadge = (id: SidebarTab) => {
    if (id === 'chats') return unreadChats;
    if (id === 'channels') return unreadChannels;
    return 0;
  };

  const renderTab = ({ id, label, icon: Icon }: (typeof TABS)[0]) => {
    const isActive = activeTab === id;
    const badge = getBadge(id);

    return (
      <button
        key={id}
        onClick={() => onTabChange(id)}
        className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-colors w-full"
        style={{
          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
        }}
        role="tab"
        aria-selected={isActive}
        aria-label={label}
      >
        <div className="relative">
          <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
          {badge > 0 && (
            <span
              className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
              style={{ background: '#5B5FC7' }}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span className="text-[10px] leading-tight">{label}</span>
      </button>
    );
  };

  return (
    <nav
      className="flex flex-col items-center justify-between py-3 px-1 h-full flex-shrink-0"
      style={{
        width: '68px',
        background: '#16161a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
      role="tablist"
      aria-label="Навигация"
    >
      {/* Верхние табы */}
      <div className="flex flex-col items-center gap-1 w-full">
        {topTabs.map(renderTab)}
      </div>

      {/* Нижние табы (Настройки) */}
      <div className="flex flex-col items-center gap-1 w-full">
        {bottomTabs.map(renderTab)}
      </div>
    </nav>
  );
});
