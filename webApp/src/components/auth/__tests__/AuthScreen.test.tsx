import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthScreen } from '../AuthScreen';

// Мок fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AuthScreen', () => {
  const mockOnAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит форму входа по умолчанию', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    expect(screen.getByText('sOn')).toBeTruthy();
    expect(screen.getByText('Защищённый мессенджер')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Пароль')).toBeTruthy();
    expect(screen.getByText('Войти')).toBeTruthy();
    expect(screen.getByText('Регистрация')).toBeTruthy();
  });

  it('нет поля Имя в режиме входа', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    expect(screen.queryByPlaceholderText('Имя')).toBeNull();
  });

  it('переключается на регистрацию', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    fireEvent.click(screen.getByText('Регистрация'));
    expect(screen.getByPlaceholderText('Имя')).toBeTruthy();
    expect(screen.getByText('Зарегистрироваться')).toBeTruthy();
    expect(screen.getByText('Уже есть аккаунт?')).toBeTruthy();
  });

  it('переключается обратно на вход', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    fireEvent.click(screen.getByText('Регистрация'));
    fireEvent.click(screen.getByText('Войти'));
    expect(screen.queryByPlaceholderText('Имя')).toBeNull();
    expect(screen.getByText('Нет аккаунта?')).toBeTruthy();
  });

  it('успешный вход вызывает onAuth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        token: 'jwt-token',
        user: { id: 'u1', email: 'test@test.com', display_name: 'Тест' },
      }),
    });

    render(<AuthScreen onAuth={mockOnAuth} />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => {
      expect(mockOnAuth).toHaveBeenCalledWith('jwt-token', { id: 'u1', email: 'test@test.com', display_name: 'Тест' });
    });
  });

  it('показывает ошибку при неудачном входе', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Неверный email или пароль' }),
    });

    render(<AuthScreen onAuth={mockOnAuth} />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => {
      expect(screen.getByText('Неверный email или пароль')).toBeTruthy();
    });
    expect(mockOnAuth).not.toHaveBeenCalled();
  });

  it('показывает состояние загрузки', async () => {
    let resolvePromise: (value: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise(r => { resolvePromise = r; }));

    render(<AuthScreen onAuth={mockOnAuth} />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Войти'));

    expect(screen.getByText('Подождите...')).toBeTruthy();

    // Разрешить промис чтобы тест завершился
    resolvePromise!({ ok: true, json: () => Promise.resolve({ token: 't', user: { id: '1', email: 'e', display_name: 'n' } }) });
    await waitFor(() => expect(mockOnAuth).toHaveBeenCalled());
  });

  it('поле email имеет type="email"', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    expect(screen.getByPlaceholderText('Email').getAttribute('type')).toBe('email');
  });

  it('поле пароля имеет type="password"', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    expect(screen.getByPlaceholderText('Пароль').getAttribute('type')).toBe('password');
  });

  it('пароль имеет minLength=8', () => {
    render(<AuthScreen onAuth={mockOnAuth} />);
    expect(screen.getByPlaceholderText('Пароль').getAttribute('minlength')).toBe('8');
  });

  it('очищает ошибку при переключении режима', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Ошибка' }),
    });

    render(<AuthScreen onAuth={mockOnAuth} />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => expect(screen.getByText('Ошибка')).toBeTruthy());

    fireEvent.click(screen.getByText('Регистрация'));
    expect(screen.queryByText('Ошибка')).toBeNull();
  });
});
