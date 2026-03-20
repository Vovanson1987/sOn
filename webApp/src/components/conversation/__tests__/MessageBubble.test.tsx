import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '@/types/message';

const baseMsg: Message = {
  id: 'msg-1', chatId: 'chat-1', senderId: 'user-2', senderName: 'Vladimir',
  content: 'Привет!', type: 'text', status: 'read',
  reactions: {}, isDestroyed: false, createdAt: '2026-03-18T10:00:00Z',
};

const ownMsg: Message = { ...baseMsg, id: 'msg-own', senderId: 'user-me', senderName: 'Владимир' };

describe('MessageBubble', () => {
  it('отображает текст сообщения', () => {
    render(<MessageBubble message={baseMsg} isOwn={false} isFirstInGroup isLastInGroup chatType="direct" />);
    expect(screen.getByText('Привет!')).toBeInTheDocument();
  });

  it('синий фон для исходящих iMessage', () => {
    const { container } = render(
      <MessageBubble message={ownMsg} isOwn isFirstInGroup isLastInGroup chatType="direct" />,
    );
    const bubble = container.querySelector('[style*="background"]');
    const style = bubble?.getAttribute('style') ?? '';
    // jsdom может конвертировать hex в rgb
    expect(style.includes('#007AFF') || style.includes('rgb(0, 122, 255)')).toBe(true);
  });

  it('серый фон для входящих', () => {
    const { container } = render(
      <MessageBubble message={baseMsg} isOwn={false} isFirstInGroup isLastInGroup chatType="direct" />,
    );
    const bubble = container.querySelector('[style*="background"]');
    const style = bubble?.getAttribute('style') ?? '';
    expect(style.includes('#3A3A3C') || style.includes('rgb(58, 58, 60)')).toBe(true);
  });

  it('зелёный фон для секретных исходящих', () => {
    const { container } = render(
      <MessageBubble message={ownMsg} isOwn isFirstInGroup isLastInGroup chatType="secret" />,
    );
    const bubble = container.querySelector('[style*="background"]');
    const style = bubble?.getAttribute('style') ?? '';
    expect(style.includes('#30D158') || style.includes('rgb(48, 209, 88)')).toBe(true);
  });

  it('показывает системное сообщение по центру', () => {
    const sysMsg: Message = {
      ...baseMsg, id: 'msg-sys', type: 'system', senderId: 'system',
      content: '🌙 Vladimir заглушает уведомления',
    };
    render(<MessageBubble message={sysMsg} isOwn={false} isFirstInGroup isLastInGroup chatType="direct" />);
    expect(screen.getByText('🌙 Vladimir заглушает уведомления')).toBeInTheDocument();
  });

  it('показывает уничтоженное сообщение', () => {
    const destroyed: Message = { ...baseMsg, isDestroyed: true };
    render(<MessageBubble message={destroyed} isOwn={false} isFirstInGroup isLastInGroup chatType="secret" />);
    expect(screen.getByText(/Сообщение удалено/)).toBeInTheDocument();
  });

  it('показывает реакции', () => {
    const withReaction: Message = { ...baseMsg, reactions: { '❤️': ['user-me'] } };
    render(<MessageBubble message={withReaction} isOwn={false} isFirstInGroup isLastInGroup chatType="direct" />);
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('показывает счётчик реакций при >1', () => {
    const withReactions: Message = { ...baseMsg, reactions: { '👍': ['user-1', 'user-2'] } };
    render(<MessageBubble message={withReactions} isOwn={false} isFirstInGroup isLastInGroup chatType="direct" />);
    expect(screen.getByText(/👍\s*2/)).toBeInTheDocument();
  });

  it('показывает имя отправителя в групповых чатах', () => {
    render(
      <MessageBubble message={baseMsg} isOwn={false} isFirstInGroup isLastInGroup chatType="group" showSenderName />,
    );
    expect(screen.getByText('Vladimir')).toBeInTheDocument();
  });

  it('не показывает имя для исходящих в группе', () => {
    render(
      <MessageBubble message={ownMsg} isOwn isFirstInGroup isLastInGroup chatType="group" showSenderName />,
    );
    expect(screen.queryByText('Владимир')).not.toBeInTheDocument();
  });

  it('иконка замка в секретных чатах', () => {
    const { container } = render(
      <MessageBubble message={baseMsg} isOwn={false} isFirstInGroup isLastInGroup chatType="secret" />,
    );
    const lockIcon = container.querySelector('svg');
    expect(lockIcon).toBeInTheDocument();
  });
});
