import { memo } from 'react';
import { formatDateSeparator } from '@utils/dateFormat';

interface DateSeparatorProps {
  date: string;
}

/** Разделитель дат между группами сообщений (стиль iOS Messages) */
export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex justify-center py-2">
      <span
        className="text-[12px] font-medium px-3 py-[2px] rounded-full"
        style={{ color: '#8E8E93' }}
      >
        {formatDateSeparator(date)}
      </span>
    </div>
  );
});
