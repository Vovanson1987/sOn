/**
 * Генерация ключевой пары X25519 (Curve25519) через libsodium.js.
 * Реальная криптография — не mock.
 */

import sodium from 'libsodium-wrappers';

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  algorithm: 'X25519';
  created: string;
}

/** Убедиться что libsodium инициализирован */
let sodiumReady = false;
export async function ensureSodium(): Promise<void> {
  if (sodiumReady) return;
  await sodium.ready;
  sodiumReady = true;
}

/** Генерация ключевой пары X25519 (Curve25519) */
export async function generateKeyPair(): Promise<KeyPair> {
  await ensureSodium();
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: kp.publicKey,
    privateKey: kp.privateKey,
    algorithm: 'X25519',
    created: new Date().toISOString(),
  };
}

/** Конвертация Uint8Array в base64 (для отображения и хранения) */
export function toBase64(data: Uint8Array): string {
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

/** Конвертация base64 в Uint8Array */
export function fromBase64(str: string): Uint8Array {
  return sodium.from_base64(str, sodium.base64_variants.ORIGINAL);
}

/** Конвертация Uint8Array в hex */
export function toHex(data: Uint8Array): string {
  return sodium.to_hex(data);
}
