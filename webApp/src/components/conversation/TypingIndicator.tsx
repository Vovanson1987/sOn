import { memo } from 'react';

interface TypingIndicatorProps {
  names?: string[];
}

/** Индикатор "печатает..." — три анимированные точки в сером пузыре */
export const TypingIndicator = memo(function TypingIndicator({ names = [] }: TypingIndicatorProps) {
  const label = names.length === 0
    ? 'Собеседник печатает...'
    : names.length === 1
      ? `${names[0]} печатает...`
      : `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]} печатают...`;

  return (
    <div
      className="flex items-start px-5 mt-1"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className="flex items-center gap-[4px] px-[14px] py-[10px] rounded-[18px]"
        style={{ background: '#3A3A3C' }}
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[7px] h-[7px] rounded-full inline-block"
            style={{
              background: '#8E8E93',
              animation: `typingDots 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
});
