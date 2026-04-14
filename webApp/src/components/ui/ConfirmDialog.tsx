/**
 * ConfirmDialog — модалка подтверждения в стилистике MAX, замена window.confirm.
 *
 * Использование через императивный API:
 *   import { confirm } from '@components/ui/ConfirmDialog';
 *   const ok = await confirm({ title: 'Удалить чат?', danger: true });
 *
 * В корне приложения подключить <ConfirmHost /> один раз.
 */
/* eslint-disable react-refresh/only-export-components */

import { useEffect, useSyncExternalStore } from 'react';
import { Button } from './Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger — красная кнопка (удаление) */
  danger?: boolean;
}

interface OpenConfirm extends ConfirmOptions {
  id: string;
  resolve: (v: boolean) => void;
}

// ---------- store ----------

type Listener = () => void;

class ConfirmStore {
  private current: OpenConfirm | null = null;
  private listeners = new Set<Listener>();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };
  getSnapshot = () => this.current;

  open(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      // Если уже открыт — отклоняем предыдущий
      if (this.current) this.current.resolve(false);
      this.current = {
        ...options,
        id: `c_${Date.now()}`,
        resolve,
      };
      this.emit();
    });
  }

  resolve(value: boolean) {
    if (!this.current) return;
    const cur = this.current;
    this.current = null;
    cur.resolve(value);
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

const store = new ConfirmStore();

export const confirm = (options: ConfirmOptions) => store.open(options);

// ---------- host ----------

export function ConfirmHost() {
  const current = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const trapRef = useFocusTrap(!!current);

  // Закрывать по Escape
  useEffect(() => {
    if (!current) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.resolve(false);
      if (e.key === 'Enter') store.resolve(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current]);

  if (!current) return null;

  const {
    title,
    description,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    danger,
  } = current;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="son-confirm-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,16,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16,
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={() => store.resolve(false)}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'springBounce 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <h3
          id="son-confirm-title"
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.3,
            marginBottom: description ? 8 : 20,
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.45,
              marginBottom: 20,
            }}
          >
            {description}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="ghost" onClick={() => store.resolve(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => store.resolve(true)}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
