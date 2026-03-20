import { create } from 'zustand';
import { generateKeyPair, toBase64, fromBase64, type KeyPair } from '@/crypto/keyPair';
import {
  performX3DH,
  generateSigningKeyPair, signData,
  type PreKeyBundle, type X3DHResult, type SigningKeyPair,
} from '@/crypto/x3dh';
import {
  initSenderRatchet, ratchetEncrypt, ratchetDecrypt,
  type DoubleRatchetState, type MessageHeader,
} from '@/crypto/doubleRatchet';
import { encryptMessage, decryptMessage, type EncryptedMessage } from '@/crypto/encrypt';
import { generateEmojiFingerprint, generateHexFingerprint } from '@/crypto/fingerprint';
import {
  saveKeyPair, saveSharedSecret, deleteKeys,
  saveSessionMeta, loadSessionMeta, loadAllSessionChatIds,
  loadKeyPair, loadSharedSecret, loadRatchetState, saveRatchetState,
} from '@/crypto/keyStore';
import * as api from '@/api/client';

export interface SecretSession {
  chatId: string;
  peerId: string;
  myIdentityKey: KeyPair;
  mySigningKey: SigningKeyPair;
  x3dhResult: X3DHResult;
  ratchetState: DoubleRatchetState;
  isVerified: boolean;
  selfDestructTimer: number | null;
  sessionDate: string;
  emojiGrid: string[][];
  hexFingerprint: string;
}

interface SecretChatStore {
  sessions: Record<string, SecretSession>;
  myIdentityKey: KeyPair | null;
  mySigningKey: SigningKeyPair | null;
  initialized: boolean;

  /** Инициализировать собственные ключи и загрузить prekey bundle на сервер */
  initialize: () => Promise<void>;
  /** Инициализировать секретную сессию с собеседником через prekey bundle */
  initSession: (chatId: string, peerId: string) => Promise<SecretSession>;
  /** Получить сессию */
  getSession: (chatId: string) => SecretSession | undefined;
  /** Зашифровать сообщение для отправки */
  encryptForSend: (chatId: string, plaintext: string) => Promise<{ encrypted: EncryptedMessage; header: MessageHeader } | null>;
  /** Расшифровать полученное сообщение */
  decryptReceived: (chatId: string, encrypted: EncryptedMessage, header: MessageHeader) => Promise<string | null>;
  /** Подтвердить верификацию */
  verifySession: (chatId: string) => void;
  /** Установить таймер самоуничтожения */
  setSelfDestruct: (chatId: string, seconds: number | null) => void;
  /** Завершить секретный чат */
  endSession: (chatId: string) => void;
  /** HI-11: Восстановить сессии из IndexedDB при загрузке */
  restoreSessions: () => Promise<void>;
}

/** Количество OPK для генерации */
const OPK_BATCH_SIZE = 20;

export const useSecretChatStore = create<SecretChatStore>((set, get) => ({
  sessions: {},
  myIdentityKey: null,
  mySigningKey: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    // Генерируем Identity Key (X25519) и Signing Key (Ed25519)
    const identityKey = await generateKeyPair();
    const signingKey = await generateSigningKeyPair();

    // Генерируем Signed PreKey
    const signedPreKey = await generateKeyPair();
    const spkSignature = await signData(signedPreKey.publicKey, signingKey.privateKey);

    // Генерируем пачку One-Time PreKeys
    const otpks: Array<{ key_id: number; public_key: string }> = [];
    for (let i = 0; i < OPK_BATCH_SIZE; i++) {
      const otpk = await generateKeyPair();
      otpks.push({ key_id: i, public_key: toBase64(otpk.publicKey) });
      // Сохраняем приватный ключ OPK в IndexedDB
      await saveKeyPair(`otpk:${i}`, otpk).catch(() => {});
    }

    // Загружаем prekey bundle на сервер
    try {
      await api.uploadPreKeyBundle({
        identity_key: toBase64(identityKey.publicKey),
        signing_key: toBase64(signingKey.publicKey),
        signed_prekey: toBase64(signedPreKey.publicKey),
        signed_prekey_id: 1,
        signed_prekey_signature: toBase64(spkSignature),
        one_time_prekeys: otpks,
      });
    } catch {
      // Сервер недоступен — работаем оффлайн
    }

    // Сохранить ключи
    await saveKeyPair('identity', identityKey).catch(() => {});
    await saveKeyPair('spk:1', signedPreKey).catch(() => {});

    set({
      myIdentityKey: identityKey,
      mySigningKey: signingKey,
      initialized: true,
    });
  },

  initSession: async (chatId, peerId) => {
    try {
      const state = get();
      if (!state.myIdentityKey || !state.mySigningKey) {
        await get().initialize();
      }

      const myIdentityKey = get().myIdentityKey!;
      const mySigningKey = get().mySigningKey!;

      // Получить prekey bundle собеседника с сервера
      let preKeyBundle: PreKeyBundle;
      try {
        const raw = await api.getPreKeyBundle(peerId);
        preKeyBundle = {
          identityKey: fromBase64(raw.identity_key),
          signedPreKey: fromBase64(raw.signed_prekey),
          signedPreKeySignature: fromBase64(raw.signed_prekey_signature),
          signedPreKeyId: raw.signed_prekey_id,
          identitySigningKey: fromBase64(raw.signing_key),
          oneTimePreKey: raw.one_time_prekey ? fromBase64(raw.one_time_prekey) : undefined,
          oneTimePreKeyId: raw.one_time_prekey_id,
        };
      } catch {
        throw new Error('Невозможно установить защищённый канал — сервер недоступен');
      }

      // X3DH обмен ключами
      const myEphemeral = await generateKeyPair();
      const x3dhResult = await performX3DH(myIdentityKey, myEphemeral, preKeyBundle);

      // Инициализация Double Ratchet
      const ratchetState = await initSenderRatchet(x3dhResult.sharedSecret, preKeyBundle.signedPreKey);

      // Сохранить ключи
      await saveKeyPair(chatId, myIdentityKey).catch(() => {});
      await saveSharedSecret(chatId, x3dhResult.sharedSecret).catch(() => {});

      // Генерация fingerprint
      const emojiGrid = await generateEmojiFingerprint(myIdentityKey.publicKey, preKeyBundle.identityKey);
      const hexFingerprint = await generateHexFingerprint(myIdentityKey.publicKey, preKeyBundle.identityKey);

      const session: SecretSession = {
        chatId,
        peerId,
        myIdentityKey,
        mySigningKey,
        x3dhResult,
        ratchetState,
        isVerified: false,
        selfDestructTimer: null,
        sessionDate: new Date().toISOString(),
        emojiGrid,
        hexFingerprint,
      };

      set((s) => ({ sessions: { ...s.sessions, [chatId]: session } }));

      // HI-11: Persist session metadata + ratchet state
      await saveSessionMeta(chatId, {
        chatId, peerId,
        isVerified: false,
        selfDestructTimer: null,
        sessionDate: session.sessionDate,
        emojiGrid, hexFingerprint,
      }).catch(() => {});
      await saveRatchetState(chatId, session.ratchetState as unknown as Record<string, unknown>).catch(() => {});

      return session;
    } catch (error) {
      console.error('[secretChatStore] initSession failed:', error);
      throw error;
    }
  },

  getSession: (chatId) => get().sessions[chatId],

  encryptForSend: async (chatId, plaintext) => {
    const session = get().sessions[chatId];
    if (!session) return null;

    // Шаг рэтчета + получение ключа сообщения
    const { header, messageKey, state: newState } = ratchetEncrypt(session.ratchetState);

    // Шифрование контента
    const encrypted = await encryptMessage(plaintext, messageKey);

    // Обновить состояние (используем свежую сессию из store, не захваченную)
    set((s) => ({
      sessions: {
        ...s.sessions,
        [chatId]: { ...s.sessions[chatId], ratchetState: newState },
      },
    }));

    // HI-11: Persist updated ratchet state
    saveRatchetState(chatId, newState as unknown as Record<string, unknown>).catch(() => {});

    return { encrypted, header };
  },

  decryptReceived: async (chatId, encrypted, header) => {
    const session = get().sessions[chatId];
    if (!session) return null;

    try {
      // Получить ключ через DH/симметричный рэтчет
      const { messageKey, state: newState } = await ratchetDecrypt(session.ratchetState, header);

      // Дешифрация контента
      const plaintext = await decryptMessage(encrypted, messageKey);

      // Обновить состояние (используем свежую сессию из store)
      set((s) => ({
        sessions: {
          ...s.sessions,
          [chatId]: { ...s.sessions[chatId], ratchetState: newState },
        },
      }));

      // HI-11: Persist updated ratchet state
      saveRatchetState(chatId, newState as unknown as Record<string, unknown>).catch(() => {});

      return plaintext;
    } catch {
      return null;
    }
  },

  verifySession: (chatId) => {
    set((s) => {
      const session = s.sessions[chatId];
      if (!session) return s;
      return { sessions: { ...s.sessions, [chatId]: { ...session, isVerified: true } } };
    });
    // HI-11: Persist verification status
    const session = get().sessions[chatId];
    if (session) {
      saveSessionMeta(chatId, {
        chatId, peerId: session.peerId,
        isVerified: true,
        selfDestructTimer: session.selfDestructTimer,
        sessionDate: session.sessionDate,
        emojiGrid: session.emojiGrid,
        hexFingerprint: session.hexFingerprint,
      }).catch(() => {});
    }
  },

  setSelfDestruct: (chatId, seconds) => {
    set((s) => {
      const session = s.sessions[chatId];
      if (!session) return s;
      return { sessions: { ...s.sessions, [chatId]: { ...session, selfDestructTimer: seconds } } };
    });
    // HI-11: Persist self-destruct timer
    const session = get().sessions[chatId];
    if (session) {
      saveSessionMeta(chatId, {
        chatId, peerId: session.peerId,
        isVerified: session.isVerified,
        selfDestructTimer: seconds,
        sessionDate: session.sessionDate,
        emojiGrid: session.emojiGrid,
        hexFingerprint: session.hexFingerprint,
      }).catch(() => {});
    }
  },

  endSession: (chatId) => {
    deleteKeys(chatId).catch(() => {});
    set((s) => {
      const { [chatId]: _removed, ...rest } = s.sessions;
      void _removed;
      return { sessions: rest };
    });
  },

  restoreSessions: async () => {
    try {
      const chatIds = await loadAllSessionChatIds();
      const sessions: Record<string, SecretSession> = {};

      for (const chatId of chatIds) {
        try {
          const meta = await loadSessionMeta(chatId);
          if (!meta) continue;

          const identityKey = await loadKeyPair(chatId);
          const sharedSecret = await loadSharedSecret(chatId);
          const ratchetState = await loadRatchetState(chatId);

          if (!identityKey || !sharedSecret || !ratchetState) continue;

          sessions[chatId] = {
            chatId,
            peerId: meta.peerId as string,
            myIdentityKey: identityKey,
            mySigningKey: get().mySigningKey || { publicKey: new Uint8Array(32), privateKey: new Uint8Array(64) },
            x3dhResult: { sharedSecret, ephemeralPublicKey: new Uint8Array(32) },
            ratchetState: ratchetState as unknown as DoubleRatchetState,
            isVerified: meta.isVerified as boolean || false,
            selfDestructTimer: meta.selfDestructTimer as number | null,
            sessionDate: meta.sessionDate as string,
            emojiGrid: meta.emojiGrid as string[][],
            hexFingerprint: meta.hexFingerprint as string,
          };
        } catch {
          // Пропускаем повреждённые сессии
        }
      }

      if (Object.keys(sessions).length > 0) {
        set((s) => ({ sessions: { ...s.sessions, ...sessions } }));
      }
    } catch (err) {
      console.error('[secretChatStore] restoreSessions failed:', err);
    }
  },
}));
