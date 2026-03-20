import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Полноэкранный просмотр изображения с затемнением */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => previousFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
    >
      <button
        className="absolute right-4 w-[44px] h-[44px] rounded-full flex items-center justify-center"
        style={{
          top: 'max(16px, env(safe-area-inset-top))',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
        }}
        onClick={onClose}
        aria-label="Закрыть"
      >
        <X size={20} color="white" />
      </button>

      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
