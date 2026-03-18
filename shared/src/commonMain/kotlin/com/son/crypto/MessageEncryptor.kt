package com.son.crypto

import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/** Зашифрованное сообщение */
data class EncryptedMessage(
    val ciphertext: ByteArray,
    val iv: ByteArray,
    val authTag: ByteArray,
    val algorithm: String = "AES-256-GCM",
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is EncryptedMessage) return false
        return ciphertext.contentEquals(other.ciphertext)
    }

    override fun hashCode(): Int = ciphertext.contentHashCode()
}

/**
 * Шифрование/дешифрация сообщений.
 * В продакшене: AES-256-GCM через libsodium secretbox.
 */
object MessageEncryptor {

    /** Шифрование (XOR-mock) */
    fun encrypt(plaintext: String, messageKey: ByteArray): EncryptedMessage {
        val data = plaintext.encodeToByteArray()
        val iv = ByteArray(12) { (Math.random() * 256).toInt().toByte() }
        val ciphertext = ByteArray(data.size) { i ->
            (data[i].toInt() xor messageKey[i % messageKey.size].toInt()).toByte()
        }
        val authTag = messageKey.copyOfRange(0, 16)

        return EncryptedMessage(ciphertext, iv, authTag)
    }

    /** Дешифрация */
    fun decrypt(encrypted: EncryptedMessage, messageKey: ByteArray): String {
        val plaintext = ByteArray(encrypted.ciphertext.size) { i ->
            (encrypted.ciphertext[i].toInt() xor messageKey[i % messageKey.size].toInt()).toByte()
        }
        return plaintext.decodeToString()
    }
}
