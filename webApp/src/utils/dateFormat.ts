const MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

function isThisWeek(date: Date, now: Date): boolean {
  const diff = now.getTime() - date.getTime();
  return diff < 7 * 24 * 60 * 60 * 1000 && date.getDay() <= now.getDay();
}

export function formatChatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  if (isSameDay(date, now)) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday(date, now)) {
    return 'Вчера';
  }
  if (isThisWeek(date, now)) {
    return DAYS_SHORT[date.getDay()];
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  }
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  if (isSameDay(date, now)) {
    return `Сегодня ${formatMessageTime(dateStr)}`;
  }
  if (isYesterday(date, now)) {
    return 'Вчера';
  }
  const day = DAYS_SHORT[date.getDay()];
  const monthDay = date.getDate();
  const month = MONTHS_SHORT[date.getMonth()];
  const time = formatMessageTime(dateStr);

  if (date.getFullYear() === now.getFullYear()) {
    return `${day}, ${monthDay} ${month}, ${time}`;
  }
  return `${String(monthDay).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}
