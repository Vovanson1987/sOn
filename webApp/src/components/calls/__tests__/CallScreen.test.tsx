import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CallScreen } from '../CallScreen';
import { useCallStore } from '@stores/callStore';

// Mock i18n to return proper Russian translations in test environment
vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'call.audio': 'Аудиозвонок',
      'call.video': 'Видеозвонок',
      'call.incoming': 'Входящий',
      'call.outgoing': 'Вызов',
      'call.ended': 'Завершён',
      'call.accept': 'Принять',
      'call.decline': 'Отклонить',
    };
    return map[key] || key;
  },
  getLocale: () => 'ru',
  setLocale: vi.fn(),
}));

// Mock webrtc module to prevent actual WebRTC calls in tests
// startCall and acceptCall must return Promises because callStore calls .catch() on them
vi.mock('@/utils/webrtc', () => ({
  startCall: vi.fn().mockResolvedValue(undefined),
  acceptCall: vi.fn().mockResolvedValue(undefined),
  endCall: vi.fn(),
  rejectCall: vi.fn(),
  toggleMic: vi.fn(() => true),
  toggleCamera: vi.fn(() => true),
  onCallEvent: vi.fn(() => () => {}),
}));

const fakeSdp: RTCSessionDescriptionInit = { type: 'offer', sdp: 'fake-sdp' };

describe('CallScreen', () => {
  beforeEach(() => {
    useCallStore.setState({ activeCall: null });
  });

  it('не отображается без активного звонка', () => {
    const { container } = render(<CallScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('отображает имя контакта при исходящем звонке', () => {
    useCallStore.getState().startCall('chat-1', 'Алексей', false, 'user-2');
    render(<CallScreen />);
    expect(screen.getByText('Алексей')).toBeInTheDocument();
    expect(screen.getByText('Вызов...')).toBeInTheDocument();
  });

  it('отображает "Входящий аудиозвонок" при входящем', () => {
    useCallStore.getState().incomingCall('chat-1', 'Vladimir', false, 'user-2', fakeSdp);
    render(<CallScreen />);
    expect(screen.getByText('Входящий Аудиозвонок...')).toBeInTheDocument();
    expect(screen.getByText('Принять')).toBeInTheDocument();
    expect(screen.getByText('Отклонить')).toBeInTheDocument();
  });

  it('отображает "Входящий видеозвонок" при видео', () => {
    useCallStore.getState().incomingCall('chat-1', 'Vladimir', true, 'user-2', fakeSdp);
    render(<CallScreen />);
    expect(screen.getByText('Входящий Видеозвонок...')).toBeInTheDocument();
  });

  it('имеет aria-modal="true"', () => {
    useCallStore.getState().startCall('chat-1', 'Алексей', false, 'user-2');
    const { container } = render(<CallScreen />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('кнопка "Завершить звонок" завершает звонок', () => {
    useCallStore.getState().startCall('chat-1', 'Алексей', false, 'user-2');
    render(<CallScreen />);
    fireEvent.click(screen.getByLabelText('Завершить звонок'));
    expect(useCallStore.getState().activeCall?.status).toBe('ended');
  });
});
