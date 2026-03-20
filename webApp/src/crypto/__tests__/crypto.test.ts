import { describe, it, expect } from 'vitest';
import { generateKeyPair, toBase64, ensureSodium } from '../keyPair';
import {
  performX3DH, respondX3DH,
  generateSigningKeyPair, signData, verifySignature,
  type PreKeyBundle,
} from '../x3dh';
import { ratchetStep, initSenderRatchet, ratchetEncrypt } from '../doubleRatchet';
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

describe('Ed25519 подписи', () => {
  it('генерирует signing key pair', async () => {
    const sk = await generateSigningKeyPair();
    expect(sk.publicKey.length).toBe(32);
    expect(sk.privateKey.length).toBe(64); // Ed25519 secret key = 64 байта
  });

  it('подписывает и верифицирует данные', async () => {
    const sk = await generateSigningKeyPair();
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const signature = await signData(data, sk.privateKey);
    expect(signature.length).toBe(64);
    expect(await verifySignature(data, signature, sk.publicKey)).toBe(true);
  });

  it('неверная подпись не проходит верификацию', async () => {
    const sk = await generateSigningKeyPair();
    const data = new Uint8Array([1, 2, 3]);
    const signature = await signData(data, sk.privateKey);
    const fakeData = new Uint8Array([4, 5, 6]);
    expect(await verifySignature(fakeData, signature, sk.publicKey)).toBe(false);
  });
});

describe('performX3DH (полный протокол)', () => {
  async function createPreKeyBundle(): Promise<{ bundle: PreKeyBundle; spkKeyPair: ReturnType<typeof generateKeyPair> extends Promise<infer T> ? T : never }> {
    const theirIk = await generateKeyPair();
    const theirSigning = await generateSigningKeyPair();
    const theirSpk = await generateKeyPair();
    const theirSpkSig = await signData(theirSpk.publicKey, theirSigning.privateKey);
    return {
      bundle: {
        identityKey: theirIk.publicKey,
        signedPreKey: theirSpk.publicKey,
        signedPreKeySignature: theirSpkSig,
        signedPreKeyId: 1,
        identitySigningKey: theirSigning.publicKey,
      },
      spkKeyPair: theirSpk,
    };
  }

  it('возвращает 32-байтный sharedSecret с верифицированной подписью SPK', async () => {
    const ik = await generateKeyPair();
    const ek = await generateKeyPair();
    const { bundle } = await createPreKeyBundle();

    const result = await performX3DH(ik, ek, bundle);
    expect(result.sharedSecret).toBeInstanceOf(Uint8Array);
    expect(result.sharedSecret.length).toBe(32);
    expect(result.protocol).toBe('X3DH');
    expect(result.ephemeralPublicKey).toEqual(ek.publicKey);
  });

  it('отклоняет невалидную подпись SPK', async () => {
    const ik = await generateKeyPair();
    const ek = await generateKeyPair();
    const { bundle } = await createPreKeyBundle();

    // Подменить подпись
    bundle.signedPreKeySignature = new Uint8Array(64).fill(0);
    await expect(performX3DH(ik, ek, bundle)).rejects.toThrow('Невалидная подпись');
  });

  it('Alice и Bob получают одинаковый shared secret', async () => {
    const aliceIk = await generateKeyPair();
    const aliceEk = await generateKeyPair();
    const bobIk = await generateKeyPair();
    const bobSigning = await generateSigningKeyPair();
    const bobSpk = await generateKeyPair();
    const bobSpkSig = await signData(bobSpk.publicKey, bobSigning.privateKey);

    const bundle: PreKeyBundle = {
      identityKey: bobIk.publicKey,
      signedPreKey: bobSpk.publicKey,
      signedPreKeySignature: bobSpkSig,
      signedPreKeyId: 1,
      identitySigningKey: bobSigning.publicKey,
    };

    // Alice выполняет X3DH
    const aliceResult = await performX3DH(aliceIk, aliceEk, bundle);

    // Bob выполняет зеркальный X3DH
    const bobSharedSecret = await respondX3DH(
      bobIk, bobSpk,
      aliceIk.publicKey, aliceEk.publicKey,
    );

    expect(toBase64(aliceResult.sharedSecret)).toBe(toBase64(bobSharedSecret));
  });
});

describe('Double Ratchet (полный DH + симметричный рэтчет)', () => {
  it('ratchetStep генерирует messageKey и nextChainKey (32 байта)', async () => {
    await ensureSodium();
    const chainKey = new Uint8Array(32);
    crypto.getRandomValues(chainKey);

    const state = await ratchetStep(chainKey);
    expect(state.messageKey.length).toBe(32);
    expect(state.nextChainKey.length).toBe(32);
    expect(toBase64(state.messageKey)).not.toBe(toBase64(state.nextChainKey));
    expect(state.ratchetIndex).toBe(1);
  });

  it('initSenderRatchet создаёт состояние с корректными полями', async () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const theirDhKey = (await generateKeyPair()).publicKey;

    const state = await initSenderRatchet(sharedSecret, theirDhKey);
    expect(state.rootKey.length).toBe(32);
    expect(state.sendChainKey.length).toBe(32);
    expect(state.dhKeyPair.publicKey.length).toBe(32);
    expect(state.sendCount).toBe(0);
    expect(state.recvCount).toBe(0);
  });

  it('ratchetEncrypt генерирует заголовок и ключ', async () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const theirDhKey = (await generateKeyPair()).publicKey;
    const state = await initSenderRatchet(sharedSecret, theirDhKey);

    const { header, messageKey, state: newState } = ratchetEncrypt(state);
    expect(header.dhPublicKey.length).toBe(32);
    expect(header.messageNumber).toBe(0);
    expect(messageKey.length).toBe(32);
    expect(newState.sendCount).toBe(1);
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

describe('generateEmojiFingerprint (BLAKE2b)', () => {
  it('возвращает сетку 4×4', async () => {
    const grid = await generateEmojiFingerprint('key1', 'key2');
    expect(grid.length).toBe(4);
    grid.forEach((row) => expect(row.length).toBe(4));
  });

  it('симметричен', async () => {
    const g1 = await generateEmojiFingerprint('key-a', 'key-b');
    const g2 = await generateEmojiFingerprint('key-b', 'key-a');
    expect(g1).toEqual(g2);
  });
});

describe('generateHexFingerprint (BLAKE2b)', () => {
  it('возвращает hex-строку с пробелами', async () => {
    const hex = await generateHexFingerprint('key1', 'key2');
    expect(hex).toMatch(/^[0-9A-F]{4}(\s[0-9A-F]{4})*$/);
  });

  it('симметричен', async () => {
    const h1 = await generateHexFingerprint('a', 'b');
    const h2 = await generateHexFingerprint('b', 'a');
    expect(h1).toBe(h2);
  });
});
