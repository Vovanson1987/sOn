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
    // Каждая точка имеет уникальную задержку
    expect(new Set(delays).size).toBe(3);
  });

  it('отображается в сером пузыре', () => {
    const { container } = render(<TypingIndicator />);
    const bubble = container.querySelector('[style*="background"]');
    const style = bubble?.getAttribute('style') ?? '';
    expect(style.includes('#26252A') || style.includes('rgb(38, 37, 42)')).toBe(true);
  });
});
