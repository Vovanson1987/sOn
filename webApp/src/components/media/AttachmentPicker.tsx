import { useEffect } from 'react';
import { Camera, Image, FileText, MapPin } from 'lucide-react';
import { useFocusTrap } from '@hooks/useFocusTrap';

interface AttachmentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'camera' | 'photo' | 'document' | 'location') => void;
}

const ITEMS = [
  { type: 'camera' as const, icon: Camera, label: 'Камера', color: '#FF9500' },
  { type: 'photo' as const, icon: Image, label: 'Фото и видео', color: '#007AFF' },
  { type: 'document' as const, icon: FileText, label: 'Документ', color: '#8E8E93' },
  { type: 'location' as const, icon: MapPin, label: 'Геолокация', color: '#30D158' },
];

/** iOS Action Sheet для выбора типа вложения */
export function AttachmentPicker({ isOpen, onClose, onSelect }: AttachmentPickerProps) {
  const focusTrapRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор вложения"
    >
      {/* Затемнение */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />

      {/* Action Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[12px] overflow-hidden"
        style={{ background: '#1C1C1E' }}
        onClick={(e) => e.stopPropagation()}
      >
        {ITEMS.map((item, i) => (
          <div key={item.type}>
            {i > 0 && <div style={{ height: '0.5px', background: '#38383A', marginLeft: '56px' }} />}
            <button
              onClick={() => { onSelect(item.type); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-[12px] text-left hover:bg-[#2C2C2E]"
            >
              <div
                className="w-[44px] h-[44px] rounded-[8px] flex items-center justify-center"
                style={{ background: item.color }}
              >
                <item.icon size={18} color="white" />
              </div>
              <span className="text-[16px] text-white">{item.label}</span>
            </button>
          </div>
        ))}

        {/* Кнопка отмены */}
        <div style={{ height: '6px', background: '#000' }} />
        <button
          onClick={onClose}
          className="w-full py-[14px] text-center text-[16px] font-semibold"
          style={{ background: '#1C1C1E', color: '#007AFF' }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
