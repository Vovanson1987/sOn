import { describe, it, expect } from 'vitest';
import { generateKeyPair, toBase64, ensureSodium } from '../keyPair';
import { performX3DH } from '../x3dh';
import { ratchetStep } from '../doubleRatchet';
import { encryptMessage, decryptMessage, getEncryptedPreview } from '../encrypt';
import { generateEmojiFingerprint, generateHexFingerprint } from '../fingerprint';

describe('generateKeyPair (libsodium X25519)', () => {
  it('генерирует пару с 32-байтными ключами', async () => {
    const kp = await generateKeyPair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.privateKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.privateKey.length).toBe(32);
    expect(kp.algorithm).toBe('X25519');
  });

  it('генерирует уникальные ключи', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    expect(toBase64(kp1.publicKey)).not.toBe(toBase64(kp2.publicKey));
  });
});

describe('performX3DH (реальный ECDH)', () => {
  it('возвращает 32-байтный sharedSecret', async () => {
    const ik = await generateKeyPair();
    const ek = await generateKeyPair();
    const theirIk = await generateKeyPair();
    const theirSpk = await generateKeyPair();

    const result = await performX3DH(ik, ek, theirIk, theirSpk);
    expect(result.sharedSecret).toBeInstanceOf(Uint8Array);
    expect(result.sharedSecret.length).toBe(32);
    expect(result.protocol).toBe('X3DH');
  });

  it('одинаковые ключи дают одинаковый секрет', async () => {
    const ik = await generateKeyPair();
    const ek = await generateKeyPair();
    const theirIk = await generateKeyPair();
    const theirSpk = await generateKeyPair();

    const r1 = await performX3DH(ik, ek, theirIk, theirSpk);
    const r2 = await performX3DH(ik, ek, theirIk, theirSpk);
    expect(toBase64(r1.sharedSecret)).toBe(toBase64(r2.sharedSecret));
  });
});

describe('ratchetStep (BLAKE2b HMAC)', () => {
  it('генерирует messageKey и nextChainKey (32 байта)', async () => {
    await ensureSodium();
    const chainKey = new Uint8Array(32);
    crypto.getRandomValues(chainKey);

    const state = await ratchetStep(chainKey);
    expect(state.messageKey.length).toBe(32);
    expect(state.nextChainKey.length).toBe(32);
    expect(toBase64(state.messageKey)).not.toBe(toBase64(state.nextChainKey));
    expect(state.ratchetIndex).toBe(1);
  });
});

describe('encryptMessage / decryptMessage (XSalsa20-Poly1305)', () => {
  it('шифрует и дешифрует сообщение', async () => {
    await ensureSodium();
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);

    const encrypted = await encryptMessage('Привет!', key);
    expect(encrypted.algorithm).toBe('XSalsa20-Poly1305');
    expect(encrypted.ciphertext).toBeTruthy();

    const decrypted = await decryptMessage(encrypted, key);
    expect(decrypted).toBe('Привет!');
  });

  it('разные ключи не могут дешифровать', async () => {
    await ensureSodium();
    const key1 = new Uint8Array(32);
    crypto.getRandomValues(key1);
    const key2 = new Uint8Array(32);
    crypto.getRandomValues(key2);

    const encrypted = await encryptMessage('Секрет', key1);
    await expect(decryptMessage(encrypted, key2)).rejects.toThrow();
  });
});

describe('getEncryptedPreview', () => {
  it('возвращает base64 строку с "..."', () => {
    const preview = getEncryptedPreview('Тестовое сообщение');
    expect(preview).toMatch(/[A-Za-z0-9+/=]+\.\.\./);
  });
});

describe('generateEmojiFingerprint', () => {
  it('возвращает сетку 4×4', () => {
    const grid = generateEmojiFingerprint('key1', 'key2');
    expect(grid.length).toBe(4);
    grid.forEach((row) => expect(row.length).toBe(4));
  });

  it('симметричен', () => {
    const g1 = generateEmojiFingerprint('key-a', 'key-b');
    const g2 = generateEmojiFingerprint('key-b', 'key-a');
    expect(g1).toEqual(g2);
  });
});

describe('generateHexFingerprint', () => {
  it('возвращает hex-строку с пробелами', () => {
    const hex = generateHexFingerprint('key1', 'key2');
    expect(hex).toMatch(/^[0-9A-F]{4}(\s[0-9A-F]{4})*$/);
  });

  it('симметричен', () => {
    const h1 = generateHexFingerprint('a', 'b');
    const h2 = generateHexFingerprint('b', 'a');
    expect(h1).toBe(h2);
  });
});
