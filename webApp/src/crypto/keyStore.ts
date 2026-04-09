/**
 * Зашифрованное хранение ключей в IndexedDB.
 * Мастер-ключ выводится из пароля пользователя через Argon2id (libsodium).
 * Fallback: случайный ключ для автономной работы.
 */

import sodium from 'libsodium-wrappers';
import { ensureSodium, toBase64, fromBase64 } from './keyPair';
import type { KeyPair } from './keyPair';

const DB_NAME = 'son-keystore';
const DB_VERSION = 2;
const STORE_NAME = 'keys';
const SALT_KEY = 'son-ks-salt';
const MK_KEY = 'son-mk';

/** Текущий мастер-ключ (кэш в памяти, НЕ в localStorage) */
let cachedMasterKey: Uint8Array | null = null;

/**
 * Инициализировать мастер-ключ из пароля через Argon2id.
 * Вызывается после успешного логина.
 */
export async function initMasterKeyFromPassword(password: string): Promise<void> {
  await ensureSodium();

  // Получить или создать соль (соль можно хранить открыто)
  const saltBase64 = localStorage.getItem(SALT_KEY);
  let salt: Uint8Array;
  if (saltBase64) {
    salt = fromBase64(saltBase64);
  } else {
    salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    localStorage.setItem(SALT_KEY, toBase64(salt));
  }

  // Вывод ключа через Argon2id
  cachedMasterKey = sodium.crypto_pwhash(
    32,                                          // длина ключа
    password,                                    // пароль
    salt,                                        // соль
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,   // итерации (умеренная нагрузка)
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,   // память (~64 МБ)
    sodium.crypto_pwhash_ALG_ARGON2ID13,         // алгоритм
  );

  // Убрать старый незащищённый мастер-ключ если он есть
  localStorage.removeItem(MK_KEY);

  // Мигрировать данные если нужно — перешифровать IndexedDB
  await migrateFromLegacyKey();
}

/**
 * Получить мастер-ключ.
 * Если initMasterKeyFromPassword ещё не вызывался — fallback на случайный ключ.
 */
async function getMasterKey(): Promise<Uint8Array> {
  if (cachedMasterKey) return cachedMasterKey;

  await ensureSodium();

  // Убран legacy-ключ из localStorage и fallback — секретные чаты требуют вызова initMasterKeyFromPassword
  throw new Error('Мастер-ключ не инициализирован. Вызовите initMasterKeyFromPassword после логина.');
}

/** Миграция: перешифровать данные со старым ключом на новый Argon2 ключ */
async function migrateFromLegacyKey(): Promise<void> {
  const legacyKeyStr = localStorage.getItem(MK_KEY);
  if (!legacyKeyStr || !cachedMasterKey) return;

  try {
    const legacyKey = fromBase64(legacyKeyStr);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const allKeys = await getAllRecords(store);

    for (const record of allKeys) {
      // Расшифровать старым ключом, зашифровать новым
      for (const field of ['publicKey', 'privateKey', 'data']) {
        if (record[field] && typeof record[field] === 'string') {
          try {
            const decrypted = decryptWithKey(record[field], legacyKey);
            record[field] = encryptWithKey(decrypted, cachedMasterKey);
          } catch {
            // Пропускаем неподдающиеся миграции записи
          }
        }
      }
      store.put(record);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Удалить старый ключ после успешной миграции
    localStorage.removeItem(MK_KEY);
  } catch {
    // Миграция необязательна — не блокируем
  }
}

/** Очистить кэш мастер-ключа (при логауте) */
export function clearMasterKey(): void {
  if (cachedMasterKey) {
    cachedMasterKey.fill(0); // Зануляем память
  }
  cachedMasterKey = null;
}

/** Шифрование данных с указанным ключом */
function encryptWithKey(data: Uint8Array, key: Uint8Array): string {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encrypted = sodium.crypto_secretbox_easy(data, nonce, key);
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return toBase64(combined);
}

/** Дешифрация данных с указанным ключом */
function decryptWithKey(encoded: string, key: Uint8Array): Uint8Array {
  const combined = fromBase64(encoded);
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = combined.slice(0, nonceLen);
  const ciphertext = combined.slice(nonceLen);
  return sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
}

/** Шифрование данных перед записью в IndexedDB */
async function encryptData(data: Uint8Array): Promise<string> {
  await ensureSodium();
  const mk = await getMasterKey();
  return encryptWithKey(data, mk);
}

/** Дешифрация данных из IndexedDB */
async function decryptData(encoded: string): Promise<Uint8Array> {
  await ensureSodium();
  const mk = await getMasterKey();
  return decryptWithKey(encoded, mk);
}

/** Получить все записи из хранилища */
function getAllRecords(store: IDBObjectStore): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

/**
 * Сохранить Ed25519 signing key (публичный + приватный 64-байт).
 * Используется для persistence собственного signing-ключа пользователя.
 * id: `sk:${chatId}` — при chatId='self' хранится основной ключ,
 * для отдельных чатов можно передать chat-специфичный id.
 */
export async function saveSigningKeyPair(
  chatId: string,
  keyPair: { publicKey: Uint8Array; privateKey: Uint8Array },
): Promise<void> {
  const db = await openDB();
  const encPublic = await encryptData(keyPair.publicKey);
  const encPrivate = await encryptData(keyPair.privateKey);
  const record = {
    id: `sk:${chatId}`,
    publicKey: encPublic,
    privateKey: encPrivate,
  };
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Загрузить Ed25519 signing key (расшифровать) */
export async function loadSigningKeyPair(
  chatId: string,
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array } | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(`sk:${chatId}`);
  return new Promise((resolve, reject) => {
    req.onsuccess = async () => {
      const record = req.result;
      if (!record) { resolve(null); return; }
      try {
        const publicKey = await decryptData(record.publicKey);
        const privateKey = await decryptData(record.privateKey);
        resolve({ publicKey, privateKey });
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

/** Сохранить состояние Double Ratchet */
export async function saveRatchetState(chatId: string, state: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  // Map не сериализуется JSON.stringify — конвертируем в массив
  const safeState = { ...state };
  if (safeState.skippedKeys instanceof Map) {
    safeState.skippedKeys = Array.from((safeState.skippedKeys as Map<string, unknown>).entries());
  }
  const serialized = new TextEncoder().encode(JSON.stringify(safeState));
  const encrypted = await encryptData(serialized);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ id: `dr:${chatId}`, data: encrypted });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Загрузить состояние Double Ratchet */
export async function loadRatchetState(chatId: string): Promise<Record<string, unknown> | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(`dr:${chatId}`);
  return new Promise((resolve, reject) => {
    req.onsuccess = async () => {
      const record = req.result;
      if (!record) { resolve(null); return; }
      try {
        const data = await decryptData(record.data);
        const parsed = JSON.parse(new TextDecoder().decode(data));
        // Восстановить Map из массива (сохранённого saveRatchetState)
        if (Array.isArray(parsed.skippedKeys)) {
          parsed.skippedKeys = new Map(parsed.skippedKeys);
        }
        resolve(parsed);
      } catch { resolve(null); }
    };
    req.onerror = () => reject(req.error);
  });
}

/** HI-11: Сохранить метаданные секретной сессии */
export async function saveSessionMeta(chatId: string, meta: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  const serialized = new TextEncoder().encode(JSON.stringify(meta));
  const encrypted = await encryptData(serialized);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ id: `sm:${chatId}`, data: encrypted });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** HI-11: Загрузить метаданные секретной сессии */
export async function loadSessionMeta(chatId: string): Promise<Record<string, unknown> | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(`sm:${chatId}`);
  return new Promise((resolve, reject) => {
    req.onsuccess = async () => {
      const record = req.result;
      if (!record) { resolve(null); return; }
      try {
        const data = await decryptData(record.data);
        resolve(JSON.parse(new TextDecoder().decode(data)));
      } catch { resolve(null); }
    };
    req.onerror = () => reject(req.error);
  });
}

/** HI-11: Загрузить все chatId для которых есть сохранённые сессии */
export async function loadAllSessionChatIds(): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const records = await getAllRecords(store);
  return records
    .filter((r) => typeof r.id === 'string' && (r.id as string).startsWith('sm:'))
    .map((r) => (r.id as string).slice(3));
}

/** Удалить все ключи для чата */
export async function deleteKeys(chatId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(`kp:${chatId}`);
  store.delete(`ss:${chatId}`);
  store.delete(`dr:${chatId}`);
  store.delete(`sm:${chatId}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
