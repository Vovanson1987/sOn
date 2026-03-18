import type { ReactNode } from 'react';

interface FrostedGlassBarProps {
  children: ReactNode;
  className?: string;
}

export function FrostedGlassBar({ children, className = '' }: FrostedGlassBarProps) {
  return (
    <header
      className={`sticky top-0 z-30 ${className}`}
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'var(--header-blur)',
        WebkitBackdropFilter: 'var(--header-blur)',
      }}
    >
      {children}
    </header>
  );
}
