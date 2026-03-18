export interface User {
  id: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  statusText?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}
