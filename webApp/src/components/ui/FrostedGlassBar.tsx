import type { ReactNode } from 'react';

interface FrostedGlassBarProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'header' | 'div' | 'nav';
}

export function FrostedGlassBar({ children, className = '', style, as: Tag = 'div' }: FrostedGlassBarProps) {
  return (
    <Tag
      className={`sticky top-0 z-30 ${className}`}
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.1)',
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
