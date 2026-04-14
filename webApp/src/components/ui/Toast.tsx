/**
 * Toast — лёгкая система нотификаций без внешних зависимостей.
 *
 * Использование:
 *   import { toast } from '@components/ui/Toast';
 *   toast.success('Сообщение отправлено');
 *   toast.error('Нет соединения');
 *   toast.info('Файл скопирован');
 *
 * В корне приложения подключить <ToastHost /> один раз.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

// ---------- Store (минимальный, без Zustand зависимости) ----------

type Listener = () => void;

class ToastStore {
  private items: ToastItem[] = [];
  private listeners: Set<Listener> = new Set();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };
  getSnapshot = () => this.items;

  push = (type: ToastType, message: string, duration = 3500) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: ToastItem = { id, type, message, duration };
    this.items = [...this.items, item];
    this.emit();
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  };

  dismiss = (id: string) => {
    this.items = this.items.filter((t) => t.id !== id);
    this.emit();
  };

  private emit() {
    for (const l of this.listeners) l();
  }
}

const store = new ToastStore();

export const toast = {
  success: (msg: string, duration?: number) => store.push('success', msg, duration),
  error: (msg: string, duration?: number) => store.push('error', msg, duration ?? 5000),
  info: (msg: string, duration?: number) => store.push('info', msg, duration),
  dismiss: (id: string) => store.dismiss(id),
};

// ---------- Host ----------

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
};

const COLORS: Record<ToastType, { bg: string; color: string; icon: string }> = {
  success: { bg: 'rgba(48,209,88,0.15)', color: '#fff', icon: '#30D158' },
  error: { bg: 'rgba(255,69,58,0.15)', color: '#fff', icon: '#FF453A' },
  info: { bg: 'rgba(91,95,199,0.15)', color: '#fff', icon: '#5B5FC7' },
};

export function ToastHost() {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
        padding: '0 16px',
      }}
    >
      {items.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastRow({ toast: t }: { toast: ToastItem }) {
  const c = COLORS[t.type];
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="status"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 240,
        maxWidth: 480,
        padding: '10px 14px',
        background: 'rgba(30,30,46,0.96)',
        backdropFilter: 'saturate(180%) blur(14px)',
        WebkitBackdropFilter: 'saturate(180%) blur(14px)',
        border: `1px solid ${c.bg}`,
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        color: c.color,
        fontSize: 14,
        lineHeight: 1.35,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease',
      }}
    >
      <span style={{ color: c.icon, flexShrink: 0, display: 'inline-flex' }}>
        {ICONS[t.type]}
      </span>
      <span style={{ flex: 1 }}>{t.message}</span>
      <button
        onClick={() => store.dismiss(t.id)}
        aria-label="Закрыть"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.45)',
          cursor: 'pointer',
          padding: 2,
          display: 'inline-flex',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
