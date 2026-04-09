/**
 * Хук для отслеживания загрузки изображения (из паттернов MAX).
 * Предзагружает картинку через Image() и отдаёт статус: idle → loading → loaded/error.
 * Используется в Avatar для fallback на инициалы при ошибке загрузки.
 */

import { useState, useEffect } from 'react';

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

function deriveInitial(src: string | undefined | null): ImageLoadingStatus {
  return src ? 'loading' : 'idle';
}

export function useImageLoadingStatus(
  src: string | undefined | null,
  referrerPolicy?: ReferrerPolicy,
): ImageLoadingStatus {
  // Состояние инициализируется синхронно при изменении src (без effect)
  const [status, setStatus] = useState<ImageLoadingStatus>(() => deriveInitial(src));

  // Сбрасываем при изменении src — через «derive state from props» паттерн
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus(deriveInitial(src));
  }

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    const img = new Image();
    if (referrerPolicy) img.referrerPolicy = referrerPolicy;

    // setState в callbacks — разрешено ESLint
    img.onload = () => { if (!cancelled) setStatus('loaded'); };
    img.onerror = () => { if (!cancelled) setStatus('error'); };
    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, referrerPolicy]);

  return status;
}
