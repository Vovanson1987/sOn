const APPLE_AVATAR_COLORS = [
  '#FF453A', // Red
  '#FF9500', // Orange
  '#FFCC00', // Yellow
  '#30D158', // Green
  '#007AFF', // Blue
  '#AF52DE', // Purple
  '#8E8E93', // Gray
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getColorForName(name: string): string {
  return APPLE_AVATAR_COLORS[hashCode(name) % APPLE_AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  // Strip emojis for initial generation
  const clean = name.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
  if (!clean) return name.slice(0, 2);
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
