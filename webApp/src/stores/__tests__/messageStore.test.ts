import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '../messageStore';
import type { Message } from '@/types/message';

const seedMessage: Message = {
  id: 'msg-seed-1', chatId: 'chat-vladimir', senderId: 'user-vladimir',
  senderName: 'Vladimir', content: 'Тестовое сообщение', type: 'text',
  status: 'read', reactions: {}, isDestroyed: false,
  createdAt: '2026-03-18T10:00:00Z',
};

describe('messageStore', () => {
  beforeEach(() => {
    // Сбросить и засеять тестовые данные
    useMessageStore.setState({
      messages: { 'chat-vladimir': [seedMessage] },
      typingUsers: {},
      loadedChats: new Set(),
    });
  });

  describe('getMessages', () => {
    it('возвращает сообщения для существующего чата', () => {
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      expect(msgs.length).toBeGreaterThan(0);
    });

    it('возвращает пустой массив для несуществующего чата', () => {
      const msgs = useMessageStore.getState().getMessages('chat-nonexistent');
      expect(msgs).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('добавляет новое сообщение в чат', () => {
      const before = useMessageStore.getState().getMessages('chat-vladimir').length;
      useMessageStore.getState().sendMessage('chat-vladimir', 'Тестовое сообщение');
      const after = useMessageStore.getState().getMessages('chat-vladimir').length;
      expect(after).toBe(before + 1);
    });

    it('новое сообщение имеет правильные поля', () => {
      useMessageStore.getState().sendMessage('chat-vladimir', 'Привет');
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      const last = msgs[msgs.length - 1];
      expect(last.content).toBe('Привет');
      expect(last.type).toBe('text');
      // Статус начинается с 'sending' (оптимистичное добавление)
      expect(['sending', 'sent', 'failed']).toContain(last.status);
    });

    it('создаёт сообщение в новом чате', () => {
      useMessageStore.getState().sendMessage('chat-new', 'Первое сообщение');
      const msgs = useMessageStore.getState().getMessages('chat-new');
      expect(msgs.length).toBe(1);
      expect(msgs[0].content).toBe('Первое сообщение');
    });

    it('оптимистично добавляет сообщение со статусом sending', () => {
      useMessageStore.getState().sendMessage('chat-vladimir', 'Тест доставки');
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      const last = msgs[msgs.length - 1];
      // Оптимистичное добавление — статус sending
      expect(last.status).toBe('sending');
      expect(last.content).toBe('Тест доставки');
    });
  });

  describe('addMessage', () => {
    it('добавляет входящее сообщение', () => {
      const msg = {
        id: 'msg-incoming', chatId: 'chat-vladimir', senderId: 'user-vladimir',
        senderName: 'Vladimir', content: 'Входящее', type: 'text' as const,
        status: 'delivered' as const, reactions: {}, isDestroyed: false,
        createdAt: new Date().toISOString(),
      };
      useMessageStore.getState().addMessage('chat-vladimir', msg);
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      expect(msgs.find((m) => m.id === 'msg-incoming')).toBeDefined();
    });
  });

  describe('deleteMessage', () => {
    it('удаляет сообщение по id', () => {
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      const firstId = msgs[0].id;
      useMessageStore.getState().deleteMessage('chat-vladimir', firstId);
      const updated = useMessageStore.getState().getMessages('chat-vladimir');
      expect(updated.find((m) => m.id === firstId)).toBeUndefined();
    });
  });

  describe('addReaction', () => {
    it('добавляет реакцию на сообщение', () => {
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      const msgId = msgs[0].id;
      useMessageStore.getState().addReaction('chat-vladimir', msgId, '❤️', 'user-me');
      const updated = useMessageStore.getState().getMessages('chat-vladimir');
      const msg = updated.find((m) => m.id === msgId);
      expect(msg?.reactions['❤️']).toContain('user-me');
    });

    it('убирает реакцию при повторном нажатии', () => {
      const msgs = useMessageStore.getState().getMessages('chat-vladimir');
      const msgId = msgs[0].id;
      useMessageStore.getState().addReaction('chat-vladimir', msgId, '👍', 'user-me');
      useMessageStore.getState().addReaction('chat-vladimir', msgId, '👍', 'user-me');
      const updated = useMessageStore.getState().getMessages('chat-vladimir');
      const msg = updated.find((m) => m.id === msgId);
      expect(msg?.reactions['👍'] ?? []).not.toContain('user-me');
    });
  });

  describe('typing', () => {
    it('setTyping добавляет пользователя', () => {
      useMessageStore.getState().setTyping('chat-vladimir', 'Vladimir');
      const typing = useMessageStore.getState().typingUsers['chat-vladimir'];
      expect(typing).toContain('Vladimir');
    });

    it('setTyping не дублирует', () => {
      useMessageStore.getState().setTyping('chat-vladimir', 'Vladimir');
      useMessageStore.getState().setTyping('chat-vladimir', 'Vladimir');
      const typing = useMessageStore.getState().typingUsers['chat-vladimir'];
      expect(typing?.filter((n) => n === 'Vladimir').length).toBe(1);
    });

    it('clearTyping убирает пользователя', () => {
      useMessageStore.getState().setTyping('chat-vladimir', 'Vladimir');
      useMessageStore.getState().clearTyping('chat-vladimir', 'Vladimir');
      const typing = useMessageStore.getState().typingUsers['chat-vladimir'];
      expect(typing ?? []).not.toContain('Vladimir');
    });
  });
});
