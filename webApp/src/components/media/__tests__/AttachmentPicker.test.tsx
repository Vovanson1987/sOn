import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentPicker } from '../AttachmentPicker';

describe('AttachmentPicker', () => {
  it('не отображается когда isOpen=false', () => {
    const { container } = render(<AttachmentPicker isOpen={false} onClose={() => {}} onSelect={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('отображает 4 пункта меню', () => {
    render(<AttachmentPicker isOpen onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText('Камера')).toBeInTheDocument();
    expect(screen.getByText('Фото и видео')).toBeInTheDocument();
    expect(screen.getByText('Документ')).toBeInTheDocument();
    expect(screen.getByText('Геолокация')).toBeInTheDocument();
  });

  it('вызывает onSelect при выборе типа', () => {
    const onSelect = vi.fn();
    render(<AttachmentPicker isOpen onClose={() => {}} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Камера'));
    expect(onSelect).toHaveBeenCalledWith('camera');
  });

  it('вызывает onClose при нажатии "Отмена"', () => {
    const onClose = vi.fn();
    render(<AttachmentPicker isOpen onClose={onClose} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalled();
  });

  it('имеет aria-modal="true"', () => {
    const { container } = render(<AttachmentPicker isOpen onClose={() => {}} onSelect={() => {}} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('закрывается по Escape', () => {
    const onClose = vi.fn();
    render(<AttachmentPicker isOpen onClose={onClose} onSelect={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('кнопка "Отмена" в акцентном MAX-цвете', () => {
    render(<AttachmentPicker isOpen onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText('Отмена')).toHaveStyle({ color: '#5B5FC7' });
  });
});
