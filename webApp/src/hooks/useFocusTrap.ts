import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap для модальных окон.
 * Tab/Shift+Tab зацикливаются внутри ref-контейнера.
 * При открытии фокус ставится на первый элемент.
 * При закрытии фокус восстанавливается на предыдущий элемент.
 */
export function useFocusTrap(isOpen = true) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // Фокус на первый элемент внутри
    const timer = setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 50);

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;

      const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handler);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  return ref;
}
