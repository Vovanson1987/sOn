import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders with placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Поиск" />);
    expect(screen.getByPlaceholderText('Поиск')).toBeInTheDocument();
  });

  it('displays current value', () => {
    render(<SearchBar value="Алексей" onChange={() => {}} />);
    expect(screen.getByDisplayValue('Алексей')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('has aria-label for accessibility', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Поиск" />);
    expect(screen.getByLabelText('Поиск')).toBeInTheDocument();
  });

  it('uses default placeholder when not specified', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Поиск')).toBeInTheDocument();
  });
});
