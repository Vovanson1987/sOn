/**
 * X3DH (Extended Triple Diffie-Hellman) через libsodium.js.
 * Полная реализация протокола Signal:
 *
 * Bob публикует prekey bundle: (IK_bob, SPK_bob, SPK_sig, [OPK_bob])
 * Alice выполняет:
 *   DH1 = X25519(IK_alice_private, SPK_bob_public)
 *   DH2 = X25519(EK_alice_private, IK_bob_public)
 *   DH3 = X25519(EK_alice_private, SPK_bob_public)
 *   DH4 = X25519(EK_alice_private, OPK_bob_public)  [если OPK доступен]
 *   SK  = HKDF(salt=0xFF*32, ikm=DH1||DH2||DH3[||DH4], info="sOn-X3DH")
 *
 * Верификация подписи SPK через Ed25519.
 */

import sodium from 'libsodium-wrappers';
import type { KeyPair } from './keyPair';
import { ensureSodium } from './keyPair';

/** Prekey bundle собеседника (получается с сервера) */
export interface PreKeyBundle {
  identityKey: Uint8Array;        // Публичный IK (X25519)
  signedPreKey: Uint8Array;       // Публичный SPK (X25519)
  signedPreKeySignature: Uint8Array; // Ed25519 подпись SPK
  signedPreKeyId: number;
  identitySigningKey: Uint8Array; // Публичный Ed25519 ключ для проверки подписи
  oneTimePreKey?: Uint8Array;     // Опциональный OPK
  oneTimePreKeyId?: number;
}

export interface X3DHResult {
  sharedSecret: Uint8Array;
  ephemeralPublicKey: Uint8Array; // Публичный EK для отправки собеседнику
  usedOneTimePreKeyId?: number;
  protocol: 'X3DH';
  timestamp: number;
}

/** Ed25519 ключевая пара для подписей */
export interface SigningKeyPair {
  publicKey: Uint8Array;  // 32 байта
  privateKey: Uint8Array; // 64 байта (Ed25519 secret key)
}

/** Генерация Ed25519 ключей для подписи */
export async function generateSigningKeyPair(): Promise<SigningKeyPair> {
  await ensureSodium();
  const kp = sodium.crypto_sign_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/** Подписать данные Ed25519 */
export async function signData(data: Uint8Array, signingPrivateKey: Uint8Array): Promise<Uint8Array> {
  await ensureSodium();
  return sodium.crypto_sign_detached(data, signingPrivateKey);
}

/** Проверить Ed25519 подпись */
export async function verifySignature(
  data: Uint8Array,
  signature: Uint8Array,
  signingPublicKey: Uint8Array,
): Promise<boolean> {
  await ensureSodium();
  return sodium.crypto_sign_verify_detached(signature, data, signingPublicKey);
}

/** Реальный X25519 Diffie-Hellman через libsodium */
function dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return sodium.crypto_scalarmult(privateKey, publicKey);
}

/** Конкатенация Uint8Array */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * HKDF через BLAKE2b (двухфазный: extract + expand).
 * salt: 32 байта 0xFF (стандарт Signal X3DH)
 * info: контекстная строка для разделения доменов
 */
function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number = 32): Uint8Array {
  // Extract: PRK = BLAKE2b(salt, ikm)
  const prk = sodium.crypto_generichash(32, ikm, salt);

  // Expand: OKM = BLAKE2b(PRK, info || 0x01)
  const expandInput = concat(info, new Uint8Array([0x01]));
  return sodium.crypto_generichash(length, expandInput, prk);
}

/**
 * Полный X3DH обмен ключами со стороны инициатора (Alice).
 * Верифицирует подпись SPK перед использованием.
 */
export async function performX3DH(
  myIdentityKey: KeyPair,
  myEphemeralKey: KeyPair,
  preKeyBundle: PreKeyBundle,
): Promise<X3DHResult> {
  await ensureSodium();

  // 1. Верификация подписи SPK
  const spkValid = sodium.crypto_sign_verify_detached(
    preKeyBundle.signedPreKeySignature,
    preKeyBundle.signedPreKey,
    preKeyBundle.identitySigningKey,
  );
  if (!spkValid) {
    throw new Error('Невалидная подпись Signed PreKey — возможна MITM-атака');
  }

  // 2. Три обязательных DH-операции
  const dh1 = dh(myIdentityKey.privateKey, preKeyBundle.signedPreKey);
  const dh2 = dh(myEphemeralKey.privateKey, preKeyBundle.identityKey);
  const dh3 = dh(myEphemeralKey.privateKey, preKeyBundle.signedPreKey);

  // 3. Опциональная четвёртая DH с One-Time PreKey
  let dhMaterial: Uint8Array;
  if (preKeyBundle.oneTimePreKey) {
    const dh4 = dh(myEphemeralKey.privateKey, preKeyBundle.oneTimePreKey);
    dhMaterial = concat(dh1, dh2, dh3, dh4);
  } else {
    dhMaterial = concat(dh1, dh2, dh3);
  }

  // 4. HKDF с фиксированной солью (32 × 0xFF) и контекстной строкой
  const salt = new Uint8Array(32).fill(0xFF);
  const info = new TextEncoder().encode('sOn-X3DH');
  const sharedSecret = hkdf(dhMaterial, salt, info);

  return {
    sharedSecret,
    ephemeralPublicKey: myEphemeralKey.publicKey,
    usedOneTimePreKeyId: preKeyBundle.oneTimePreKeyId,
    protocol: 'X3DH',
    timestamp: Date.now(),
  };
}

/**
 * X3DH со стороны ответчика (Bob).
 * Bob получает initial message с EK_alice и выполняет зеркальные DH.
 */
export async function respondX3DH(
  myIdentityKey: KeyPair,
  mySignedPreKey: KeyPair,
  theirIdentityKey: Uint8Array,
  theirEphemeralKey: Uint8Array,
  myOneTimePreKey?: KeyPair,
): Promise<Uint8Array> {
  await ensureSodium();

  // Зеркальные DH-операции
  const dh1 = dh(mySignedPreKey.privateKey, theirIdentityKey);
  const dh2 = dh(myIdentityKey.privateKey, theirEphemeralKey);
  const dh3 = dh(mySignedPreKey.privateKey, theirEphemeralKey);

  let dhMaterial: Uint8Array;
  if (myOneTimePreKey) {
    const dh4 = dh(myOneTimePreKey.privateKey, theirEphemeralKey);
    dhMaterial = concat(dh1, dh2, dh3, dh4);
  } else {
    dhMaterial = concat(dh1, dh2, dh3);
  }

  const salt = new Uint8Array(32).fill(0xFF);
  const info = new TextEncoder().encode('sOn-X3DH');
  return hkdf(dhMaterial, salt, info);
}
