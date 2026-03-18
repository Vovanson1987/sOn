import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateSeparator } from '../DateSeparator';

describe('DateSeparator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('показывает "Сегодня" для сегодняшней даты', () => {
    render(<DateSeparator date="2026-03-18T10:00:00Z" />);
    expect(screen.getByText(/Сегодня/)).toBeInTheDocument();
  });

  it('показывает "Вчера" для вчерашней даты', () => {
    render(<DateSeparator date="2026-03-17T10:00:00Z" />);
    expect(screen.getByText('Вчера')).toBeInTheDocument();
  });

  it('показывает дату для старых сообщений', () => {
    render(<DateSeparator date="2026-03-01T10:00:00Z" />);
    const text = screen.getByText(/мар/);
    expect(text).toBeInTheDocument();
  });
});
