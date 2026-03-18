import { describe, it, expect } from 'vitest';
import { generateKeyPair } from '../keyPair';
import { performX3DH } from '../x3dh';
import { ratchetStep } from '../doubleRatchet';
import { encryptMessage, decryptMessage, getEncryptedPreview } from '../encrypt';
import { generateEmojiFingerprint, generateHexFingerprint } from '../fingerprint';

describe('generateKeyPair', () => {
  it('генерирует пару с publicKey и privateKey', () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toBeTruthy();
    expect(kp.privateKey).toBeTruthy();
    expect(kp.algorithm).toBe('Curve25519');
    expect(kp.created).toBeTruthy();
  });

  it('генерирует уникальные ключи', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
  });
});

describe('performX3DH', () => {
  it('возвращает sharedSecret', () => {
    const ik = generateKeyPair();
    const ek = generateKeyPair();
    const theirIk = generateKeyPair();
    const theirSpk = generateKeyPair();

    const result = performX3DH(ik, ek, theirIk, theirSpk);
    expect(result.sharedSecret).toBeTruthy();
    expect(result.protocol).toBe('X3DH');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('одинаковые ключи дают одинаковый секрет', () => {
    const ik = generateKeyPair();
    const ek = generateKeyPair();
    const theirIk = generateKeyPair();
    const theirSpk = generateKeyPair();

    const r1 = performX3DH(ik, ek, theirIk, theirSpk);
    const r2 = performX3DH(ik, ek, theirIk, theirSpk);
    expect(r1.sharedSecret).toBe(r2.sharedSecret);
  });
});

describe('ratchetStep', () => {
  it('генерирует messageKey и nextChainKey', () => {
    const state = ratchetStep('initial-chain-key');
    expect(state.messageKey).toBeTruthy();
    expect(state.nextChainKey).toBeTruthy();
    expect(state.messageKey).not.toBe(state.nextChainKey);
  });

  it('разные входные ключи дают разные результаты', () => {
    const s1 = ratchetStep('key-1');
    const s2 = ratchetStep('key-2');
    expect(s1.messageKey).not.toBe(s2.messageKey);
  });
});

describe('encryptMessage / decryptMessage', () => {
  it('шифрует и дешифрует ASCII сообщение', () => {
    const key = 'test-message-key-32chars!!!!!!!!';
    const encrypted = encryptMessage('Hello world!', key);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.algorithm).toBe('AES-256-GCM');
    expect(encrypted.iv).toBeTruthy();

    const decrypted = decryptMessage(encrypted, key);
    expect(decrypted).toBe('Hello world!');
  });

  it('возвращает зашифрованные данные', () => {
    const encrypted = encryptMessage('Test', 'key-1-padded-to-32-characters!!');
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.ciphertext).not.toBe(btoa('Test'));
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

  it('детерминирован (одинаковые ключи → одинаковый результат)', () => {
    const g1 = generateEmojiFingerprint('abc', 'xyz');
    const g2 = generateEmojiFingerprint('abc', 'xyz');
    expect(g1).toEqual(g2);
  });

  it('симметричен (порядок ключей не важен)', () => {
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
