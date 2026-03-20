import { memo } from 'react';
import { FileText } from 'lucide-react';

interface FileAttachmentProps {
  fileName: string;
  fileSize: number;
}

/** Форматирование размера файла */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Карточка файла-вложения */
export const FileAttachment = memo(function FileAttachment({ fileName, fileSize }: FileAttachmentProps) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-[10px] rounded-[12px] min-w-[200px]"
      style={{ background: '#1C1C1E' }}
    >
      <div
        className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center flex-shrink-0"
        style={{ background: '#38383A' }}
      >
        <FileText size={20} color="#8E8E93" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-white truncate">{fileName}</p>
        <p className="text-[12px]" style={{ color: '#ABABAF' }}>{formatSize(fileSize)}</p>
      </div>
    </div>
  );
});
