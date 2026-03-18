/**
 * Утилита для работы с IndexedDB — локальный кэш сообщений.
 * В продакшене данные будут зашифрованы перед записью.
 */

const DB_NAME = 'son-messenger';
const DB_VERSION = 1;

/** Открыть или создать базу данных */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('chatId', 'chatId', { unique: false });
      }
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'chatId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Сохранить сообщения в кэш */
export async function cacheMessages(chatId: string, messages: unknown[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  for (const msg of messages) {
    store.put(msg);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Загрузить сообщения из кэша */
export async function getCachedMessages(chatId: string): Promise<unknown[]> {
  const db = await openDB();
  const tx = db.transaction('messages', 'readonly');
  const store = tx.objectStore('messages');
  const index = store.index('chatId');
  const request = index.getAll(chatId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Очистить весь кэш */
export async function clearCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['messages', 'keys'], 'readwrite');
  tx.objectStore('messages').clear();
  tx.objectStore('keys').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
