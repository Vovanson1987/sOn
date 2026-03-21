import { describe, expect, it } from 'vitest';
import {
  fromSecretMessagePayload,
  isSecretMessagePayload,
  toSecretMessagePayload,
} from '../secretTransport';

describe('secretTransport', () => {
  it('сериализует и десериализует payload без потерь', () => {
    const payload = toSecretMessagePayload(
      {
        ciphertext: 'CIPH',
        nonce: 'NONCE',
        algorithm: 'XSalsa20-Poly1305',
      },
      {
        dhPublicKey: new Uint8Array([1, 2, 3, 4]),
        previousCount: 10,
        messageNumber: 11,
      },
    );

    expect(isSecretMessagePayload(payload)).toBe(true);

    const decoded = fromSecretMessagePayload(payload);
    expect(decoded).not.toBeNull();
    expect(decoded?.encrypted.ciphertext).toBe('CIPH');
    expect(decoded?.encrypted.nonce).toBe('NONCE');
    expect(decoded?.header.previousCount).toBe(10);
    expect(decoded?.header.messageNumber).toBe(11);
    expect(Array.from(decoded?.header.dhPublicKey || [])).toEqual([1, 2, 3, 4]);
  });

  it('отклоняет невалидный payload', () => {
    expect(isSecretMessagePayload({
      ciphertext: '',
      nonce: 'NONCE',
      algorithm: 'XSalsa20-Poly1305',
      header: { dh_public_key: 'AQID', previous_count: 0, message_number: 1 },
    })).toBe(false);
  });
});
