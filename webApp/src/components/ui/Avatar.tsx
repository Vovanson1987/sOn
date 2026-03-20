import { memo } from 'react';
import { getColorForName, getInitials } from '@utils/colors';

interface AvatarProps {
  size: 35 | 40 | 50 | 52 | 120;
  src?: string;
  name: string;
  isOnline?: boolean;
  /** Имена участников для группового аватара 2×2 */
  groupMembers?: string[];
}

/** Мини-аватар для сетки группового чата */
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

/** Силуэт для контактов без фото (номера, 900 и т.д.) */
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

export const Avatar = memo(function Avatar({ size, src, name, isOnline, groupMembers }: AvatarProps) {
  const style = { width: size, height: size, minWidth: size, minHeight: size };

  // Групповой аватар 2×2
  if (groupMembers && groupMembers.length >= 2) {
    const miniSize = Math.floor(size * 0.48);
    const gap = Math.floor(size * 0.04);
    const members = groupMembers.slice(0, 4);

    return (
      <div
        className="relative inline-flex flex-wrap items-center justify-center rounded-full overflow-hidden"
        style={{ ...style, gap, background: '#2C2C2E' }}
        aria-label={`Групповой аватар ${name}`}
      >
        {members.map((m, i) => (
          <MiniAvatar key={`${m}-${i}`} name={m} size={miniSize} />
        ))}
      </div>
    );
  }

  return (
    <div className="relative inline-flex" style={style} aria-label={`Аватар ${name}`}>
      {src && (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('data:image/')) ? (
        <img src={src} alt={name} className="rounded-full object-cover" style={style} referrerPolicy="no-referrer" />
      ) : name.match(/^\d+$/) || name === '900' ? (
        <SilhouetteAvatar size={size} />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold"
          style={{
            ...style,
            background: getColorForName(name),
            fontSize: size * 0.38,
          }}
        >
          {getInitials(name)}
        </div>
      )}
      {isOnline && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-black"
          style={{ width: size * 0.22, height: size * 0.22, background: '#34C759' }}
          aria-label="Онлайн"
        />
      )}
    </div>
  );
});
