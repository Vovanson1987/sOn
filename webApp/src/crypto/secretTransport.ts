import type { MessageHeader } from '@/crypto/doubleRatchet';
import type { EncryptedMessage } from '@/crypto/encrypt';

export interface SecretMessageHeaderPayload {
  dh_public_key: string;
  previous_count: number;
  message_number: number;
}

export interface SecretMessagePayload {
  ciphertext: string;
  nonce: string;
  algorithm: EncryptedMessage['algorithm'];
  header: SecretMessageHeaderPayload;
}

function encodeBase64(data: Uint8Array): string {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa недоступен');
  }
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}

function decodeBase64(encoded: string): Uint8Array {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('atob недоступен');
  }
  const binary = globalThis.atob(encoded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function toSecretMessagePayload(
  encrypted: EncryptedMessage,
  header: MessageHeader,
): SecretMessagePayload {
  return {
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    algorithm: encrypted.algorithm,
    header: {
      dh_public_key: encodeBase64(header.dhPublicKey),
      previous_count: header.previousCount,
      message_number: header.messageNumber,
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function isSecretMessagePayload(value: unknown): value is SecretMessagePayload {
  if (!isObject(value)) return false;
  if (typeof value.ciphertext !== 'string' || value.ciphertext.length === 0) return false;
  if (typeof value.nonce !== 'string' || value.nonce.length === 0) return false;
  if (value.algorithm !== 'XSalsa20-Poly1305') return false;

  const header = value.header;
  if (!isObject(header)) return false;
  if (typeof header.dh_public_key !== 'string' || header.dh_public_key.length === 0) return false;
  if (typeof header.previous_count !== 'number' || header.previous_count < 0) return false;
  if (typeof header.message_number !== 'number' || header.message_number < 0) return false;
  return true;
}

export function fromSecretMessagePayload(payload: SecretMessagePayload): {
  encrypted: EncryptedMessage;
  header: MessageHeader;
} | null {
  if (!isSecretMessagePayload(payload)) return null;
  try {
    return {
      encrypted: {
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        algorithm: payload.algorithm,
      },
      header: {
        dhPublicKey: decodeBase64(payload.header.dh_public_key),
        previousCount: payload.header.previous_count,
        messageNumber: payload.header.message_number,
      },
    };
  } catch {
    return null;
  }
}
