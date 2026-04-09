/**
 * EllipsisText — обрезка текста с ellipsis (паттерн из MAX).
 * Поддерживает одну строку (text-overflow: ellipsis) и многострочный (-webkit-line-clamp).
 */

import { memo, type CSSProperties, type ReactNode } from 'react';

interface EllipsisTextProps {
  children: ReactNode;
  /** Максимум строк. 1 = однострочный ellipsis, >1 = line-clamp */
  maxLines?: number;
  className?: string;
  style?: CSSProperties;
  as?: 'span' | 'p' | 'div';
}

export const EllipsisText = memo(function EllipsisText({
  children,
  maxLines = 1,
  className = '',
  style,
  as: Tag = 'span',
}: EllipsisTextProps) {
  const ellipsisStyle: CSSProperties =
    maxLines === 1
      ? {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
          ...style,
        }
      : {
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical' as const,
          ...style,
        };

  return (
    <Tag className={className} style={ellipsisStyle}>
      {children}
    </Tag>
  );
});
