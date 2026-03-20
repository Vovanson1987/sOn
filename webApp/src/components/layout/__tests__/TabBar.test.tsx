import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from '../TabBar';

describe('TabBar', () => {
  it('отображает все 4 вкладки', () => {
    render(<TabBar activeTab="chats" onTabChange={() => {}} />);
    expect(screen.getByText('Чаты')).toBeInTheDocument();
    expect(screen.getByText('Звонки')).toBeInTheDocument();
    expect(screen.getByText('Контакты')).toBeInTheDocument();
    expect(screen.getByText('Настройки')).toBeInTheDocument();
  });

  it('вызывает onTabChange при клике', () => {
    const onChange = vi.fn();
    render(<TabBar activeTab="chats" onTabChange={onChange} />);
    fireEvent.click(screen.getByText('Звонки'));
    expect(onChange).toHaveBeenCalledWith('calls');
  });

  it('показывает бейдж непрочитанных', () => {
    render(<TabBar activeTab="chats" onTabChange={() => {}} unreadChats={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('показывает бейдж пропущенных звонков', () => {
    render(<TabBar activeTab="chats" onTabChange={() => {}} missedCalls={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('показывает "99+" при > 99', () => {
    render(<TabBar activeTab="chats" onTabChange={() => {}} unreadChats={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('не показывает бейдж при 0', () => {
    const { container } = render(<TabBar activeTab="chats" onTabChange={() => {}} unreadChats={0} />);
    expect(container.querySelector('[style*="background: #FF453A"]')).toBeNull();
  });

  it('активная вкладка имеет aria-selected', () => {
    render(<TabBar activeTab="settings" onTabChange={() => {}} />);
    const settingsTab = screen.getByRole('tab', { name: /Настройки/i });
    expect(settingsTab).toHaveAttribute('aria-selected', 'true');
  });
});
