/**
 * Базовый Button в стилистике MAX — фиолетовый primary, скруглённые углы 12px,
 * состояния hover/active/disabled/loading. Используется во всех модалках и формах.
 */

import { memo, forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, { bg: string; color: string; hover: string; border?: string }> = {
  primary: { bg: '#5B5FC7', color: '#fff', hover: '#6a6ed2' },
  secondary: {
    bg: 'rgba(255,255,255,0.08)',
    color: '#fff',
    hover: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  ghost: { bg: 'transparent', color: 'rgba(255,255,255,0.8)', hover: 'rgba(255,255,255,0.06)' },
  danger: { bg: '#FF453A', color: '#fff', hover: '#ff5c52' },
};

const SIZES: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 32, px: 12, fs: 13, gap: 6 },
  md: { h: 40, px: 16, fs: 14, gap: 8 },
  lg: { h: 48, px: 20, fs: 15, gap: 10 },
};

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth,
      disabled,
      children,
      style,
      onMouseEnter,
      onMouseLeave,
      ...rest
    },
    ref,
  ) {
    const v = VARIANTS[variant];
    const s = SIZES[size];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        {...rest}
        onMouseEnter={(e) => {
          if (!isDisabled) e.currentTarget.style.background = v.hover;
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) e.currentTarget.style.background = v.bg;
          onMouseLeave?.(e);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.gap,
          height: s.h,
          padding: `0 ${s.px}px`,
          background: v.bg,
          color: v.color,
          border: v.border ?? 'none',
          borderRadius: 12,
          fontSize: s.fs,
          fontWeight: 600,
          lineHeight: 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
          transition: 'background 150ms ease, opacity 150ms ease',
          ...style,
        }}
      >
        {loading ? (
          <Loader2 size={s.fs + 2} className="animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }),
);

export type { ButtonProps };
