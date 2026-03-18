import { memo } from 'react';
import { getColorForName, getInitials } from '@utils/colors';

interface AvatarProps {
  size: 35 | 50 | 52 | 120;
  src?: string;
  name: string;
  isOnline?: boolean;
}

export const Avatar = memo(function Avatar({ size, src, name, isOnline }: AvatarProps) {
  const style = { width: size, height: size, minWidth: size, minHeight: size };

  return (
    <div className="relative inline-flex" style={style} aria-label={`Аватар ${name}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="rounded-full object-cover"
          style={style}
        />
      ) : name.match(/^\d+$/) || name === '900' ? (
        <div
          className="rounded-full flex items-center justify-center"
          style={{ ...style, backgroundColor: '#636366' }}
        >
          <svg viewBox="0 0 24 24" fill="white" width={size * 0.55} height={size * 0.55}>
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold"
          style={{
            ...style,
            backgroundColor: getColorForName(name),
            fontSize: size * 0.38,
          }}
        >
          {getInitials(name)}
        </div>
      )}
      {isOnline && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-black"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            backgroundColor: '#34C759',
          }}
          aria-label="Онлайн"
        />
      )}
    </div>
  );
});
