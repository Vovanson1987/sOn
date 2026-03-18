import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../ImageViewer';

describe('ImageViewer', () => {
  it('отображает изображение', () => {
    render(<ImageViewer src="https://example.com/photo.jpg" alt="Тест" onClose={() => {}} />);
    const img = screen.getByAltText('Тест');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('показывает кнопку закрытия', () => {
    render(<ImageViewer src="https://example.com/photo.jpg" alt="Тест" onClose={() => {}} />);
    expect(screen.getByLabelText('Закрыть')).toBeInTheDocument();
  });

  it('вызывает onClose при клике на кнопку', () => {
    const onClose = vi.fn();
    render(<ImageViewer src="https://example.com/photo.jpg" alt="Тест" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });

  it('вызывает onClose при клике на фон', () => {
    const onClose = vi.fn();
    const { container } = render(<ImageViewer src="https://example.com/photo.jpg" alt="Тест" onClose={onClose} />);
    fireEvent.click(container.querySelector('[role="dialog"]')!);
    expect(onClose).toHaveBeenCalled();
  });
});
