/**
 * Имитация Double Ratchet Algorithm.
 * Каждое сообщение использует уникальный ключ.
 */

export interface RatchetState {
  chainKey: string;
  messageKey: string;
  nextChainKey: string;
  ratchetIndex: number;
}

/** Простой хеш-mock (в продакшене: HMAC-SHA256) */
function hashMock(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** Один шаг рэтчета — генерация ключа сообщения и обновление цепочки */
export function ratchetStep(chainKey: string): RatchetState {
  return {
    chainKey,
    messageKey: btoa(hashMock(chainKey + ':msg')),
    nextChainKey: btoa(hashMock(chainKey + ':chain')),
    ratchetIndex: Date.now(),
  };
}
