import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSecretChatStore } from '../secretChatStore';

// Мок API для prekey bundle
vi.mock('@/api/client', () => ({
  getToken: vi.fn(() => 'test-token'),
  uploadPreKeyBundle: vi.fn(() => Promise.resolve({ ok: true })),
  // Мок prekey bundle — вернём валидные base64-закодированные 32-байтные ключи
  getPreKeyBundle: vi.fn(() => Promise.reject(new Error('сервер недоступен'))),
}));

// Мок IndexedDB операций
vi.mock('@/crypto/keyStore', () => ({
  saveKeyPair: vi.fn(() => Promise.resolve()),
  saveSharedSecret: vi.fn(() => Promise.resolve()),
  deleteKeys: vi.fn(() => Promise.resolve()),
  saveSessionMeta: vi.fn(() => Promise.resolve()),
  loadSessionMeta: vi.fn(() => Promise.resolve(null)),
  loadAllSessionChatIds: vi.fn(() => Promise.resolve([])),
  loadKeyPair: vi.fn(() => Promise.resolve(null)),
  loadSharedSecret: vi.fn(() => Promise.resolve(null)),
  loadRatchetState: vi.fn(() => Promise.resolve(null)),
  saveRatchetState: vi.fn(() => Promise.resolve()),
}));

describe('secretChatStore', () => {
  beforeEach(() => {
    useSecretChatStore.setState({ sessions: {}, initialized: false, myIdentityKey: null, mySigningKey: null });
  });

  it('getSession возвращает undefined для несуществующей', () => {
    expect(useSecretChatStore.getState().getSession('xxx')).toBeUndefined();
  });

  it('initSession бросает ошибку без сервера (убран fallback)', async () => {
    await expect(
      useSecretChatStore.getState().initSession('chat-1', 'peer-1'),
    ).rejects.toThrow('Невозможно установить защищённый канал');
  });

  it('verifySession не падает для несуществующей сессии', () => {
    useSecretChatStore.getState().verifySession('nonexistent');
    expect(useSecretChatStore.getState().getSession('nonexistent')).toBeUndefined();
  });

  it('setSelfDestruct не падает для несуществующей сессии', () => {
    useSecretChatStore.getState().setSelfDestruct('nonexistent', 30);
    expect(useSecretChatStore.getState().getSession('nonexistent')).toBeUndefined();
  });

  it('endSession удаляет сессию', () => {
    // Вручную добавим сессию
    useSecretChatStore.setState({
      sessions: {
        'chat-1': {
          chatId: 'chat-1',
          peerId: 'peer-1',
          isVerified: false,
          selfDestructTimer: null,
          sessionDate: new Date().toISOString(),
          emojiGrid: [['🐶', '🌺', '🎸', '🚀']],
          hexFingerprint: 'A1B2',
        } as never,
      },
    });

    useSecretChatStore.getState().endSession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')).toBeUndefined();
  });

  it('verifySession устанавливает isVerified = true', () => {
    useSecretChatStore.setState({
      sessions: {
        'chat-1': {
          chatId: 'chat-1',
          peerId: 'peer-1',
          isVerified: false,
          selfDestructTimer: null,
        } as never,
      },
    });

    useSecretChatStore.getState().verifySession('chat-1');
    expect(useSecretChatStore.getState().getSession('chat-1')!.isVerified).toBe(true);
  });

  it('setSelfDestruct устанавливает таймер', () => {
    useSecretChatStore.setState({
      sessions: {
        'chat-1': {
          chatId: 'chat-1',
          peerId: 'peer-1',
          isVerified: false,
          selfDestructTimer: null,
        } as never,
      },
    });

    useSecretChatStore.getState().setSelfDestruct('chat-1', 30);
    expect(useSecretChatStore.getState().getSession('chat-1')!.selfDestructTimer).toBe(30);
  });

  it('encryptForSend возвращает null для несуществующей сессии', async () => {
    const result = await useSecretChatStore.getState().encryptForSend('nonexistent', 'test');
    expect(result).toBeNull();
  });

  it('decryptReceived возвращает null для несуществующей сессии', async () => {
    const result = await useSecretChatStore.getState().decryptReceived(
      'nonexistent',
      { ciphertext: '', nonce: '', algorithm: 'XSalsa20-Poly1305' } as never,
      { dhPublicKey: new Uint8Array(32), previousCount: 0, messageNumber: 0 },
    );
    expect(result).toBeNull();
  });
});
