import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceMessage } from '../VoiceMessage';

describe('VoiceMessage', () => {
  it('отображает длительность', () => {
    render(<VoiceMessage duration={72} isPlaying={false} progress={0} onTogglePlay={() => {}} />);
    expect(screen.getByText('1:12')).toBeInTheDocument();
  });

  it('показывает кнопку воспроизведения', () => {
    render(<VoiceMessage duration={30} isPlaying={false} progress={0} onTogglePlay={() => {}} />);
    expect(screen.getByLabelText('Воспроизвести')).toBeInTheDocument();
  });

  it('показывает кнопку паузы при воспроизведении', () => {
    render(<VoiceMessage duration={30} isPlaying progress={0.5} onTogglePlay={() => {}} />);
    expect(screen.getByLabelText('Пауза')).toBeInTheDocument();
  });

  it('вызывает onTogglePlay при клике', () => {
    const onToggle = vi.fn();
    render(<VoiceMessage duration={30} isPlaying={false} progress={0} onTogglePlay={onToggle} />);
    fireEvent.click(screen.getByLabelText('Воспроизвести'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('отображает SVG-волну (24 полоски)', () => {
    const { container } = render(<VoiceMessage duration={15} isPlaying={false} progress={0} onTogglePlay={() => {}} />);
    const bars = container.querySelectorAll('.rounded-full');
    // 24 полоски волны + кнопка play (тоже rounded-full)
    expect(bars.length).toBeGreaterThanOrEqual(24);
  });
});
