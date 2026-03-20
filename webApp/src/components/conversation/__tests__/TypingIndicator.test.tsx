import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('отображает три анимированные точки', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('span[style*="animation"]');
    expect(dots.length).toBe(3);
  });

  it('точки имеют разную задержку анимации', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('span[style*="animation"]');
    const delays = Array.from(dots).map((d) => d.getAttribute('style'));
    expect(new Set(delays).size).toBe(3);
  });

  it('отображается в сером пузыре', () => {
    const { container } = render(<TypingIndicator />);
    const bubble = container.querySelector('[style*="background"]');
    const style = bubble?.getAttribute('style') ?? '';
    expect(style.includes('#3A3A3C') || style.includes('rgb(58, 58, 60)')).toBe(true);
  });

  it('имеет aria-live="polite" для скринридера', () => {
    render(<TypingIndicator />);
    const status = document.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.getAttribute('aria-live')).toBe('polite');
  });

  it('показывает имя печатающего', () => {
    render(<TypingIndicator names={['Анна']} />);
    const status = document.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toContain('Анна печатает');
  });

  it('показывает несколько печатающих', () => {
    render(<TypingIndicator names={['Анна', 'Пётр']} />);
    const status = document.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toContain('Анна и Пётр печатают');
  });
});
