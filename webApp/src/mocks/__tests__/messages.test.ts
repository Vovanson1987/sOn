import { describe, it, expect } from 'vitest';
import { mockMessages, vladimirMessages, secretAlexeyMessages, familyMessages, failedMessage } from '../messages';

describe('Моковые сообщения — целостность данных', () => {
  it('mockMessages содержит несколько чатов', () => {
    expect(Object.keys(mockMessages).length).toBeGreaterThanOrEqual(4);
  });

  it('все сообщения имеют обязательные поля', () => {
    Object.values(mockMessages).flat().forEach((msg) => {
      expect(msg.id).toBeTruthy();
      expect(msg.chatId).toBeTruthy();
      expect(msg.senderId).toBeTruthy();
      expect(msg.content).toBeTruthy();
      expect(msg.type).toBeTruthy();
      expect(msg.createdAt).toBeTruthy();
    });
  });

  it('ID сообщений уникальны внутри чата', () => {
    Object.values(mockMessages).forEach((msgs) => {
      const ids = msgs.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('чат с Vladimir содержит системное сообщение', () => {
    const sys = vladimirMessages.find((m) => m.type === 'system');
    expect(sys).toBeDefined();
    expect(sys?.content).toContain('заглушает уведомления');
  });

  it('секретный чат содержит плашку шифрования', () => {
    const banner = secretAlexeyMessages.find((m) => m.type === 'system' && m.content.includes('шифрованием'));
    expect(banner).toBeDefined();
  });

  it('секретный чат содержит уничтоженное сообщение', () => {
    const destroyed = secretAlexeyMessages.find((m) => m.isDestroyed);
    expect(destroyed).toBeDefined();
  });

  it('семейный чат содержит системное сообщение о создании', () => {
    const sys = familyMessages.find((m) => m.type === 'system');
    expect(sys?.content).toContain('Группа');
  });

  it('семейный чат содержит реакции', () => {
    const withReaction = familyMessages.find((m) => Object.keys(m.reactions).length > 0);
    expect(withReaction).toBeDefined();
    expect(withReaction?.reactions['❤️']?.length).toBeGreaterThan(0);
  });

  it('есть сообщение с ошибкой доставки', () => {
    expect(failedMessage.status).toBe('failed');
  });

  it('все даты парсятся корректно', () => {
    Object.values(mockMessages).flat().forEach((msg) => {
      expect(new Date(msg.createdAt).getTime()).not.toBeNaN();
    });
  });
});
