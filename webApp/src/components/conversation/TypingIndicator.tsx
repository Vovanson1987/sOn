import { memo } from 'react';

/** Индикатор "печатает..." — три анимированные точки в сером пузыре */
export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex items-start px-4 mt-1" style={{ marginLeft: '0px' }}>
      <div
        className="flex items-center gap-[4px] px-[14px] py-[10px] rounded-[18px]"
        style={{ background: '#26252A' }}
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
