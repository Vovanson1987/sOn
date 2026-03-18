import { create } from 'zustand';
import { generateKeyPair, type KeyPair } from '@/crypto/keyPair';
import { performX3DH, type X3DHResult } from '@/crypto/x3dh';
import { ratchetStep, type RatchetState } from '@/crypto/doubleRatchet';
import { generateEmojiFingerprint, generateHexFingerprint } from '@/crypto/fingerprint';
import { saveKeyPair, saveSharedSecret, deleteKeys } from '@/crypto/keyStore';

export interface SecretSession {
  chatId: string;
  myKeys: KeyPair;
  theirKeys: KeyPair;
  x3dhResult: X3DHResult;
  ratchet: RatchetState;
  ratchetIndex: number;
  isVerified: boolean;
  selfDestructTimer: number | null;
  sessionDate: string;
  emojiGrid: string[][];
  hexFingerprint: string;
}

interface SecretChatStore {
  sessions: Record<string, SecretSession>;

  /** Инициализировать секретную сессию (async — реальная криптография) */
  initSession: (chatId: string) => Promise<SecretSession>;
  /** Получить сессию */
  getSession: (chatId: string) => SecretSession | undefined;
  /** Выполнить шаг рэтчета */
  advanceRatchet: (chatId: string) => Promise<void>;
  /** Подтвердить верификацию */
  verifySession: (chatId: string) => void;
  /** Установить таймер самоуничтожения */
  setSelfDestruct: (chatId: string, seconds: number | null) => void;
  /** Пересоздать ключи */
  regenerateKeys: (chatId: string) => Promise<void>;
  /** Завершить секретный чат */
  endSession: (chatId: string) => void;
}

export const useSecretChatStore = create<SecretChatStore>((set, get) => ({
  sessions: {},

  initSession: async (chatId) => {
    // Реальная генерация ключей Curve25519 через libsodium
    const myKeys = await generateKeyPair();
    const myEphemeral = await generateKeyPair();
    // В продакшене: получить pre-key bundle собеседника с сервера
    const theirKeys = await generateKeyPair();
    const theirSpk = await generateKeyPair();

    // Реальный X3DH обмен через libsodium crypto_scalarmult
    const x3dhResult = await performX3DH(myKeys, myEphemeral, theirKeys, theirSpk);

    // Реальный Double Ratchet через BLAKE2b HMAC
    const ratchet = await ratchetStep(x3dhResult.sharedSecret);

    // Сохранить ключи в зашифрованное IndexedDB хранилище
    await saveKeyPair(chatId, myKeys).catch(() => {});
    await saveSharedSecret(chatId, x3dhResult.sharedSecret).catch(() => {});

    const session: SecretSession = {
      chatId,
      myKeys,
      theirKeys,
      x3dhResult,
      ratchet,
      ratchetIndex: 1,
      isVerified: false,
      selfDestructTimer: null,
      sessionDate: new Date().toISOString(),
      emojiGrid: generateEmojiFingerprint(myKeys.publicKey, theirKeys.publicKey),
      hexFingerprint: generateHexFingerprint(myKeys.publicKey, theirKeys.publicKey),
    };

    set((s) => ({ sessions: { ...s.sessions, [chatId]: session } }));
    return session;
  },

  getSession: (chatId) => get().sessions[chatId],

  advanceRatchet: async (chatId) => {
    const session = get().sessions[chatId];
    if (!session) return;
    const newRatchet = await ratchetStep(session.ratchet.nextChainKey, session.ratchetIndex);
    set((s) => ({
      sessions: {
        ...s.sessions,
        [chatId]: {
          ...session,
          ratchet: newRatchet,
          ratchetIndex: session.ratchetIndex + 1,
        },
      },
    }));
  },

  verifySession: (chatId) => {
    set((s) => {
      const session = s.sessions[chatId];
      if (!session) return s;
      return { sessions: { ...s.sessions, [chatId]: { ...session, isVerified: true } } };
    });
  },

  setSelfDestruct: (chatId, seconds) => {
    set((s) => {
      const session = s.sessions[chatId];
      if (!session) return s;
      return { sessions: { ...s.sessions, [chatId]: { ...session, selfDestructTimer: seconds } } };
    });
  },

  regenerateKeys: async (chatId) => {
    get().endSession(chatId);
    await get().initSession(chatId);
  },

  endSession: (chatId) => {
    // Удалить ключи из IndexedDB
    deleteKeys(chatId).catch(() => {});
    set((s) => {
      const { [chatId]: _removed, ...rest } = s.sessions;
      void _removed;
      return { sessions: rest };
    });
  },
}));
