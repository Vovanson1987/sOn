/**
 * Skeleton — shimmer-плейсхолдеры для загрузки контента.
 * Варианты: прямоугольник, круг, текстовая строка, ChatListItem row.
 */

import { memo, useState, type CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const Skeleton = memo(function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  circle = false,
  className = '',
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`son-skeleton ${className}`}
      style={{
        display: 'inline-block',
        width,
        height: circle ? width : height,
        borderRadius: circle ? '50%' : radius,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        animation: 'sonSkeletonShimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
});

/** Skeleton-ряд для списка чатов (72px, совпадает с ChatListItem) */
export const ChatListItemSkeleton = memo(function ChatListItemSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{ height: 72 }}
      aria-hidden="true"
    >
      <Skeleton circle width={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <Skeleton width="40%" height={14} />
          <Skeleton width={36} height={11} />
        </div>
        <div className="mt-2">
          <Skeleton width="70%" height={12} />
        </div>
      </div>
    </div>
  );
});

export const MessageBubbleSkeleton = memo(function MessageBubbleSkeleton({
  outgoing = false,
}: { outgoing?: boolean }) {
  // Фиксируем ширину пузыря один раз на маунт, чтобы не ломать чистоту рендера.
  const [width] = useState(() => 180 + Math.random() * 140);
  return (
    <div
      className="px-4 py-1.5 flex"
      style={{ justifyContent: outgoing ? 'flex-end' : 'flex-start' }}
      aria-hidden="true"
    >
      <Skeleton
        width={width}
        height={36}
        radius={18}
        style={{
          background: outgoing
            ? 'linear-gradient(90deg, rgba(91,95,199,0.25), rgba(91,95,199,0.15), rgba(91,95,199,0.25))'
            : undefined,
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
});
