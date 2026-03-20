/**
 * Double Ratchet Algorithm через libsodium.js.
 * Полная реализация: симметричный рэтчет + DH-рэтчет.
 *
 * Симметричный рэтчет (KDF chain):
 *   message_key   = BLAKE2b(chain_key, 0x01)
 *   next_chain_key = BLAKE2b(chain_key, 0x02)
 *
 * DH-рэтчет (ротация ключей):
 *   При получении нового DH-ключа от собеседника:
 *   1. DH_out = X25519(my_private, their_public)
 *   2. root_key, recv_chain_key = KDF_RK(root_key, DH_out)
 *   3. Генерируем новую DH-пару
 *   4. DH_out = X25519(new_private, their_public)
 *   5. root_key, send_chain_key = KDF_RK(root_key, DH_out)
 */

import sodium from 'libsodium-wrappers';
import { ensureSodium, generateKeyPair, type KeyPair } from './keyPair';

/** Состояние Double Ratchet сессии */
export interface DoubleRatchetState {
  /** Корневой ключ (обновляется при DH-рэтчете) */
  rootKey: Uint8Array;
  /** Цепочный ключ отправки */
  sendChainKey: Uint8Array;
  /** Цепочный ключ получения */
  recvChainKey: Uint8Array | null;
  /** Наша текущая DH-пара (X25519) */
  dhKeyPair: KeyPair;
  /** Публичный DH-ключ собеседника */
  theirDhPublicKey: Uint8Array;
  /** Счётчик отправленных сообщений в текущей цепочке */
  sendCount: number;
  /** Счётчик полученных сообщений в текущей цепочке */
  recvCount: number;
  /** Номер предыдущей цепочки отправки */
  previousSendCount: number;
  /** Пропущенные ключи сообщений (для обработки out-of-order) */
  skippedKeys: Map<string, Uint8Array>;
}

/** Результат шага симметричного рэтчета */
export interface RatchetState {
  chainKey: Uint8Array;
  messageKey: Uint8Array;
  nextChainKey: Uint8Array;
  ratchetIndex: number;
}

/** Заголовок зашифрованного сообщения */
export interface MessageHeader {
  /** Публичный DH-ключ отправителя */
  dhPublicKey: Uint8Array;
  /** Номер предыдущей цепочки */
  previousCount: number;
  /** Номер сообщения в текущей цепочке */
  messageNumber: number;
}

const MAX_SKIP = 100; // Максимум пропущенных сообщений

/** HMAC через BLAKE2b с ключом */
function hmac(key: Uint8Array, data: Uint8Array): Uint8Array {
  return sodium.crypto_generichash(32, data, key);
}

/** X25519 Diffie-Hellman */
function dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return sodium.crypto_scalarmult(privateKey, publicKey);
}

/** KDF для корневого ключа: возвращает [новый root_key, новый chain_key] */
function kdfRootKey(rootKey: Uint8Array, dhOutput: Uint8Array): [Uint8Array, Uint8Array] {
  // BLAKE2b(rootKey, dhOutput) → 64 байта, разделяем на две половины
  const material = sodium.crypto_generichash(64, dhOutput, rootKey);
  return [material.slice(0, 32), material.slice(32, 64)];
}

/** KDF для цепочного ключа: возвращает [новый chain_key, message_key] */
function kdfChainKey(chainKey: Uint8Array): [Uint8Array, Uint8Array] {
  const messageKey = hmac(chainKey, new Uint8Array([0x01]));
  const nextChainKey = hmac(chainKey, new Uint8Array([0x02]));
  return [nextChainKey, messageKey];
}

/** Ключ для карты пропущенных сообщений */
function skippedKeyId(dhPublicKey: Uint8Array, messageNumber: number): string {
  return sodium.to_hex(dhPublicKey) + ':' + messageNumber;
}

/**
 * Инициализация Double Ratchet для инициатора (Alice).
 * Вызывается после X3DH с shared secret.
 */
export async function initSenderRatchet(
  sharedSecret: Uint8Array,
  theirDhPublicKey: Uint8Array,
): Promise<DoubleRatchetState> {
  await ensureSodium();

  // Генерируем начальную DH-пару
  const dhKeyPair = await generateKeyPair();

  // DH с ключом собеседника
  const dhOutput = dh(dhKeyPair.privateKey, theirDhPublicKey);

  // Вывод root_key и send_chain_key
  const [rootKey, sendChainKey] = kdfRootKey(sharedSecret, dhOutput);

  return {
    rootKey,
    sendChainKey,
    recvChainKey: null,
    dhKeyPair,
    theirDhPublicKey,
    sendCount: 0,
    recvCount: 0,
    previousSendCount: 0,
    skippedKeys: new Map(),
  };
}

/**
 * Инициализация Double Ratchet для ответчика (Bob).
 * Вызывается после X3DH с shared secret.
 */
export async function initReceiverRatchet(
  sharedSecret: Uint8Array,
  dhKeyPair: KeyPair,
): Promise<DoubleRatchetState> {
  await ensureSodium();

  return {
    rootKey: sharedSecret,
    sendChainKey: new Uint8Array(32), // Будет установлен при первом DH-рэтчете
    recvChainKey: null,
    dhKeyPair,
    theirDhPublicKey: new Uint8Array(32), // Будет получен от Alice
    sendCount: 0,
    recvCount: 0,
    previousSendCount: 0,
    skippedKeys: new Map(),
  };
}

/**
 * Шифрование сообщения — возвращает заголовок и ключ сообщения.
 * Вызывающий код шифрует content через encrypt.ts с этим messageKey.
 */
export function ratchetEncrypt(
  state: DoubleRatchetState,
): { header: MessageHeader; messageKey: Uint8Array; state: DoubleRatchetState } {
  // Симметричный рэтчет отправки
  const [nextSendChainKey, messageKey] = kdfChainKey(state.sendChainKey);

  const header: MessageHeader = {
    dhPublicKey: state.dhKeyPair.publicKey,
    previousCount: state.previousSendCount,
    messageNumber: state.sendCount,
  };

  const newState: DoubleRatchetState = {
    ...state,
    sendChainKey: nextSendChainKey,
    sendCount: state.sendCount + 1,
  };

  return { header, messageKey, state: newState };
}

/**
 * Дешифрация сообщения — возвращает ключ сообщения.
 * Если DH-ключ в заголовке отличается — выполняем DH-рэтчет.
 */
export async function ratchetDecrypt(
  state: DoubleRatchetState,
  header: MessageHeader,
): Promise<{ messageKey: Uint8Array; state: DoubleRatchetState }> {
  await ensureSodium();

  // 1. Проверить пропущенные ключи
  const keyId = skippedKeyId(header.dhPublicKey, header.messageNumber);
  const skippedKey = state.skippedKeys.get(keyId);
  if (skippedKey) {
    const newSkipped = new Map(state.skippedKeys);
    newSkipped.delete(keyId);
    return { messageKey: skippedKey, state: { ...state, skippedKeys: newSkipped } };
  }

  let currentState = { ...state, skippedKeys: new Map(state.skippedKeys) };

  // 2. Если DH-ключ изменился — выполнить DH-рэтчет
  if (!arraysEqual(header.dhPublicKey, currentState.theirDhPublicKey)) {
    // Сохранить пропущенные ключи из текущей recv-цепочки
    currentState = skipMessageKeys(currentState, header.previousCount);

    // DH-рэтчет: обновить recv-цепочку
    const dhOutput1 = dh(currentState.dhKeyPair.privateKey, header.dhPublicKey);
    const [rootKey1, recvChainKey] = kdfRootKey(currentState.rootKey, dhOutput1);
    currentState.rootKey = rootKey1;
    currentState.recvChainKey = recvChainKey;
    currentState.theirDhPublicKey = header.dhPublicKey;
    currentState.previousSendCount = currentState.sendCount;
    currentState.sendCount = 0;
    currentState.recvCount = 0;

    // Новая DH-пара для отправки
    const newDhKeyPair = await generateKeyPair();
    const dhOutput2 = dh(newDhKeyPair.privateKey, header.dhPublicKey);
    const [rootKey2, sendChainKey] = kdfRootKey(currentState.rootKey, dhOutput2);
    currentState.rootKey = rootKey2;
    currentState.sendChainKey = sendChainKey;
    currentState.dhKeyPair = newDhKeyPair;
  }

  // 3. Сохранить пропущенные ключи в recv-цепочке
  currentState = skipMessageKeys(currentState, header.messageNumber);

  // 4. Симметричный рэтчет получения
  if (!currentState.recvChainKey) {
    throw new Error('recvChainKey не инициализирован — невозможно расшифровать');
  }
  const [nextRecvChainKey, messageKey] = kdfChainKey(currentState.recvChainKey);
  currentState.recvChainKey = nextRecvChainKey;
  currentState.recvCount = currentState.recvCount + 1;

  return { messageKey, state: currentState };
}

/** Сохранить пропущенные ключи сообщений (для обработки out-of-order доставки) */
function skipMessageKeys(state: DoubleRatchetState, until: number): DoubleRatchetState {
  if (!state.recvChainKey) return state;
  if (until - state.recvCount > MAX_SKIP) {
    throw new Error('Превышен лимит пропущенных сообщений');
  }

  let chainKey = state.recvChainKey;
  let count = state.recvCount;
  const newSkipped = new Map(state.skippedKeys);

  while (count < until) {
    const [nextChainKey, messageKey] = kdfChainKey(chainKey);
    newSkipped.set(skippedKeyId(state.theirDhPublicKey, count), messageKey);
    chainKey = nextChainKey;
    count++;
  }

  return {
    ...state,
    recvChainKey: chainKey,
    recvCount: count,
    skippedKeys: newSkipped,
  };
}

/** Constant-time сравнение массивов (защита от timing side-channel) */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Обратная совместимость: простой шаг симметричного рэтчета */
export async function ratchetStep(chainKey: Uint8Array, index: number = 0): Promise<RatchetState> {
  await ensureSodium();
  const messageKey = hmac(chainKey, new Uint8Array([0x01]));
  const nextChainKey = hmac(chainKey, new Uint8Array([0x02]));
  return { chainKey, messageKey, nextChainKey, ratchetIndex: index + 1 };
}
