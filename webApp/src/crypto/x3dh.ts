/**
 * Имитация протокола X3DH (Extended Triple Diffie-Hellman).
 * В продакшене: libsodium.js crypto_scalarmult для реального ECDH.
 */

import type { KeyPair } from './keyPair';

export interface X3DHResult {
  sharedSecret: string;
  protocol: 'X3DH';
  timestamp: number;
}

/** XOR двух строк (имитация DH) */
function xorStrings(a: string, b: string): string {
  const len = Math.min(a.length, b.length);
  let result = '';
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return result;
}

/** Имитация X3DH обмена ключами */
export function performX3DH(
  myIdentityKey: KeyPair,
  myEphemeralKey: KeyPair,
  theirIdentityKey: KeyPair,
  theirSignedPreKey: KeyPair,
): X3DHResult {
  // DH1 = DH(IKa, SPKb), DH2 = DH(EKa, IKb), DH3 = DH(EKa, SPKb)
  const dh1 = xorStrings(atob(myIdentityKey.privateKey), atob(theirSignedPreKey.publicKey));
  const dh2 = xorStrings(atob(myEphemeralKey.privateKey), atob(theirIdentityKey.publicKey));
  const dh3 = xorStrings(atob(myEphemeralKey.privateKey), atob(theirSignedPreKey.publicKey));

  const sharedSecret = btoa(dh1 + dh2 + dh3);

  return {
    sharedSecret,
    protocol: 'X3DH',
    timestamp: Date.now(),
  };
}
