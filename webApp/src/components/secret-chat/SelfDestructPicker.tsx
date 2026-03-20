import { useEffect } from 'react';
import { useFocusTrap } from '@hooks/useFocusTrap';

interface SelfDestructPickerProps {
  isOpen: boolean;
  currentValue: number | null;
  onSelect: (seconds: number | null) => void;
  onClose: () => void;
}

const OPTIONS = [
  { label: 'Выкл', value: null },
  { label: '5 сек', value: 5 },
  { label: '15 сек', value: 15 },
  { label: '30 сек', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '5 мин', value: 300 },
  { label: '1 час', value: 3600 },
  { label: '1 день', value: 86400 },
];

/** Picker таймера самоуничтожения (iOS-стиль снизу) */
export function SelfDestructPicker({ isOpen, currentValue, onSelect, onClose }: SelfDestructPickerProps) {
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
      aria-label="Таймер самоуничтожения"
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />

      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[12px] overflow-hidden"
        style={{ background: '#1C1C1E' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: '#38383A' }}>
          <p className="text-[14px] font-semibold text-white text-center">Таймер самоуничтожения</p>
        </div>

        {OPTIONS.map((opt, i) => {
          const isActive = opt.value === currentValue;
          return (
            <div key={i}>
              {i > 0 && <div style={{ height: '0.5px', background: '#38383A', marginLeft: '16px' }} />}
              <button
                onClick={() => { onSelect(opt.value); onClose(); }}
                className="w-full flex items-center justify-between px-4 py-[12px] text-left"
                role="option"
                aria-pressed={isActive}
              >
                <span className="text-[16px] text-white">{opt.label}</span>
                {isActive && <span className="text-[16px]" style={{ color: '#007AFF' }}>✓</span>}
              </button>
            </div>
          );
        })}

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
