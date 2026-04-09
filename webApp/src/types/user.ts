// ==================== User Types (расширено из MAX) ====================

export interface User {
  id: string;
  phone?: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  fullAvatarUrl?: string;
  statusText?: string;
  isOnline?: boolean;
  isBot?: boolean;
  lastSeenAt?: string;
  /** Описание профиля */
  description?: string;
}

/** Информация о боте */
export interface BotInfo extends User {
  isBot: true;
  commands?: BotCommand[];
}

/** Команда бота */
export interface BotCommand {
  name: string;
  description?: string;
}
