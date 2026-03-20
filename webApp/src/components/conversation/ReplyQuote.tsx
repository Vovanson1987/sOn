import { X } from 'lucide-react';

interface ReplyQuoteProps {
  senderName: string;
  preview: string;
  onCancel: () => void;
}

/** Цитата над полем ввода при ответе на сообщение */
export function ReplyQuote({ senderName, preview, onCancel }: ReplyQuoteProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-t"
      style={{ borderColor: '#38383A', background: '#1C1C1E' }}
    >
      {/* Серая вертикальная полоска */}
      <div className="w-[3px] h-[32px] rounded-full flex-shrink-0" style={{ background: '#007AFF' }} />

      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-semibold block" style={{ color: '#007AFF' }}>
          {senderName}
        </span>
        <span className="text-[13px] block truncate" style={{ color: '#ABABAF' }}>
          {preview}
        </span>
      </div>

      <button
        onClick={onCancel}
        className="flex-shrink-0 w-[24px] h-[24px] rounded-full flex items-center justify-center"
        style={{ background: '#38383A' }}
        aria-label="Отменить ответ"
      >
        <X size={14} color="#8E8E93" />
      </button>
    </div>
  );
}
