package com.son.crypto

import kotlinx.datetime.Clock

/** Ключевая пара Curve25519 */
data class KeyPair(
    val publicKey: ByteArray,
    val privateKey: ByteArray,
    val algorithm: String = "Curve25519",
    val created: String = Clock.System.now().toString(),
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is KeyPair) return false
        return publicKey.contentEquals(other.publicKey) && privateKey.contentEquals(other.privateKey)
    }

    override fun hashCode(): Int = publicKey.contentHashCode() * 31 + privateKey.contentHashCode()
}

/** Генератор ключевых пар (через libsodium в продакшене) */
object KeyPairGenerator {

    /** Генерация случайной ключевой пары */
    fun generate(): KeyPair {
        // TODO: заменить на com.ionspin.kotlin.crypto.box.Box.keypair()
        val publicKey = ByteArray(32) { (Math.random() * 256).toInt().toByte() }
        val privateKey = ByteArray(32) { (Math.random() * 256).toInt().toByte() }
        return KeyPair(publicKey, privateKey)
    }
}
