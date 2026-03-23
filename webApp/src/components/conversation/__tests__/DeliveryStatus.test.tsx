import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryStatus } from '../DeliveryStatus';

// Mock i18n to return proper Russian translations in test environment
vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'status.sending': 'Отправляется',
      'status.sent': 'Отправлено',
      'status.delivered': 'Доставлено',
      'status.read': 'Прочитано',
    };
    return map[key] || key;
  },
  getLocale: () => 'ru',
  setLocale: vi.fn(),
}));

describe('DeliveryStatus', () => {
  it('показывает "Отправка..." для sending', () => {
    render(<DeliveryStatus status="sending" />);
    expect(screen.getByText('Отправляется...')).toBeInTheDocument();
  });

  it('показывает "Отправлено" для sent', () => {
    render(<DeliveryStatus status="sent" />);
    expect(screen.getByText('Отправлено')).toBeInTheDocument();
  });

  it('показывает "Доставлено" для delivered', () => {
    render(<DeliveryStatus status="delivered" />);
    expect(screen.getByText('Доставлено')).toBeInTheDocument();
  });

  it('показывает "Прочитано" для read', () => {
    render(<DeliveryStatus status="read" />);
    expect(screen.getByText(/Прочитано/)).toBeInTheDocument();
  });

  it('показывает дату при наличии readAt', () => {
    render(<DeliveryStatus status="read" readAt="2026-03-18T10:00:00Z" />);
    expect(screen.getByText(/Прочитано 18\.03\.2026/)).toBeInTheDocument();
  });

  it('показывает "Не доставлено" красным для failed', () => {
    render(<DeliveryStatus status="failed" />);
    expect(screen.getByText('Не доставлено')).toBeInTheDocument();
  });
});
