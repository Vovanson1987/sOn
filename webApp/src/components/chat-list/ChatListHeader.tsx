import { SlidersHorizontal, SquarePen } from 'lucide-react';
import { FrostedGlassBar } from '@components/ui/FrostedGlassBar';
import { t } from '@/i18n';

interface ChatListHeaderProps {
  onNewChat?: () => void;
  onFilter?: () => void;
  filterActive?: boolean;
}

export function ChatListHeader({ onNewChat, onFilter, filterActive }: ChatListHeaderProps) {
  return (
    <FrostedGlassBar className="px-4 pt-2 pb-0">
      <div className="flex items-end justify-between pb-2">
        <h1 className="text-[34px] font-bold text-white leading-none">
          {t('nav.chats')}
        </h1>
        <div className="flex items-center gap-1 pb-1">
          <button
            className="w-[44px] h-[44px] flex items-center justify-center"
            style={{ color: filterActive ? '#007AFF' : '#ABABAF' }}
            aria-label="Фильтр"
            aria-pressed={filterActive ?? false}
            onClick={onFilter}
          >
            <SlidersHorizontal size={20} color={filterActive ? '#007AFF' : '#8E8E93'} />
          </button>
          <button
            className="w-[44px] h-[44px] flex items-center justify-center"
            style={{ color: '#007AFF' }}
            aria-label={t('chatList.newMessage')}
            onClick={onNewChat}
          >
            <SquarePen size={22} color="#007AFF" />
          </button>
        </div>
      </div>
    </FrostedGlassBar>
  );
}
