import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CallScreen } from '../CallScreen';
import { useCallStore } from '@stores/callStore';

describe('CallScreen', () => {
  beforeEach(() => {
    useCallStore.setState({ activeCall: null });
  });

  it('не отображается без активного звонка', () => {
    const { container } = render(<CallScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('отображает имя контакта при исходящем звонке', () => {
    useCallStore.getState().startCall('chat-1', 'Алексей', false);
    render(<CallScreen />);
    expect(screen.getByText('Алексей')).toBeInTheDocument();
    expect(screen.getByText('Вызов...')).toBeInTheDocument();
  });

  it('отображает "Входящий аудиозвонок" при входящем', () => {
    useCallStore.getState().incomingCall('chat-1', 'Vladimir', false);
    render(<CallScreen />);
    expect(screen.getByText('Входящий аудиозвонок...')).toBeInTheDocument();
    expect(screen.getByText('Принять')).toBeInTheDocument();
    expect(screen.getByText('Отклонить')).toBeInTheDocument();
  });

  it('отображает "Входящий видеозвонок" при видео', () => {
    useCallStore.getState().incomingCall('chat-1', 'Vladimir', true);
    render(<CallScreen />);
    expect(screen.getByText('Входящий видеозвонок...')).toBeInTheDocument();
  });

  it('имеет aria-modal="true"', () => {
    useCallStore.getState().startCall('chat-1', 'Алексей', false);
    const { container } = render(<CallScreen />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('кнопка "Завершить звонок" завершает звонок', () => {
    useCallStore.getState().startCall('chat-1', 'Алексей', false);
    render(<CallScreen />);
    fireEvent.click(screen.getByLabelText('Завершить звонок'));
    expect(useCallStore.getState().activeCall?.status).toBe('ended');
  });
});
