import { describe, it, expect, beforeEach } from 'vitest';
import { useSecretChatStore } from '../secretChatStore';

describe('secretChatStore', () => {
  beforeEach(() => {
    useSecretChatStore.setState({ sessions: {} });
  });

  it('инициализирует сессию с ключами', () => {
    const session = useSecretChatStore.getState().initSession('chat-secret-1');
    expect(session.chatId).toBe('chat-secret-1');
    expect(session.myKeys.algorithm).toBe('Curve25519');
    expect(session.theirKeys.algorithm).toBe('Curve25519');
    expect(session.x3dhResult.protocol).toBe('X3DH');
    expect(session.ratchetIndex).toBe(1);
    expect(session.isVerified).toBe(false);
    expect(session.selfDestructTimer).toBeNull();
    expect(session.emojiGrid.length).toBe(4);
    expect(session.hexFingerprint).toBeTruthy();
  });

  it('getSession возвращает сессию после инициализации', () => {
    useSecretChatStore.getState().initSession('chat-1');
    const session = useSecretChatStore.getState().getSession('chat-1');
    expect(session).toBeDefined();
    expect(session!.chatId).toBe('chat-1');
  });

  it('getSession возвращает undefined для несуществующей', () => {
    expect(useSecretChatStore.getState().getSession('xxx')).toBeUndefined();
  });

  it('advanceRatchet увеличивает ratchetIndex', () => {
    useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().advanceRatchet('chat-1');
    const session = useSecretChatStore.getState().getSession('chat-1')!;
    expect(session.ratchetIndex).toBe(2);
  });

  it('verifySession устанавливает isVerified = true', () => {
    useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().verifySession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')!.isVerified).toBe(true);
  });

  it('setSelfDestruct устанавливает таймер', () => {
    useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().setSelfDestruct('chat-1', 30);
    expect(useSecretChatStore.getState().getSession('chat-1')!.selfDestructTimer).toBe(30);
  });

  it('setSelfDestruct с null отключает таймер', () => {
    useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().setSelfDestruct('chat-1', 60);
    useSecretChatStore.getState().setSelfDestruct('chat-1', null);
    expect(useSecretChatStore.getState().getSession('chat-1')!.selfDestructTimer).toBeNull();
  });

  it('endSession удаляет сессию', () => {
    useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().endSession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')).toBeUndefined();
  });

  it('regenerateKeys создаёт новые ключи', () => {
    const old = useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().regenerateKeys('chat-1');
    const fresh = useSecretChatStore.getState().getSession('chat-1')!;
    expect(fresh.myKeys.publicKey).not.toBe(old.myKeys.publicKey);
  });
});
