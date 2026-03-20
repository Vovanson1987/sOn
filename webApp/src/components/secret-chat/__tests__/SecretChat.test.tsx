import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerificationModal } from '../VerificationModal';
import { SelfDestructPicker } from '../SelfDestructPicker';
import { EncryptionInfo } from '../EncryptionInfo';

describe('VerificationModal', () => {
  const defaultProps = {
    myName: 'Владимир',
    theirName: 'Алексей',
    emojiGrid: [['🐶', '🌺', '🎸', '🚀'], ['☀️', '🎭', '🔑', '🌊'], ['🎪', '🍎', '⚡', '🏔️'], ['🎵', '💎', '🌙', '🔥']],
    hexFingerprint: 'A1B2 C3D4 E5F6 7890 ABCD EF12 3456 7890',
    isVerified: false,
    onVerify: vi.fn(),
    onClose: vi.fn(),
  };

  it('отображает заголовок', () => {
    render(<VerificationModal {...defaultProps} />);
    expect(screen.getByText('Верификация шифрования')).toBeInTheDocument();
  });

  it('отображает имена "Вы" и собеседника', () => {
    render(<VerificationModal {...defaultProps} />);
    expect(screen.getByText('Вы')).toBeInTheDocument();
    expect(screen.getByText('Алексей')).toBeInTheDocument();
  });

  it('отображает hex fingerprint', () => {
    render(<VerificationModal {...defaultProps} />);
    expect(screen.getByText('A1B2 C3D4 E5F6 7890 ABCD EF12 3456 7890')).toBeInTheDocument();
  });

  it('показывает кнопку верификации', () => {
    render(<VerificationModal {...defaultProps} />);
    expect(screen.getByText('✓ Подтвердить верификацию')).toBeInTheDocument();
  });

  it('показывает "Подтверждено" если уже верифицирован', () => {
    render(<VerificationModal {...defaultProps} isVerified />);
    expect(screen.getByText('✓ Верификация подтверждена')).toBeInTheDocument();
  });

  it('вызывает onVerify при клике', () => {
    const onVerify = vi.fn();
    render(<VerificationModal {...defaultProps} onVerify={onVerify} />);
    fireEvent.click(screen.getByText('✓ Подтвердить верификацию'));
    expect(onVerify).toHaveBeenCalled();
  });

  it('имеет aria-modal="true"', () => {
    const { container } = render(<VerificationModal {...defaultProps} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('закрывается по Escape', () => {
    const onClose = vi.fn();
    render(<VerificationModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SelfDestructPicker', () => {
  it('не отображается когда закрыт', () => {
    const { container } = render(
      <SelfDestructPicker isOpen={false} currentValue={null} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('отображает все варианты таймера', () => {
    render(<SelfDestructPicker isOpen currentValue={null} onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Выкл')).toBeInTheDocument();
    expect(screen.getByText('5 сек')).toBeInTheDocument();
    expect(screen.getByText('30 сек')).toBeInTheDocument();
    expect(screen.getByText('1 мин')).toBeInTheDocument();
    expect(screen.getByText('1 час')).toBeInTheDocument();
    expect(screen.getByText('1 день')).toBeInTheDocument();
  });

  it('вызывает onSelect при выборе', () => {
    const onSelect = vi.fn();
    render(<SelfDestructPicker isOpen currentValue={null} onSelect={onSelect} onClose={() => {}} />);
    fireEvent.click(screen.getByText('30 сек'));
    expect(onSelect).toHaveBeenCalledWith(30);
  });

  it('показывает галочку у активного значения', () => {
    render(<SelfDestructPicker isOpen currentValue={30} onSelect={() => {}} onClose={() => {}} />);
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks.length).toBe(1);
  });

  it('имеет aria-modal="true"', () => {
    const { container } = render(<SelfDestructPicker isOpen currentValue={null} onSelect={() => {}} onClose={() => {}} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('закрывается по Escape', () => {
    const onClose = vi.fn();
    render(<SelfDestructPicker isOpen currentValue={null} onSelect={() => {}} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('EncryptionInfo', () => {
  const defaultProps = {
    protocol: 'Signal Protocol',
    algorithms: 'Curve25519, AES-256-GCM',
    sessionDate: '18.03.2026',
    ratchetIndex: 47,
    isVerified: true,
    onVerify: vi.fn(),
    onRegenerateKeys: vi.fn(),
    onEndSecretChat: vi.fn(),
    onClose: vi.fn(),
  };

  it('отображает параметры шифрования', () => {
    render(<EncryptionInfo {...defaultProps} />);
    expect(screen.getByText('Signal Protocol')).toBeInTheDocument();
    expect(screen.getByText('Curve25519, AES-256-GCM')).toBeInTheDocument();
    expect(screen.getByText('#47')).toBeInTheDocument();
  });

  it('показывает "Подтверждено" для верифицированного', () => {
    render(<EncryptionInfo {...defaultProps} />);
    expect(screen.getByText('✓ Подтверждено')).toBeInTheDocument();
  });

  it('показывает "Не верифицировано" и кнопку верификации', () => {
    render(<EncryptionInfo {...defaultProps} isVerified={false} />);
    expect(screen.getByText('⚠ Не верифицировано')).toBeInTheDocument();
    expect(screen.getByText('Верифицировать ключи')).toBeInTheDocument();
  });

  it('кнопка "Завершить секретный чат" красная', () => {
    render(<EncryptionInfo {...defaultProps} />);
    expect(screen.getByText('Завершить секретный чат')).toHaveStyle({ color: '#FF453A' });
  });

  it('вызывает onRegenerateKeys', () => {
    const fn = vi.fn();
    render(<EncryptionInfo {...defaultProps} onRegenerateKeys={fn} />);
    fireEvent.click(screen.getByText('Пересоздать ключи'));
    expect(fn).toHaveBeenCalled();
  });

  it('имеет aria-modal="true"', () => {
    const { container } = render(<EncryptionInfo {...defaultProps} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('закрывается по Escape', () => {
    const onClose = vi.fn();
    render(<EncryptionInfo {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
