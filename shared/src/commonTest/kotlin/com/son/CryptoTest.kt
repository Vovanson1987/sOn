package com.son

import com.son.crypto.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class CryptoTest {

    @Test
    fun testKeyPairGeneration() {
        val kp = KeyPairGenerator.generate()
        assertEquals(32, kp.publicKey.size)
        assertEquals(32, kp.privateKey.size)
        assertEquals("Curve25519", kp.algorithm)
    }

    @Test
    fun testUniqueKeyPairs() {
        val kp1 = KeyPairGenerator.generate()
        val kp2 = KeyPairGenerator.generate()
        assertNotEquals(kp1.publicKey.toList(), kp2.publicKey.toList())
    }

    @Test
    fun testX3DHProducesSharedSecret() {
        val ik = KeyPairGenerator.generate()
        val ek = KeyPairGenerator.generate()
        val theirIk = KeyPairGenerator.generate()
        val theirSpk = KeyPairGenerator.generate()

        val result = X3DH.perform(ik, ek, theirIk, theirSpk)
        assertTrue(result.sharedSecret.isNotEmpty())
        assertEquals("X3DH", result.protocol)
    }

    @Test
    fun testDoubleRatchetStep() {
        val chainKey = ByteArray(32) { it.toByte() }
        val state = DoubleRatchet.ratchetStep(chainKey)

        assertEquals(32, state.messageKey.size)
        assertEquals(32, state.nextChainKey.size)
        assertEquals(1, state.ratchetIndex)
        assertNotEquals(state.messageKey.toList(), state.nextChainKey.toList())
    }

    @Test
    fun testEncryptDecrypt() {
        val key = ByteArray(32) { (it + 42).toByte() }
        val plaintext = "Hello, World!"

        val encrypted = MessageEncryptor.encrypt(plaintext, key)
        assertEquals("AES-256-GCM", encrypted.algorithm)
        assertEquals(12, encrypted.iv.size)

        val decrypted = MessageEncryptor.decrypt(encrypted, key)
        assertEquals(plaintext, decrypted)
    }

    @Test
    fun testDifferentKeysProduceDifferentCiphertext() {
        val key1 = ByteArray(32) { it.toByte() }
        val key2 = ByteArray(32) { (it + 1).toByte() }

        val e1 = MessageEncryptor.encrypt("Test", key1)
        val e2 = MessageEncryptor.encrypt("Test", key2)
        assertNotEquals(e1.ciphertext.toList(), e2.ciphertext.toList())
    }
}
