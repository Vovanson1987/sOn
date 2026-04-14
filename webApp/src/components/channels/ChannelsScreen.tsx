/**
 * P2.7: Экран каналов — список подписок + создание нового канала.
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { Plus, Hash, Users, ChevronRight } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { getChannels, createChannel } from '@/api/client';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  subscriber_count: number;
  role: string;
}

interface ChannelsScreenProps {
  onSelectChannel?: (channelId: string) => void;
}

export const ChannelsScreen = memo(function ChannelsScreen({ onSelectChannel }: ChannelsScreenProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await getChannels();
      setChannels(data.channels as unknown as Channel[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await createChannel(newName.trim());
      setNewName('');
      setShowCreate(false);
      fetchChannels();
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#000' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid #38383A' }}>
        <h1 className="text-[22px] font-bold text-white">Каналы</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-[36px] h-[36px] rounded-full flex items-center justify-center"
          style={{ background: '#5B5FC7' }}
        >
          <Plus size={18} color="white" />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#1C1C1E', borderBottom: '0.5px solid #38383A' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название канала"
            className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder-white/30"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="text-[15px] font-medium"
            style={{ color: newName.trim() ? '#5B5FC7' : '#48484A' }}
          >
            Создать
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-white/30 text-[14px]">
            Загрузка...
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
            <Hash size={40} className="text-white/20" />
            <p className="text-[17px] font-semibold text-white">Нет каналов</p>
            <p className="text-[14px] text-white/50 text-center">
              Создайте канал или подпишитесь на существующий
            </p>
          </div>
        ) : (
          channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelectChannel?.(ch.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
            >
              <Avatar size={44} name={ch.name} src={ch.avatar_url ?? undefined} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Hash size={14} className="text-white/40 flex-shrink-0" />
                  <span className="text-[16px] font-medium text-white truncate">{ch.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Users size={12} className="text-white/30" />
                  <span className="text-[13px] text-white/40">
                    {ch.subscriber_count} подписчик{ch.subscriber_count === 1 ? '' : ch.subscriber_count < 5 ? 'а' : 'ов'}
                  </span>
                  {ch.role === 'owner' && <span className="text-[11px] text-blue-400 ml-1">владелец</span>}
                  {ch.role === 'admin' && <span className="text-[11px] text-green-400 ml-1">админ</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
});
