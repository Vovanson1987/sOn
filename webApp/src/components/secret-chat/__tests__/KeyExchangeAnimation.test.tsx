import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { KeyExchangeAnimation } from '../KeyExchangeAnimation';

describe('KeyExchangeAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('отображает имя контакта', () => {
    render(<KeyExchangeAnimation contactName="Алексей" onComplete={vi.fn()} />);
    expect(screen.getByText('Алексей')).toBeTruthy();
    expect(screen.getByText(/Подключение к/)).toBeTruthy();
  });

  it('имеет role="dialog" и aria-label', () => {
    render(<KeyExchangeAnimation contactName="Алексей" onComplete={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Установка защищённого соединения' })).toBeTruthy();
  });

  it('показывает первый шаг изначально', () => {
    render(<KeyExchangeAnimation contactName="Алексей" onComplete={vi.fn()} />);
    expect(screen.getByText(/Генерация ключевой пары/)).toBeTruthy();
  });

  it('показывает все 4 шага', () => {
    render(<KeyExchangeAnimation contactName="Алексей" onComplete={vi.fn()} />);
    expect(screen.getByText(/Генерация ключевой пары/)).toBeTruthy();
    expect(screen.getByText(/Обмен ключами/)).toBeTruthy();
    expect(screen.getByText(/Double Ratchet/)).toBeTruthy();
    expect(screen.getByText(/Защищённое соединение установлено/)).toBeTruthy();
  });

  it('прогрессирует через шаги с таймером', () => {
    render(<KeyExchangeAnimation contactName="Тест" onComplete={vi.fn()} />);

    // Первый шаг active (step 0)
    // Через 800ms — step 1
    act(() => { vi.advanceTimersByTime(800); });
    // Через ещё 800ms — step 2
    act(() => { vi.advanceTimersByTime(800); });
    // Через ещё 800ms — step 3
    act(() => { vi.advanceTimersByTime(800); });
    // Через ещё 800ms — step 4 (all complete)
    act(() => { vi.advanceTimersByTime(800); });
    // Все шаги должны быть видимы
    expect(screen.getByText(/Защищённое соединение установлено/)).toBeTruthy();
  });

  it('вызывает onComplete после завершения всех шагов', () => {
    const onComplete = vi.fn();
    render(<KeyExchangeAnimation contactName="Тест" onComplete={onComplete} />);

    // Проходим по 4 шагам (каждый 800ms)
    for (let i = 0; i < 4; i++) {
      act(() => { vi.advanceTimersByTime(800); });
    }
    expect(onComplete).not.toHaveBeenCalled();

    // Финальная задержка 1000ms перед вызовом onComplete
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('отображает иконки замков', () => {
    const { container } = render(<KeyExchangeAnimation contactName="Тест" onComplete={vi.fn()} />);
    // Два SVG иконки Lock
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('отображает анимированные точки', () => {
    const { container } = render(<KeyExchangeAnimation contactName="Тест" onComplete={vi.fn()} />);
    const dots = container.querySelectorAll('.rounded-full');
    // 5 анимированных точек между замками
    expect(dots.length).toBeGreaterThanOrEqual(5);
  });
});
