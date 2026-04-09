/**
 * P2.4: Баннер закреплённого сообщения вверху ConversationScreen.
 */

import { memo } from 'react';
import { Pin, X } from 'lucide-react';

interface PinnedBannerProps {
  content: string;
  senderName?: string;
  onTap: () => void;
  onUnpin?: () => void;
  canUnpin: boolean;
}

export const PinnedBanner = memo(function PinnedBanner({
  content,
  senderName,
  onTap,
  onUnpin,
  canUnpin,
}: PinnedBannerProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 cursor-pointer"
      style={{
        background: '#1C1C1E',
        borderBottom: '0.5px solid #38383A',
      }}
      onClick={onTap}
    >
      <Pin size={14} className="text-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {senderName && (
          <p className="text-[11px] font-medium text-blue-400">{senderName}</p>
        )}
        <p className="text-[13px] text-white/70 truncate">{content}</p>
      </div>
      {canUnpin && onUnpin && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          className="p-1 rounded-full hover:bg-white/10 flex-shrink-0"
        >
          <X size={14} className="text-white/40" />
        </button>
      )}
    </div>
  );
});
