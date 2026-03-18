/**
 * Имитация шифрования/дешифрации AES-256-GCM.
 * В продакшене: Web Crypto API / libsodium.js.
 */

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  algorithm: 'AES-256-GCM';
  authTag: string;
}

/** Генерация IV (12 байт) */
function generateIV(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** XOR-шифр (упрощённая имитация) */
function xorCipher(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/** Шифрование сообщения (AES-256-GCM mock) */
export function encryptMessage(plaintext: string, messageKey: string): EncryptedMessage {
  const iv = generateIV();
  const encrypted = xorCipher(plaintext, messageKey);
  return {
    ciphertext: btoa(encrypted),
    iv: btoa(iv),
    algorithm: 'AES-256-GCM',
    authTag: btoa(messageKey.slice(0, 16)),
  };
}

/** Дешифрация сообщения */
export function decryptMessage(encrypted: EncryptedMessage, messageKey: string): string {
  return xorCipher(atob(encrypted.ciphertext), messageKey);
}

/** Получить base64-представление зашифрованного текста (для tooltip) */
export function getEncryptedPreview(text: string): string {
  return btoa(unescape(encodeURIComponent(text))).slice(0, 40) + '...';
}
