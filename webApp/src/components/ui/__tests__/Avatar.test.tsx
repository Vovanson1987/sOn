import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../Avatar';

// Мок useImageLoadingStatus — JSDOM не поддерживает Image.onload
vi.mock('@/hooks/useImageLoadingStatus', () => ({
  useImageLoadingStatus: (src: string | undefined | null) => {
    // Считаем локальные пути загруженными, внешние — ошибкой
    if (!src) return 'idle';
    if (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('data:')) return 'loaded';
    return 'error';
  },
}));

describe('Avatar', () => {
  it('renders initials for a name', () => {
    render(<Avatar size={50} name="Ксенька Доч" />);
    expect(screen.getByText('КД')).toBeInTheDocument();
  });

  it('renders silhouette for numeric name', () => {
    const { container } = render(<Avatar size={50} name="900" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders image when src is a relative path', () => {
    render(<Avatar size={50} name="Test" src="/media/avatars/photo.jpg" />);
    const img = screen.getByRole('img', { name: /Аватар Test/ });
    // Внутри compound Avatar — img элемент рендерится при loaded status
    const imgEl = img.querySelector('img');
    expect(imgEl).toBeInTheDocument();
    expect(imgEl).toHaveAttribute('src', '/media/avatars/photo.jpg');
  });

  it('renders initials when src is an external URL (security)', () => {
    render(<Avatar size={50} name="Test" src="https://evil.com/track.jpg" />);
    // Внешний URL → useImageLoadingStatus вернёт 'error' → fallback на инициалы
    expect(screen.getByText('TE')).toBeInTheDocument();
  });

  it('shows online indicator when isOnline is true', () => {
    render(<Avatar size={50} name="Vladimir" isOnline />);
    expect(screen.getByLabelText('Аватар Vladimir, онлайн')).toBeInTheDocument();
  });

  it('does not show online indicator when isOnline is false', () => {
    render(<Avatar size={50} name="Vladimir" isOnline={false} />);
    expect(screen.getByLabelText('Аватар Vladimir')).toBeInTheDocument();
    expect(screen.queryByLabelText('Аватар Vladimir, онлайн')).not.toBeInTheDocument();
  });

  it('applies correct size', () => {
    render(<Avatar size={120} name="Test" />);
    const avatar = screen.getByLabelText('Аватар Test');
    expect(avatar).toHaveStyle({ width: '120px', height: '120px' });
  });

  it('renders single-char initial for short name', () => {
    render(<Avatar size={50} name="Рсхб" />);
    expect(screen.getByText('РС')).toBeInTheDocument();
  });

  it('handles emoji in name for groups', () => {
    render(<Avatar size={50} name="💼 Работа SCIF" />);
    expect(screen.getByText('РS')).toBeInTheDocument();
  });
});
