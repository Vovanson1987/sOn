/**
 * Compound Avatar (паттерн из MAX).
 *
 * Использование:
 *   <Avatar size={48} name="Иван" src="/photo.jpg" isOnline />
 *
 * Compound-режим:
 *   <Avatar.Container size={48}>
 *     <Avatar.Image src="/photo.jpg" fallback="ИП" fallbackGradient="blue" />
 *     <Avatar.OnlineDot />
 *   </Avatar.Container>
 *
 * Группа:
 *   <Avatar size={48} name="Чат" groupMembers={["Иван","Мария","Пётр"]} />
 */

import { memo, createContext, useContext, type ReactNode, type CSSProperties } from 'react';
import { getColorForName, getInitials } from '@utils/colors';
import { useImageLoadingStatus } from '@/hooks/useImageLoadingStatus';

// ==================== Градиенты (как в MAX) ====================

const GRADIENTS = {
  red: 'linear-gradient(135deg, #FF453A 0%, #FF6B6B 100%)',
  orange: 'linear-gradient(135deg, #FF9F0A 0%, #FFB347 100%)',
  green: 'linear-gradient(135deg, #30D158 0%, #34C759 100%)',
  blue: 'linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)',
  purple: 'linear-gradient(135deg, #AF52DE 0%, #BF5AF2 100%)',
} as const;

export type AvatarGradient = keyof typeof GRADIENTS;

// ==================== Context ====================

interface AvatarContextValue {
  size: number;
}

const AvatarContext = createContext<AvatarContextValue>({ size: 48 });
const useAvatarContext = () => useContext(AvatarContext);

// ==================== Avatar.Container ====================

interface AvatarContainerProps {
  size: number;
  children: ReactNode;
  /** Элемент в правом нижнем углу (OnlineDot, badge) */
  rightBottomCorner?: ReactNode;
  /** Элемент в правом верхнем углу (CloseButton, counter) */
  rightTopCorner?: ReactNode;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const AvatarContainer = memo(function AvatarContainer({
  size,
  children,
  rightBottomCorner,
  rightTopCorner,
  className = '',
  style,
  'aria-label': ariaLabel,
}: AvatarContainerProps) {
  return (
    <AvatarContext.Provider value={{ size }}>
      <div
        className={`relative inline-flex flex-shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size, ...style }}
        role="img"
        aria-label={ariaLabel}
      >
        {children}
        {rightBottomCorner && (
          <div className="absolute bottom-0 right-0">{rightBottomCorner}</div>
        )}
        {rightTopCorner && (
          <div className="absolute -top-0.5 -right-0.5">{rightTopCorner}</div>
        )}
      </div>
    </AvatarContext.Provider>
  );
});

// ==================== Avatar.Image ====================

interface AvatarImageProps {
  src?: string | null;
  alt?: string;
  /** Текст для fallback (инициалы) */
  fallback?: string;
  /** Градиент фона при fallback */
  fallbackGradient?: AvatarGradient;
  className?: string;
}

const AvatarImage = memo(function AvatarImage({
  src,
  alt = '',
  fallback = '',
  fallbackGradient,
  className = '',
}: AvatarImageProps) {
  const { size } = useAvatarContext();
  const status = useImageLoadingStatus(src);
  const imgStyle: CSSProperties = { width: size, height: size };

  if (status === 'loaded' && src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover ${className}`}
        style={imgStyle}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback: инициалы с градиентом или цветом
  const bg = fallbackGradient
    ? GRADIENTS[fallbackGradient]
    : getColorForName(fallback || alt);

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold ${className}`}
      style={{
        ...imgStyle,
        background: bg,
        fontSize: size * 0.38,
      }}
    >
      {getInitials(fallback || alt || '?')}
    </div>
  );
});

// ==================== Avatar.Text ====================

interface AvatarTextProps {
  children: string;
  gradient?: AvatarGradient;
  className?: string;
}

const AvatarText = memo(function AvatarText({
  children,
  gradient,
  className = '',
}: AvatarTextProps) {
  const { size } = useAvatarContext();
  const bg = gradient ? GRADIENTS[gradient] : getColorForName(children);

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.38,
      }}
    >
      {children}
    </div>
  );
});

// ==================== Avatar.OnlineDot ====================

interface OnlineDotProps {
  borderColor?: string;
}

const AvatarOnlineDot = memo(function AvatarOnlineDot({
  borderColor = '#1e1e2e',
}: OnlineDotProps) {
  const { size } = useAvatarContext();
  const dotSize = Math.max(8, size * 0.22);

  return (
    <span
      className="rounded-full"
      style={{
        width: dotSize,
        height: dotSize,
        background: '#30D158',
        border: `2px solid ${borderColor}`,
        display: 'block',
      }}
      aria-hidden="true"
    />
  );
});

// ==================== Avatar.Icon ====================

interface AvatarIconProps {
  children: ReactNode;
  bg?: string;
  className?: string;
}

const AvatarIcon = memo(function AvatarIcon({
  children,
  bg = '#636366',
  className = '',
}: AvatarIconProps) {
  const { size } = useAvatarContext();

  return (
    <div
      className={`rounded-full flex items-center justify-center ${className}`}
      style={{ width: size, height: size, background: bg }}
    >
      {children}
    </div>
  );
});

// ==================== Avatar.CloseButton ====================

interface CloseButtonProps {
  onClick?: () => void;
}

const AvatarCloseButton = memo(function AvatarCloseButton({ onClick }: CloseButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-[18px] h-[18px] rounded-full flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.2)' }}
      aria-label="Удалить"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
        <path d="M1 1L9 9M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
});

// ==================== MiniAvatar (для группового 2×2) ====================

function MiniAvatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold"
      style={{
        width: size,
        height: size,
        background: getColorForName(name),
        fontSize: size * 0.4,
        lineHeight: 1,
      }}
    >
      {getInitials(name).charAt(0)}
    </div>
  );
}

// ==================== Силуэт ====================

function SilhouetteAvatar({ size }: { size: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{ width: size, height: size, background: '#636366' }}
    >
      <svg viewBox="0 0 24 24" fill="white" width={size * 0.55} height={size * 0.55}>
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  );
}

// ==================== Основной Avatar (обратная совместимость) ====================

interface AvatarProps {
  size: number;
  src?: string;
  name: string;
  isOnline?: boolean;
  groupMembers?: string[];
}

const AvatarRoot = memo(function AvatarRoot({ size, src, name, isOnline, groupMembers }: AvatarProps) {
  // Групповой аватар 2×2
  if (groupMembers && groupMembers.length >= 2) {
    const miniSize = Math.floor(size * 0.48);
    const gap = Math.floor(size * 0.04);
    const members = groupMembers.slice(0, 4);

    return (
      <div
        className="relative inline-flex flex-wrap items-center justify-center rounded-full overflow-hidden"
        style={{ width: size, height: size, minWidth: size, minHeight: size, gap, background: '#2C2C2E' }}
        role="img"
        aria-label={`Групповой аватар ${name}`}
      >
        {members.map((m, i) => (
          <MiniAvatar key={`${m}-${i}`} name={m} size={miniSize} />
        ))}
      </div>
    );
  }

  // Одиночный аватар через compound-систему
  const isNumericName = /^\d+$/.test(name) || name === '900';
  const ariaLabel = `Аватар ${name}${isOnline ? ', онлайн' : ''}`;

  return (
    <AvatarContainer
      size={size}
      rightBottomCorner={isOnline ? <AvatarOnlineDot /> : undefined}
      aria-label={ariaLabel}
    >
      {isNumericName ? (
        <SilhouetteAvatar size={size} />
      ) : (
        <AvatarImage src={src} alt={name} fallback={name} />
      )}
    </AvatarContainer>
  );
});

// ==================== Compound Export (как в MAX) ====================

export const Avatar = Object.assign(AvatarRoot, {
  Container: AvatarContainer,
  Image: AvatarImage,
  Text: AvatarText,
  OnlineDot: AvatarOnlineDot,
  Icon: AvatarIcon,
  CloseButton: AvatarCloseButton,
});

export type { AvatarProps, AvatarContainerProps, AvatarImageProps, AvatarTextProps };
