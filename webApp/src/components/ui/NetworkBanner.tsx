/**
 * NetworkBanner — глобальный баннер состояния сети.
 * Показывается, когда:
 *   — браузер offline (navigator.onLine === false)
 *   — WebSocket в состоянии 'reconnecting' дольше 1.5 сек (чтобы не мигать)
 *
 * Монтируется в App.tsx один раз.
 */

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { onWSStatus, type WSStatus } from '@/api/client';

export function NetworkBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wsStatus, setWsStatus] = useState<WSStatus>('idle');
  const [showReconnect, setShowReconnect] = useState(false);

  // navigator.onLine
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // WS status с debounce: показываем reconnect-баннер только если висит >1.5с
  useEffect(() => onWSStatus(setWsStatus), []);
  useEffect(() => {
    if (wsStatus === 'reconnecting') {
      const t = setTimeout(() => setShowReconnect(true), 1500);
      return () => clearTimeout(t);
    }
    setShowReconnect(false);
  }, [wsStatus]);

  const visible = !online || showReconnect;
  if (!visible) return null;

  const isOffline = !online;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 12px',
        background: isOffline ? '#FF453A' : '#FF9F0A',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      {isOffline ? (
        <>
          <WifiOff size={14} />
          <span>Нет подключения к интернету</span>
        </>
      ) : (
        <>
          <RefreshCw size={14} className="animate-spin" />
          <span>Переподключаемся…</span>
        </>
      )}
    </div>
  );
}
