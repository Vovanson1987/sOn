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
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backdropFilter).toContain('blur');
  });

  it('renders as div by default', () => {
    const { container } = render(<FrostedGlassBar><span>Test</span></FrostedGlassBar>);
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('renders as header when as="header"', () => {
    const { container } = render(<FrostedGlassBar as="header"><span>Test</span></FrostedGlassBar>);
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('applies additional className', () => {
    const { container } = render(
      <FrostedGlassBar className="px-4 pt-2"><span>Test</span></FrostedGlassBar>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('px-4');
  });

  it('applies custom style prop', () => {
    const { container } = render(
      <FrostedGlassBar style={{ paddingTop: '10px' }}><span>Test</span></FrostedGlassBar>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.paddingTop).toBe('10px');
  });

  it('has hairline border bottom', () => {
    const { container } = render(<FrostedGlassBar><span>Test</span></FrostedGlassBar>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderBottom).toContain('0.5px');
  });
});
