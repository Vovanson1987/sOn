import { describe, it, expect, beforeEach } from 'vitest';
import { useSecretChatStore } from '../secretChatStore';
import { toBase64 } from '@/crypto/keyPair';

describe('secretChatStore (реальная криптография)', () => {
  beforeEach(() => {
    useSecretChatStore.setState({ sessions: {} });
  });

  it('инициализирует сессию с реальными X25519 ключами', async () => {
    const session = await useSecretChatStore.getState().initSession('chat-secret-1');
    expect(session.chatId).toBe('chat-secret-1');
    expect(session.myKeys.algorithm).toBe('X25519');
    expect(session.myKeys.publicKey.length).toBe(32);
    expect(session.theirKeys.algorithm).toBe('X25519');
    expect(session.x3dhResult.protocol).toBe('X3DH');
    expect(session.x3dhResult.sharedSecret.length).toBe(32);
    expect(session.ratchetIndex).toBe(1);
    expect(session.isVerified).toBe(false);
    expect(session.selfDestructTimer).toBeNull();
    expect(session.emojiGrid.length).toBe(4);
    expect(session.hexFingerprint).toBeTruthy();
  });

  it('getSession возвращает сессию после инициализации', async () => {
    await useSecretChatStore.getState().initSession('chat-1');
    const session = useSecretChatStore.getState().getSession('chat-1');
    expect(session).toBeDefined();
    expect(session!.chatId).toBe('chat-1');
  });

  it('getSession возвращает undefined для несуществующей', () => {
    expect(useSecretChatStore.getState().getSession('xxx')).toBeUndefined();
  });

  it('advanceRatchet увеличивает ratchetIndex', async () => {
    await useSecretChatStore.getState().initSession('chat-1');
    await useSecretChatStore.getState().advanceRatchet('chat-1');
    const session = useSecretChatStore.getState().getSession('chat-1')!;
    expect(session.ratchetIndex).toBe(2);
  });

  it('verifySession устанавливает isVerified = true', async () => {
    await useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().verifySession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')!.isVerified).toBe(true);
  });

  it('setSelfDestruct устанавливает таймер', async () => {
    await useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().setSelfDestruct('chat-1', 30);
    expect(useSecretChatStore.getState().getSession('chat-1')!.selfDestructTimer).toBe(30);
  });

  it('endSession удаляет сессию', async () => {
    await useSecretChatStore.getState().initSession('chat-1');
    useSecretChatStore.getState().endSession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')).toBeUndefined();
  });

  it('regenerateKeys создаёт новые ключи', async () => {
    const old = await useSecretChatStore.getState().initSession('chat-1');
    const oldPublic = toBase64(old.myKeys.publicKey);
    await useSecretChatStore.getState().regenerateKeys('chat-1');
    const fresh = useSecretChatStore.getState().getSession('chat-1')!;
    expect(toBase64(fresh.myKeys.publicKey)).not.toBe(oldPublic);
  });
});
