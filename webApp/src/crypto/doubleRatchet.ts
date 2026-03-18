/**
 * Double Ratchet Algorithm через libsodium.js.
 * Реальный HMAC (BLAKE2b) для KDF — не mock.
 *
 * Симметричный рэтчет:
 * message_key = HMAC(chain_key, 0x01)
 * next_chain_key = HMAC(chain_key, 0x02)
 */

import sodium from 'libsodium-wrappers';
import { ensureSodium } from './keyPair';

export interface RatchetState {
  chainKey: Uint8Array;
  messageKey: Uint8Array;
  nextChainKey: Uint8Array;
  ratchetIndex: number;
}

/** HMAC через BLAKE2b (libsodium crypto_generichash с ключом) */
function hmac(key: Uint8Array, data: Uint8Array): Uint8Array {
  return sodium.crypto_generichash(32, data, key);
}

/** Один шаг симметричного рэтчета — генерация ключа сообщения и обновление цепочки */
export async function ratchetStep(chainKey: Uint8Array, index: number = 0): Promise<RatchetState> {
  await ensureSodium();

  // MK = HMAC(CK, 0x01) — ключ для шифрования сообщения
  const messageKey = hmac(chainKey, new Uint8Array([0x01]));

  // CK_new = HMAC(CK, 0x02) — следующий ключ цепочки
  const nextChainKey = hmac(chainKey, new Uint8Array([0x02]));

  return {
    chainKey,
    messageKey,
    nextChainKey,
    ratchetIndex: index + 1,
  };
}
