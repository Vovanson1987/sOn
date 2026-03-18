import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrostedGlassBar } from '../FrostedGlassBar';

describe('FrostedGlassBar', () => {
  it('renders children', () => {
    render(<FrostedGlassBar><span>Header Content</span></FrostedGlassBar>);
    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  it('applies backdrop-filter styles', () => {
    const { container } = render(<FrostedGlassBar><span>Test</span></FrostedGlassBar>);
    const header = container.querySelector('header');
    expect(header).toHaveStyle({ backdropFilter: 'var(--header-blur)' });
  });

  it('renders as a header element', () => {
    const { container } = render(<FrostedGlassBar><span>Test</span></FrostedGlassBar>);
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('applies additional className', () => {
    const { container } = render(
      <FrostedGlassBar className="px-4 pt-2"><span>Test</span></FrostedGlassBar>,
    );
    const header = container.querySelector('header');
    expect(header?.className).toContain('px-4');
  });
});
