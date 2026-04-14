/**
 * useSwipeAction — минимальный touch-свайп влево для раскрытия action-кнопок.
 * Подходит для ChatListItem в мобильной версии (iOS-style).
 *
 * Использование:
 *   const { handlers, offset, isOpen, reset } = useSwipeAction({
 *     threshold: 64,   // порог открытия
 *     maxOffset: 88,   // ширина экшен-зоны
 *   });
 *   <div {...handlers} style={{ transform: `translateX(${-offset}px)` }}>…</div>
 */

import { useCallback, useRef, useState } from 'react';

interface Options {
  /** Порог в px, после которого swipe фиксируется в открытом состоянии */
  threshold?: number;
  /** Максимальное смещение */
  maxOffset?: number;
  /** Колбек когда пользователь открыл панель */
  onOpen?: () => void;
  /** Отключить (например, на десктопе) */
  disabled?: boolean;
}

export function useSwipeAction({
  threshold = 64,
  maxOffset = 88,
  onOpen,
  disabled = false,
}: Options = {}) {
  const [offset, setOffset] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);

  const reset = useCallback(() => {
    setOffset(0);
    setOpen(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      isHorizontal.current = null;
    },
    [disabled],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      if (startX.current === null || startY.current === null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      // Определить направление первого жеста
      if (isHorizontal.current === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        }
      }
      if (!isHorizontal.current) return;

      // Разрешаем только swipe влево (dx < 0)
      const base = isOpen ? -maxOffset : 0;
      const next = Math.max(-maxOffset, Math.min(0, base + dx));
      setOffset(-next);
    },
    [disabled, isOpen, maxOffset],
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    startX.current = null;
    startY.current = null;
    if (offset >= threshold) {
      setOffset(maxOffset);
      if (!isOpen) onOpen?.();
      setOpen(true);
    } else {
      setOffset(0);
      setOpen(false);
    }
    isHorizontal.current = null;
  }, [disabled, offset, threshold, maxOffset, isOpen, onOpen]);

  return {
    offset,
    isOpen,
    reset,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  };
}
