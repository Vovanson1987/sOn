/**
 * P2.8: Picker стикеров — показывает добавленные паки и стикеры.
 * При выборе стикера вызывает onSelect с file_url и id.
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { X, Loader2, Package } from 'lucide-react';
import { getMyStickerPacks, getStickers } from '@/api/client';

interface StickerItem {
  id: string;
  emoji: string;
  file_url: string;
  file_type: string;
}

interface StickerPack {
  id: string;
  name: string;
  cover_url: string | null;
  sticker_count: number;
}

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sticker: { id: string; file_url: string; emoji: string }) => void;
}

export const StickerPicker = memo(function StickerPicker({ isOpen, onClose, onSelect }: StickerPickerProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getMyStickerPacks()
      .then((data) => {
        const p = data.packs as unknown as StickerPack[];
        setPacks(p);
        if (p.length > 0 && !activePackId) setActivePackId(p[0].id);
      })
      .catch(() => {});
  }, [isOpen, activePackId]);

  const loadStickers = useCallback(async (packId: string) => {
    setLoading(true);
    setActivePackId(packId);
    try {
      const data = await getStickers(packId);
      setStickers(data.stickers);
    } catch {
      setStickers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePackId) loadStickers(activePackId);
  }, [activePackId, loadStickers]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 rounded-t-xl overflow-hidden shadow-lg z-50"
      style={{ background: '#2C2C2E', border: '0.5px solid rgba(255,255,255,0.1)', maxHeight: '300px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '0.5px solid #38383A' }}>
        <span className="text-[13px] font-medium text-white/70">Стикеры</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Pack tabs */}
      {packs.length > 0 && (
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto" style={{ borderBottom: '0.5px solid #38383A', scrollbarWidth: 'none' }}>
          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setActivePackId(pack.id)}
              className="px-2.5 py-1 rounded-lg text-[12px] whitespace-nowrap flex-shrink-0"
              style={{
                background: activePackId === pack.id ? 'rgba(0,122,255,0.2)' : 'transparent',
                color: activePackId === pack.id ? '#5B5FC7' : 'rgba(255,255,255,0.5)',
              }}
            >
              {pack.name}
            </button>
          ))}
        </div>
      )}

      {/* Stickers grid */}
      <div className="p-2 overflow-y-auto" style={{ maxHeight: '220px' }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-white/30" />
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Package size={24} className="text-white/20" />
            <p className="text-[13px] text-white/40">Нет добавленных паков</p>
          </div>
        ) : stickers.length === 0 ? (
          <p className="text-center text-[13px] text-white/30 py-4">Пустой пак</p>
        ) : (
          <div className="grid grid-cols-5 gap-1.5">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => { onSelect(sticker); onClose(); }}
                className="aspect-square rounded-lg overflow-hidden hover:bg-white/10 transition-colors p-1"
              >
                <img
                  src={sticker.file_url}
                  alt={sticker.emoji || 'sticker'}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
