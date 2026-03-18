import { describe, it, expect } from 'vitest';
import { getColorForName, getInitials } from '../colors';

describe('getColorForName', () => {
  it('returns a string starting with #', () => {
    expect(getColorForName('Алексей')).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('returns the same color for the same name', () => {
    expect(getColorForName('Vladimir')).toBe(getColorForName('Vladimir'));
  });

  it('returns different colors for different names (usually)', () => {
    const colors = new Set(['Алексей', 'Мама', 'Папа', 'MIRATORG', 'Рсхб'].map(getColorForName));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles empty string', () => {
    expect(getColorForName('')).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('getInitials', () => {
  it('returns two initials for two-word name', () => {
    expect(getInitials('Ксенька Доч')).toBe('КД');
  });

  it('returns first two chars for single-word name', () => {
    expect(getInitials('MIRATORG')).toBe('MI');
  });

  it('returns initials for multi-word name', () => {
    expect(getInitials('Папа Петропавловск')).toBe('ПП');
  });

  it('strips emojis before generating initials', () => {
    expect(getInitials('💼 Работа SCIF')).toBe('РS');
  });

  it('handles name with only emoji', () => {
    const result = getInitials('👨‍👩‍👧');
    expect(result).toBeTruthy();
  });

  it('handles Артем Клиент', () => {
    expect(getInitials('Артем Клиент')).toBe('АК');
  });

  it('returns uppercase', () => {
    expect(getInitials('vladimir')).toBe('VL');
  });
});
