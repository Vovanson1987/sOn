/**
 * P2.11: Горизонтальная полоса stories над списком чатов.
 * Показывает аватарки пользователей у которых есть активные stories.
 * Непросмотренные — с голубой рамкой, просмотренные — серой.
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { getStories, viewStory } from '@/api/client';
import { useAuthStore } from '@stores/authStore';

interface StoryUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  stories: Array<{ id: string; media_url: string; media_type: string; caption: string | null; created_at: string }>;
  has_unviewed: boolean;
}

interface StoriesBarProps {
  onAddStory?: () => void;
  onViewStory?: (userId: string, stories: StoryUser['stories']) => void;
}

export const StoriesBar = memo(function StoriesBar({ onAddStory, onViewStory }: StoriesBarProps) {
  const [users, setUsers] = useState<StoryUser[]>([]);
  const myId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    let cancelled = false;
    getStories()
      .then((data) => {
        if (!cancelled) setUsers(data.users as unknown as StoryUser[]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleTap = useCallback((user: StoryUser) => {
    // Отметить все непросмотренные как viewed
    for (const story of user.stories) {
      viewStory(story.id).catch(() => {});
    }
    onViewStory?.(user.user_id, user.stories);
  }, [onViewStory]);

  if (users.length === 0) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 overflow-x-auto"
      style={{ borderBottom: '0.5px solid #38383A', scrollbarWidth: 'none' }}
    >
      {/* Кнопка добавить story */}
      <button
        onClick={onAddStory}
        className="flex flex-col items-center gap-1 flex-shrink-0"
      >
        <div
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
          style={{ background: '#2C2C2E', border: '2px dashed #48484A' }}
        >
          <Plus size={20} className="text-white/50" />
        </div>
        <span className="text-[11px] text-white/50 w-[60px] text-center truncate">
          Добавить
        </span>
      </button>

      {/* Список пользователей со stories */}
      {users.map((user) => {
        const isOwn = user.user_id === myId;
        return (
          <button
            key={user.user_id}
            onClick={() => handleTap(user)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div
              className="w-[56px] h-[56px] rounded-full p-[2px]"
              style={{
                background: user.has_unviewed
                  ? 'linear-gradient(135deg, #5B5FC7, #5856D6)'
                  : '#48484A',
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden" style={{ background: '#000', padding: '1px' }}>
                <Avatar size={48} name={user.display_name} src={user.avatar_url ?? undefined} />
              </div>
            </div>
            <span className="text-[11px] text-white/70 w-[60px] text-center truncate">
              {isOwn ? 'Моя история' : user.display_name}
            </span>
          </button>
        );
      })}
    </div>
  );
});
