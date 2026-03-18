/**
 * Имитация генерации ключевой пары Curve25519.
 * В продакшене будет использоваться libsodium.js / Web Crypto API.
 */

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  algorithm: 'Curve25519';
  created: string;
}

/** Генерация случайных байтов в hex */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Генерация ключевой пары (Curve25519 mock) */
export function generateKeyPair(): KeyPair {
  return {
    publicKey: btoa(randomHex(32)),
    privateKey: btoa(randomHex(32)),
    algorithm: 'Curve25519',
    created: new Date().toISOString(),
  };
}
