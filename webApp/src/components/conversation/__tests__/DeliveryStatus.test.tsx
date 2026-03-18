import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryStatus } from '../DeliveryStatus';

describe('DeliveryStatus', () => {
  it('показывает "Отправка..." для sending', () => {
    render(<DeliveryStatus status="sending" />);
    expect(screen.getByText('Отправка...')).toBeInTheDocument();
  });

  it('показывает "Отправлено" для sent', () => {
    render(<DeliveryStatus status="sent" />);
    expect(screen.getByText('Отправлено')).toBeInTheDocument();
  });

  it('показывает "Доставлено" для delivered', () => {
    render(<DeliveryStatus status="delivered" />);
    expect(screen.getByText('Доставлено')).toBeInTheDocument();
  });

  it('показывает "Прочитано" синим для read', () => {
    render(<DeliveryStatus status="read" />);
    const el = screen.getByText('Прочитано');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ color: '#007AFF' });
  });

  it('показывает "Не доставлено" красным для failed', () => {
    render(<DeliveryStatus status="failed" />);
    expect(screen.getByText('Не доставлено')).toBeInTheDocument();
  });
});
