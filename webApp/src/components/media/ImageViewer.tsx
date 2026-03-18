import { X } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Полноэкранный просмотр изображения с затемнением */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
      role="dialog"
      aria-label="Просмотр изображения"
    >
      <button
        className="absolute top-4 right-4 w-[32px] h-[32px] rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.2)' }}
        onClick={onClose}
        aria-label="Закрыть"
      >
        <X size={20} color="white" />
      </button>

      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] rounded-[8px] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
