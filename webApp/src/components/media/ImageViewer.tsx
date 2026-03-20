import { useEffect, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useFocusTrap } from '@hooks/useFocusTrap';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Полноэкранный просмотр изображения с затемнением и зумом */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const focusTrapRef = useFocusTrap();
  const [scale, setScale] = useState(1);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s * 1.5, 5)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s / 1.5, 1)), []);
  const resetZoom = useCallback(() => setScale(1), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, zoomIn, zoomOut, resetZoom]);

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
    >
      <div className="absolute right-4 flex gap-2" style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
        <button
          className="w-[44px] h-[44px] rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          aria-label="Уменьшить"
          disabled={scale <= 1}
        >
          <ZoomOut size={20} color="white" />
        </button>
        <button
          className="w-[44px] h-[44px] rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          aria-label="Увеличить"
          disabled={scale >= 5}
        >
          <ZoomIn size={20} color="white" />
        </button>
        <button
          className="w-[44px] h-[44px] rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Закрыть"
        >
          <X size={20} color="white" />
        </button>
      </div>

      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.2s ease',
          cursor: scale > 1 ? 'zoom-out' : 'zoom-in',
        }}
        onClick={(e) => { e.stopPropagation(); if (scale > 1) { resetZoom(); } else { zoomIn(); } }}
        onDoubleClick={(e) => { e.stopPropagation(); if (scale > 1) { resetZoom(); } else { zoomIn(); } }}
      />
    </div>
  );
}
