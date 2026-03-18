/**
 * X3DH (Extended Triple Diffie-Hellman) через libsodium.js.
 * Реальный Curve25519 ECDH — не mock.
 *
 * Протокол:
 * DH1 = X25519(IK_alice_private, SPK_bob_public)
 * DH2 = X25519(EK_alice_private, IK_bob_public)
 * DH3 = X25519(EK_alice_private, SPK_bob_public)
 * SK = HKDF(DH1 || DH2 || DH3)
 */

import sodium from 'libsodium-wrappers';
import type { KeyPair } from './keyPair';
import { ensureSodium } from './keyPair';

export interface X3DHResult {
  sharedSecret: Uint8Array;
  protocol: 'X3DH';
  timestamp: number;
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

/** Реальный X3DH обмен ключами */
export async function performX3DH(
  myIdentityKey: KeyPair,
  myEphemeralKey: KeyPair,
  theirIdentityKey: KeyPair,
  theirSignedPreKey: KeyPair,
): Promise<X3DHResult> {
  await ensureSodium();

  // Три DH-операции по протоколу Signal X3DH
  const dh1 = dh(myIdentityKey.privateKey, theirSignedPreKey.publicKey);
  const dh2 = dh(myEphemeralKey.privateKey, theirIdentityKey.publicKey);
  const dh3 = dh(myEphemeralKey.privateKey, theirSignedPreKey.publicKey);

  // Объединяем результаты DH
  const dhMaterial = concat(dh1, dh2, dh3);

  // HKDF: извлекаем 32-байтный shared secret через BLAKE2b
  const sharedSecret = sodium.crypto_generichash(32, dhMaterial);

  return {
    sharedSecret,
    protocol: 'X3DH',
    timestamp: Date.now(),
  };
}
