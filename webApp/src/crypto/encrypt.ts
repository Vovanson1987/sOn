/**
 * Шифрование/дешифрация через libsodium.js — XSalsa20-Poly1305 (secretbox).
 * Аналог AES-256-GCM по уровню безопасности, нативный для libsodium.
 *
 * secretbox = XSalsa20 (шифрование) + Poly1305 (аутентификация)
 * Ключ: 32 байта, Nonce: 24 байта
 */

import sodium from 'libsodium-wrappers';
import { ensureSodium, toBase64, fromBase64 } from './keyPair';

export interface EncryptedMessage {
  /** Зашифрованный текст + auth tag (base64) */
  ciphertext: string;
  /** Nonce (base64) */
  nonce: string;
  /** Алгоритм */
  algorithm: 'XSalsa20-Poly1305';
}

/** Шифрование сообщения */
export async function encryptMessage(plaintext: string, messageKey: Uint8Array): Promise<EncryptedMessage> {
  await ensureSodium();

  const nonce = new Uint8Array(sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES));
  const message = new Uint8Array(new TextEncoder().encode(plaintext));
  const key = new Uint8Array(messageKey);
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);

  return {
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce),
    algorithm: 'XSalsa20-Poly1305',
  };
}

/** Дешифрация сообщения */
export async function decryptMessage(encrypted: EncryptedMessage, messageKey: Uint8Array): Promise<string> {
  await ensureSodium();

  const ciphertext = new Uint8Array(fromBase64(encrypted.ciphertext));
  const nonce = new Uint8Array(fromBase64(encrypted.nonce));
  const key = new Uint8Array(messageKey);
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);

  return new TextDecoder().decode(decrypted);
}

/** Получить base64-представление зашифрованного текста (для tooltip) */
export function getEncryptedPreview(text: string): string {
  // Простое base64-кодирование для превью (не шифрование)
  try {
    return btoa(unescape(encodeURIComponent(text))).slice(0, 40) + '...';
  } catch {
    return text.slice(0, 20) + '...';
  }
}
