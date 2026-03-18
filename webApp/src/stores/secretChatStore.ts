import { create } from 'zustand';
import { generateKeyPair, type KeyPair } from '@/crypto/keyPair';
import { performX3DH, type X3DHResult } from '@/crypto/x3dh';
import { ratchetStep, type RatchetState } from '@/crypto/doubleRatchet';
import { generateEmojiFingerprint, generateHexFingerprint } from '@/crypto/fingerprint';

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

  /** Инициализировать секретную сессию */
  initSession: (chatId: string) => SecretSession;
  /** Получить сессию */
  getSession: (chatId: string) => SecretSession | undefined;
  /** Выполнить шаг рэтчета */
  advanceRatchet: (chatId: string) => void;
  /** Подтвердить верификацию */
  verifySession: (chatId: string) => void;
  /** Установить таймер самоуничтожения */
  setSelfDestruct: (chatId: string, seconds: number | null) => void;
  /** Пересоздать ключи */
  regenerateKeys: (chatId: string) => void;
  /** Завершить секретный чат */
  endSession: (chatId: string) => void;
}

export const useSecretChatStore = create<SecretChatStore>((set, get) => ({
  sessions: {},

  initSession: (chatId) => {
    const myKeys = generateKeyPair();
    const myEphemeral = generateKeyPair();
    const theirKeys = generateKeyPair();
    const theirSpk = generateKeyPair();

    const x3dhResult = performX3DH(myKeys, myEphemeral, theirKeys, theirSpk);
    const ratchet = ratchetStep(x3dhResult.sharedSecret);

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

  advanceRatchet: (chatId) => {
    const session = get().sessions[chatId];
    if (!session) return;
    const newRatchet = ratchetStep(session.ratchet.nextChainKey);
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

  regenerateKeys: (chatId) => {
    const oldSession = get().sessions[chatId];
    if (!oldSession) return;
    // Пересоздаём сессию с новыми ключами
    get().endSession(chatId);
    get().initSession(chatId);
  },

  endSession: (chatId) => {
    set((s) => {
      const { [chatId]: _removed, ...rest } = s.sessions;
      void _removed; // Явное использование для удалённой сессии
      return { sessions: rest };
    });
  },
}));
