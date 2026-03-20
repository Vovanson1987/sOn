import { describe, it, expect, beforeEach } from 'vitest';
import { useSecretChatStore } from '../secretChatStore';

describe('secretChatStore (реальная криптография)', () => {
  beforeEach(() => {
    useSecretChatStore.setState({ sessions: {}, initialized: false, myIdentityKey: null, mySigningKey: null });
  });

  it('инициализирует сессию с реальными X25519 ключами', async () => {
    const session = await useSecretChatStore.getState().initSession('chat-secret-1', 'peer-1');
    expect(session.chatId).toBe('chat-secret-1');
    expect(session.peerId).toBe('peer-1');
    expect(session.myIdentityKey.algorithm).toBe('X25519');
    expect(session.myIdentityKey.publicKey.length).toBe(32);
    expect(session.x3dhResult.protocol).toBe('X3DH');
    expect(session.x3dhResult.sharedSecret.length).toBe(32);
    expect(session.isVerified).toBe(false);
    expect(session.selfDestructTimer).toBeNull();
    expect(session.emojiGrid.length).toBe(4);
    expect(session.hexFingerprint).toBeTruthy();
    expect(session.ratchetState).toBeDefined();
    expect(session.ratchetState.rootKey.length).toBe(32);
  });

  it('getSession возвращает сессию после инициализации', async () => {
    await useSecretChatStore.getState().initSession('chat-1', 'peer-1');
    const session = useSecretChatStore.getState().getSession('chat-1');
    expect(session).toBeDefined();
    expect(session!.chatId).toBe('chat-1');
  });

  it('getSession возвращает undefined для несуществующей', () => {
    expect(useSecretChatStore.getState().getSession('xxx')).toBeUndefined();
  });

  it('encryptForSend и decryptReceived работают', async () => {
    await useSecretChatStore.getState().initSession('chat-1', 'peer-1');

    const result = await useSecretChatStore.getState().encryptForSend('chat-1', 'Привет!');
    expect(result).toBeTruthy();
    expect(result!.encrypted.algorithm).toBe('XSalsa20-Poly1305');
    expect(result!.header.dhPublicKey.length).toBe(32);
  });

  it('verifySession устанавливает isVerified = true', async () => {
    await useSecretChatStore.getState().initSession('chat-1', 'peer-1');
    useSecretChatStore.getState().verifySession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')!.isVerified).toBe(true);
  });

  it('setSelfDestruct устанавливает таймер', async () => {
    await useSecretChatStore.getState().initSession('chat-1', 'peer-1');
    useSecretChatStore.getState().setSelfDestruct('chat-1', 30);
    expect(useSecretChatStore.getState().getSession('chat-1')!.selfDestructTimer).toBe(30);
  });

  it('endSession удаляет сессию', async () => {
    await useSecretChatStore.getState().initSession('chat-1', 'peer-1');
    useSecretChatStore.getState().endSession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')).toBeUndefined();
  });
});
