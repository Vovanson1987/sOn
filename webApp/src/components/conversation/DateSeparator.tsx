import { memo } from 'react';
import { formatDateSeparator } from '@utils/dateFormat';

interface DateSeparatorProps {
  date: string;
}

/** Разделитель дат между группами сообщений (стиль iOS Messages) */
export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex justify-center py-2" role="separator">
      <span
        className="text-[12px] font-medium px-3 py-[2px] rounded-full"
        style={{ color: '#ABABAF', background: 'rgba(255, 255, 255, 0.08)' }}
      >
        {formatDateSeparator(date)}
      </span>
    </div>
  );
});
