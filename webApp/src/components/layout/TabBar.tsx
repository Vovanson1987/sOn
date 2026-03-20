import { MessageSquare, Phone, Users, Settings } from 'lucide-react';

export type TabId = 'chats' | 'calls' | 'contacts' | 'settings';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  unreadChats?: number;
  missedCalls?: number;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof MessageSquare }> = [
  { id: 'chats', label: 'Чаты', icon: MessageSquare },
  { id: 'calls', label: 'Звонки', icon: Phone },
  { id: 'contacts', label: 'Контакты', icon: Users },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

/** Нижний Tab Bar в стиле iOS (мобильная версия) */
export function TabBar({ activeTab, onTabChange, unreadChats = 0, missedCalls = 0 }: TabBarProps) {
  return (
    <nav
      className="flex items-center justify-around border-t"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderColor: '#38383A',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingTop: '6px',
      }}
      role="tablist"
      aria-label="Навигация"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        const badge = id === 'chats' ? unreadChats : id === 'calls' ? missedCalls : 0;

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-label={badge > 0 ? `${label}, ${badge} непрочитанных` : label}
            onClick={() => onTabChange(id)}
            className="flex flex-col items-center gap-[2px] relative min-w-[64px]"
          >
            <div className="relative">
              <Icon size={24} color={isActive ? '#007AFF' : '#8E8E93'} />
              {badge > 0 && (
                <div
                  className="absolute -top-[4px] -right-[8px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-[4px]"
                  style={{ background: '#FF453A' }}
                >
                  <span className="text-[11px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
                </div>
              )}
            </div>
            <span
              className="text-[10px]"
              style={{ color: isActive ? '#007AFF' : '#ABABAF' }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
