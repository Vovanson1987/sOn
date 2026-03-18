import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsScreen } from '../SettingsScreen';

describe('SettingsScreen', () => {
  it('отображает имя пользователя', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Владимир')).toBeInTheDocument();
  });

  it('отображает номер телефона', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('+7 (999) 123-45-67')).toBeInTheDocument();
  });

  it('отображает секцию "Профиль"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Профиль')).toBeInTheDocument();
  });

  it('отображает секцию "Тема"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Тема')).toBeInTheDocument();
    expect(screen.getByText('Тёмная')).toBeInTheDocument();
  });

  it('отображает секцию "Уведомления"', () => {
    render(<SettingsScreen />);
    const items = screen.getAllByText('Уведомления');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('отображает секцию "Конфиденциальность"', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Конфиденциальность')).toBeInTheDocument();
    expect(screen.getByText('Онлайн-статус')).toBeInTheDocument();
    expect(screen.getByText('Отчёты о прочтении')).toBeInTheDocument();
  });

  it('отображает версию приложения', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('1.0.0 (Sprint 6)')).toBeInTheDocument();
  });

  it('отображает шифрование Signal Protocol', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Signal Protocol')).toBeInTheDocument();
  });
});
