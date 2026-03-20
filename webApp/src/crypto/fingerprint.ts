/**
 * Генерация визуальных отпечатков для верификации ключей.
 * Эмодзи-сетка 4×4 + hex fingerprint.
 * Использует BLAKE2b (libsodium) для криптографического хеширования.
 */

import sodium from 'libsodium-wrappers';
import { ensureSodium } from './keyPair';

/** Пул эмодзи для отпечатка (256 шт.) */
const EMOJI_POOL = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔',
  '🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞',
  '🐜','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈',
  '🌺','🌸','🌷','🌹','🌻','🌼','💐','🌾','🍀','🍁','🍂','🍃','🌿','☘️','🌵','🌴',
  '🎸','🎹','🎺','🎻','🥁','🎵','🎶','🎤','🎧','🎼','🎭','🎪','🎨','🎬','🎮','🕹️',
  '🚀','✈️','🚁','🛸','🚂','🚗','🏎️','🚕','🚌','🚎','🏍️','🛵','🚲','🛴','🚡','🚠',
  '☀️','🌙','⭐','🌟','💫','🌈','⚡','🔥','❄️','💧','🌊','🌪️','🌤️','⛅','🌥️','🌦️',
  '🔑','💎','🏆','🎯','🎲','🧩','🧸','🎁','🎈','🎀','🪄','🔮','💡','📸','🔭','🧲',
  '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅',
  '🏔️','🗻','🌋','🏕️','🏖️','🏝️','🏞️','🗽','🏰','🕌','⛩️','🗼','🎡','🎢','⛲','🌉',
  '🦓','🦍','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏',
  '🐑','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝',
  '🎻','🪕','🎷','🎺','📯','🪗','🥊','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏',
  '🧭','⏰','🔔','📦','💰','💳','📱','💻','⌨️','🖥️','📺','📻','🎙️','📡','🔋','🔌',
  '🧪','🔬','🧬','💊','🩺','🩻','🧫','🧹','🪣','🧴','🪥','🧽','🪡','🧶','🧵','🪢',
  '🏅','🥇','🥈','🥉','🏵️','🎖️','🎗️','🎟️','🎫','🃏','🀄','🎴','🔇','🔈','🔉','🔊',
];

/**
 * Генерация fingerprint через BLAKE2b (libsodium).
 * Детерминированный порядок: ключи сортируются лексикографически.
 */
function fingerprintHash(key1: Uint8Array, key2: Uint8Array): Uint8Array {
  // Сортировка ключей для детерминированного результата
  const cmp = compareBytes(key1, key2) < 0;
  const first = cmp ? key1 : key2;
  const second = cmp ? key2 : key1;

  // Конкатенация
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first);
  combined.set(second, first.length);

  // Криптографический BLAKE2b хеш через libsodium (32 байта)
  return sodium.crypto_generichash(32, combined, null);
}

/** Побайтовое сравнение массивов (для детерминированной сортировки) */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** Генерация эмодзи-сетки 4×4 (принимает Uint8Array ключи) */
export async function generateEmojiFingerprint(key1: Uint8Array | string, key2: Uint8Array | string): Promise<string[][]> {
  await ensureSodium();
  const k1 = typeof key1 === 'string' ? new TextEncoder().encode(key1) : key1;
  const k2 = typeof key2 === 'string' ? new TextEncoder().encode(key2) : key2;
  const bytes = fingerprintHash(k1, k2);
  const grid: string[][] = [];
  for (let row = 0; row < 4; row++) {
    const rowEmojis: string[] = [];
    for (let col = 0; col < 4; col++) {
      const idx = bytes[row * 4 + col] % EMOJI_POOL.length;
      rowEmojis.push(EMOJI_POOL[idx]);
    }
    grid.push(rowEmojis);
  }
  return grid;
}

/** Генерация hex fingerprint (принимает Uint8Array ключи) */
export async function generateHexFingerprint(key1: Uint8Array | string, key2: Uint8Array | string): Promise<string> {
  await ensureSodium();
  const k1 = typeof key1 === 'string' ? new TextEncoder().encode(key1) : key1;
  const k2 = typeof key2 === 'string' ? new TextEncoder().encode(key2) : key2;
  const bytes = fingerprintHash(k1, k2);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  return hex.match(/.{1,4}/g)?.join(' ') ?? hex;
}
