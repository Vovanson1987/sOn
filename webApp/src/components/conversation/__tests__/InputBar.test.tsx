import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputBar } from '../InputBar';

// Mock i18n to return proper Russian translations in test environment
vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'chat.placeholder': 'Сообщение',
    };
    return map[key] || key;
  },
  getLocale: () => 'ru',
  setLocale: vi.fn(),
}));

// Mock api/client to prevent real WS calls
vi.mock('@/api/client', () => ({
  sendWS: vi.fn(),
  disconnectWS: vi.fn(),
}));

// Mock fileUpload utilities
vi.mock('@/utils/fileUpload', () => ({
  createVoiceRecorder: vi.fn(),
  uploadVoice: vi.fn(),
}));

// Mock stores
vi.mock('@stores/messageStore', () => ({
  useMessageStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
      const state = { addMessage: vi.fn(), updateMessage: vi.fn(), editingMessage: null, clearEditingMessage: vi.fn() };
      return typeof selector === 'function' ? selector(state) : state;
    }),
    { getState: () => ({ addMessage: vi.fn(), updateMessage: vi.fn() }) },
  ),
}));

vi.mock('@stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'u1', display_name: 'Test' } }) },
}));

describe('InputBar', () => {
  it('отображает placeholder', () => {
    render(<InputBar onSend={() => {}} />);
    expect(screen.getByPlaceholderText('Сообщение')).toBeInTheDocument();
  });

  it('кастомный placeholder для секретных чатов', () => {
    render(<InputBar onSend={() => {}} placeholder="Секретное сообщение..." />);
    expect(screen.getByPlaceholderText('Секретное сообщение...')).toBeInTheDocument();
  });

  it('показывает микрофон при пустом поле', () => {
    render(<InputBar onSend={() => {}} />);
    expect(screen.getByLabelText('Голосовое сообщение')).toBeInTheDocument();
    expect(screen.queryByLabelText('Отправить')).not.toBeInTheDocument();
  });

  it('показывает кнопку отправки при наличии текста', () => {
    render(<InputBar onSend={() => {}} />);
    fireEvent.change(screen.getByLabelText('Написать сообщение'), { target: { value: 'Привет' } });
    expect(screen.getByLabelText('Отправить')).toBeInTheDocument();
    expect(screen.queryByLabelText('Голосовое сообщение')).not.toBeInTheDocument();
  });

  it('вызывает onSend при клике на кнопку отправки', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Написать сообщение'), { target: { value: 'Тест' } });
    fireEvent.click(screen.getByLabelText('Отправить'));
    expect(onSend).toHaveBeenCalledWith('Тест');
  });

  it('очищает поле после отправки', () => {
    render(<InputBar onSend={() => {}} />);
    const textarea = screen.getByLabelText('Написать сообщение') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Тест' } });
    fireEvent.click(screen.getByLabelText('Отправить'));
    expect(textarea.value).toBe('');
  });

  it('не отправляет пустое сообщение', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Написать сообщение'), { target: { value: '   ' } });
    // Кнопка отправки не появляется для пробелов
    expect(screen.queryByLabelText('Отправить')).not.toBeInTheDocument();
  });

  it('Enter отправляет сообщение', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);
    const textarea = screen.getByLabelText('Написать сообщение');
    fireEvent.change(textarea, { target: { value: 'Enter тест' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Enter тест');
  });

  it('Shift+Enter не отправляет (перенос строки)', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);
    const textarea = screen.getByLabelText('Написать сообщение');
    fireEvent.change(textarea, { target: { value: 'Строка' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('кнопка вложений доступна', () => {
    render(<InputBar onSend={() => {}} />);
    expect(screen.getByLabelText('Вложения')).toBeInTheDocument();
  });

  it('кнопка эмодзи доступна', () => {
    render(<InputBar onSend={() => {}} />);
    expect(screen.getByLabelText('Эмодзи')).toBeInTheDocument();
  });
});
