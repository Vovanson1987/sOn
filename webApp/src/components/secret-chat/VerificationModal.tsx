import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { useFocusTrap } from '@hooks/useFocusTrap';

interface VerificationModalProps {
  myName: string;
  theirName: string;
  emojiGrid: string[][];
  hexFingerprint: string;
  isVerified: boolean;
  onVerify: () => void;
  onClose: () => void;
}

/** Модальное окно верификации ключей (эмодзи 4×4 + hex fingerprint) */
export function VerificationModal({
  myName,
  theirName,
  emojiGrid,
  hexFingerprint,
  isVerified,
  onVerify,
  onClose,
}: VerificationModalProps) {
  const focusTrapRef = useFocusTrap();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Верификация шифрования"
    >
      <div
        className="rounded-[16px] p-6 max-w-[400px] w-full mx-4"
        style={{ background: '#1C1C1E' }}
      >
        {/* Заголовок + закрыть */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold text-white">Верификация шифрования</h2>
          <button onClick={onClose} aria-label="Закрыть" className="min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} color="#8E8E93" />
          </button>
        </div>

        {/* Два аватара */}
        <div className="flex items-center justify-center gap-6 mb-5">
          <div className="flex flex-col items-center">
            <Avatar size={50} name={myName} />
            <span className="text-[12px] text-white mt-1">Вы</span>
          </div>
          <div className="w-[40px] h-[1px]" style={{ background: '#38383A' }} />
          <div className="flex flex-col items-center">
            <Avatar size={50} name={theirName} />
            <span className="text-[12px] text-white mt-1">{theirName}</span>
          </div>
        </div>

        {/* Эмодзи-сетка 4×4 */}
        <div
          className="flex flex-col items-center gap-2 mb-5"
          role="img"
          aria-label="Сетка эмодзи 4 на 4 для визуальной верификации ключей шифрования"
        >
          {emojiGrid.map((row, i) => (
            <div key={i} className="flex gap-3">
              {row.map((emoji, j) => (
                <span key={j} className="text-[28px]">{emoji}</span>
              ))}
            </div>
          ))}
        </div>

        {/* Hex fingerprint */}
        <div
          className="rounded-[8px] p-3 mb-4 select-all cursor-text"
          style={{ background: '#2C2C2E' }}
        >
          <p
            className="text-[12px] text-center break-all leading-[1.6]"
            style={{ color: '#ABABAF', fontFamily: 'var(--font-family-mono)' }}
          >
            {hexFingerprint}
          </p>
        </div>

        {/* Описание */}
        <p className="text-[12px] text-center mb-4" style={{ color: '#ABABAF' }}>
          Сравните эти символы на устройствах обоих собеседников. Если они совпадают — канал защищён.
        </p>

        {/* Кнопка верификации */}
        {isVerified ? (
          <div
            className="w-full py-[12px] rounded-[10px] text-center text-[16px] font-semibold"
            style={{ background: '#2C2C2E', color: '#30D158' }}
          >
            ✓ Верификация подтверждена
          </div>
        ) : (
          <button
            onClick={onVerify}
            className="w-full py-[12px] rounded-[10px] text-center text-[16px] font-semibold text-white"
            style={{ background: '#30D158' }}
          >
            ✓ Подтвердить верификацию
          </button>
        )}
      </div>
    </div>
  );
}
