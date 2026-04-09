/**
 * Хук для отслеживания загрузки изображения (из паттернов MAX).
 * Предзагружает картинку через Image() и отдаёт статус: idle → loading → loaded/error.
 * Используется в Avatar для fallback на инициалы при ошибке загрузки.
 */

import { useState, useEffect, useRef } from 'react';

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export function useImageLoadingStatus(
  src: string | undefined | null,
  referrerPolicy?: ReferrerPolicy,
): ImageLoadingStatus {
  const [status, setStatus] = useState<ImageLoadingStatus>('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!src) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    const img = new Image();

    if (referrerPolicy) {
      img.referrerPolicy = referrerPolicy;
    }

    img.onload = () => {
      if (mountedRef.current) setStatus('loaded');
    };

    img.onerror = () => {
      if (mountedRef.current) setStatus('error');
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, referrerPolicy]);

  return status;
}
