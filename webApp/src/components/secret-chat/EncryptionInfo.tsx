import { Shield, Key, RefreshCw, Trash2 } from 'lucide-react';

interface EncryptionInfoProps {
  protocol: string;
  algorithms: string;
  sessionDate: string;
  ratchetIndex: number;
  isVerified: boolean;
  onVerify: () => void;
  onRegenerateKeys: () => void;
  onEndSecretChat: () => void;
  onClose: () => void;
}

/** Info-панель секретного чата с информацией о шифровании */
export function EncryptionInfo({
  protocol,
  algorithms,
  sessionDate,
  ratchetIndex,
  isVerified,
  onVerify,
  onRegenerateKeys,
  onEndSecretChat,
  onClose,
}: EncryptionInfoProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
      role="dialog"
      aria-label="Информация о шифровании"
    >
      <div
        className="rounded-[16px] p-5 max-w-[360px] w-full mx-4"
        style={{ background: '#1C1C1E' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} color="#34C759" />
          <h2 className="text-[17px] font-semibold text-white">Шифрование</h2>
        </div>

        {/* Параметры */}
        <div className="space-y-3 mb-5">
          <div className="flex justify-between">
            <span className="text-[13px]" style={{ color: '#8E8E93' }}>Протокол</span>
            <span className="text-[13px] text-white">{protocol}</span>
          </div>
          <div style={{ height: '0.5px', background: '#38383A' }} />
          <div className="flex justify-between">
            <span className="text-[13px]" style={{ color: '#8E8E93' }}>Алгоритмы</span>
            <span className="text-[13px] text-white text-right max-w-[200px]">{algorithms}</span>
          </div>
          <div style={{ height: '0.5px', background: '#38383A' }} />
          <div className="flex justify-between">
            <span className="text-[13px]" style={{ color: '#8E8E93' }}>Сессия создана</span>
            <span className="text-[13px] text-white">{sessionDate}</span>
          </div>
          <div style={{ height: '0.5px', background: '#38383A' }} />
          <div className="flex justify-between">
            <span className="text-[13px]" style={{ color: '#8E8E93' }}>Ratchet index</span>
            <span className="text-[13px] text-white">#{ratchetIndex}</span>
          </div>
          <div style={{ height: '0.5px', background: '#38383A' }} />
          <div className="flex justify-between">
            <span className="text-[13px]" style={{ color: '#8E8E93' }}>Верификация</span>
            <span className="text-[13px]" style={{ color: isVerified ? '#34C759' : '#FF9500' }}>
              {isVerified ? '✓ Подтверждено' : '⚠ Не верифицировано'}
            </span>
          </div>
        </div>

        {/* Действия */}
        <div className="space-y-2">
          {!isVerified && (
            <button
              onClick={onVerify}
              className="w-full flex items-center gap-3 px-4 py-[10px] rounded-[10px]"
              style={{ background: '#2C2C2E' }}
            >
              <Key size={18} color="#007AFF" />
              <span className="text-[15px]" style={{ color: '#007AFF' }}>Верифицировать ключи</span>
            </button>
          )}

          <button
            onClick={onRegenerateKeys}
            className="w-full flex items-center gap-3 px-4 py-[10px] rounded-[10px]"
            style={{ background: '#2C2C2E' }}
          >
            <RefreshCw size={18} color="#8E8E93" />
            <span className="text-[15px] text-white">Пересоздать ключи</span>
          </button>

          <button
            onClick={onEndSecretChat}
            className="w-full flex items-center gap-3 px-4 py-[10px] rounded-[10px]"
            style={{ background: '#2C2C2E' }}
          >
            <Trash2 size={18} color="#FF3B30" />
            <span className="text-[15px]" style={{ color: '#FF3B30' }}>Завершить секретный чат</span>
          </button>
        </div>
      </div>
    </div>
  );
}
