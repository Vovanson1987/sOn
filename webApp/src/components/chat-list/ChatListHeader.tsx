import { SlidersHorizontal, SquarePen } from 'lucide-react';
import { FrostedGlassBar } from '@components/ui/FrostedGlassBar';

export function ChatListHeader() {
  return (
    <FrostedGlassBar className="px-3 pt-2 pb-0">
      <div className="flex items-center justify-between">
        <button
          className="w-[28px] h-[28px] flex items-center justify-center"
          aria-label="Фильтр"
        >
          <SlidersHorizontal size={18} color="#8E8E93" />
        </button>
        <button
          className="w-[28px] h-[28px] flex items-center justify-center"
          style={{ color: '#007AFF' }}
          aria-label="Новое сообщение"
        >
          <SquarePen size={20} color="#007AFF" />
        </button>
      </div>
    </FrostedGlassBar>
  );
}
