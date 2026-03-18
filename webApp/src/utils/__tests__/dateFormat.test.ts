import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatChatDate, formatMessageTime, formatDateSeparator } from '../dateFormat';

describe('formatMessageTime', () => {
  it('returns HH:MM format', () => {
    const result = formatMessageTime('2026-03-18T14:30:00Z');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatChatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns time for today', () => {
    const result = formatChatDate('2026-03-18T09:30:00Z');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('returns "Вчера" for yesterday', () => {
    const result = formatChatDate('2026-03-17T14:00:00Z');
    expect(result).toBe('Вчера');
  });

  it('returns day of week for this week', () => {
    const result = formatChatDate('2026-03-16T10:00:00Z');
    expect(result).toMatch(/^(Пн|Вт|Ср|Чт|Пт|Сб|Вс)$/);
  });

  it('returns day + month for this year', () => {
    const result = formatChatDate('2026-02-28T15:00:00Z');
    // "28 февр." — contains digit, space, and text with dot
    expect(result).toMatch(/\d+\s\S+/);
  });

  it('returns DD.MM.YYYY for previous years', () => {
    const result = formatChatDate('2025-12-25T10:00:00Z');
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });
});

describe('formatDateSeparator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Сегодня HH:MM" for today', () => {
    const result = formatDateSeparator('2026-03-18T09:30:00Z');
    expect(result).toMatch(/^Сегодня \d{2}:\d{2}$/);
  });

  it('returns "Вчера" for yesterday', () => {
    const result = formatDateSeparator('2026-03-17T14:00:00Z');
    expect(result).toBe('Вчера');
  });
});
