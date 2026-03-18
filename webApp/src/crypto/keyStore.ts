/**
 * Зашифрованное хранение ключей в IndexedDB.
 * Ключи шифруются перед записью через secretbox.
 */

import sodium from 'libsodium-wrappers';
import { ensureSodium, toBase64, fromBase64 } from './keyPair';
import type { KeyPair } from './keyPair';

const DB_NAME = 'son-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

/** Получить или создать мастер-ключ для шифрования хранилища */
async function getMasterKey(): Promise<Uint8Array> {
  await ensureSodium();

  const stored = localStorage.getItem('son-mk');
  if (stored) {
    return fromBase64(stored);
  }
  // Генерируем новый мастер-ключ
  const mk = sodium.crypto_secretbox_keygen();
  localStorage.setItem('son-mk', toBase64(mk));
  return mk;
}

/** Шифрование данных перед записью в IndexedDB */
async function encryptData(data: Uint8Array): Promise<string> {
  await ensureSodium();
  const mk = await getMasterKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encrypted = sodium.crypto_secretbox_easy(data, nonce, mk);
  // Формат: nonce || ciphertext (base64)
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return toBase64(combined);
}

/** Дешифрация данных из IndexedDB */
async function decryptData(encoded: string): Promise<Uint8Array> {
  await ensureSodium();
  const mk = await getMasterKey();
  const combined = fromBase64(encoded);
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = combined.slice(0, nonceLen);
  const ciphertext = combined.slice(nonceLen);
  return sodium.crypto_secretbox_open_easy(ciphertext, nonce, mk);
}

/** Открыть IndexedDB */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Сохранить ключевую пару (зашифрованно) */
export async function saveKeyPair(chatId: string, keyPair: KeyPair): Promise<void> {
  const db = await openDB();
  const encPublic = await encryptData(keyPair.publicKey);
  const encPrivate = await encryptData(keyPair.privateKey);

  const record = {
    id: `kp:${chatId}`,
    publicKey: encPublic,
    privateKey: encPrivate,
    algorithm: keyPair.algorithm,
    created: keyPair.created,
  };

  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Загрузить ключевую пару (расшифровать) */
export async function loadKeyPair(chatId: string): Promise<KeyPair | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(`kp:${chatId}`);

  return new Promise((resolve, reject) => {
    req.onsuccess = async () => {
      const record = req.result;
      if (!record) { resolve(null); return; }
      try {
        const publicKey = await decryptData(record.publicKey);
        const privateKey = await decryptData(record.privateKey);
        resolve({
          publicKey,
          privateKey,
          algorithm: record.algorithm,
          created: record.created,
        });
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Сохранить shared secret (зашифрованно) */
export async function saveSharedSecret(chatId: string, secret: Uint8Array): Promise<void> {
  const db = await openDB();
  const encrypted = await encryptData(secret);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ id: `ss:${chatId}`, data: encrypted });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Загрузить shared secret */
export async function loadSharedSecret(chatId: string): Promise<Uint8Array | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(`ss:${chatId}`);
  return new Promise((resolve, reject) => {
    req.onsuccess = async () => {
      const record = req.result;
      if (!record) { resolve(null); return; }
      try { resolve(await decryptData(record.data)); } catch { resolve(null); }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Удалить все ключи для чата */
export async function deleteKeys(chatId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(`kp:${chatId}`);
  store.delete(`ss:${chatId}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
