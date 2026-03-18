import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileAttachment } from '../FileAttachment';

describe('FileAttachment', () => {
  it('отображает имя файла', () => {
    render(<FileAttachment fileName="document.pdf" fileSize={1024000} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('отображает размер в КБ', () => {
    render(<FileAttachment fileName="small.txt" fileSize={5120} />);
    expect(screen.getByText('5.0 КБ')).toBeInTheDocument();
  });

  it('отображает размер в МБ', () => {
    render(<FileAttachment fileName="big.zip" fileSize={2621440} />);
    expect(screen.getByText('2.5 МБ')).toBeInTheDocument();
  });

  it('отображает размер в байтах для маленьких файлов', () => {
    render(<FileAttachment fileName="tiny.txt" fileSize={512} />);
    expect(screen.getByText('512 Б')).toBeInTheDocument();
  });
});
