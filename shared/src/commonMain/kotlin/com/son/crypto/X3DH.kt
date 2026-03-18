package com.son.crypto

/** Результат X3DH обмена ключами */
data class X3DHResult(
    val sharedSecret: ByteArray,
    val protocol: String = "X3DH",
    val timestamp: Long = System.currentTimeMillis(),
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is X3DHResult) return false
        return sharedSecret.contentEquals(other.sharedSecret)
    }

    override fun hashCode(): Int = sharedSecret.contentHashCode()
}

/**
 * Имитация X3DH (Extended Triple Diffie-Hellman).
 * В продакшене: libsodium crypto_scalarmult.
 */
object X3DH {

    /** Выполнить X3DH обмен ключами */
    fun perform(
        myIdentityKey: KeyPair,
        myEphemeralKey: KeyPair,
        theirIdentityKey: KeyPair,
        theirSignedPreKey: KeyPair,
    ): X3DHResult {
        // DH1 = DH(IKa, SPKb), DH2 = DH(EKa, IKb), DH3 = DH(EKa, SPKb)
        val dh1 = xorBytes(myIdentityKey.privateKey, theirSignedPreKey.publicKey)
        val dh2 = xorBytes(myEphemeralKey.privateKey, theirIdentityKey.publicKey)
        val dh3 = xorBytes(myEphemeralKey.privateKey, theirSignedPreKey.publicKey)

        val sharedSecret = dh1 + dh2 + dh3
        return X3DHResult(sharedSecret)
    }

    private fun xorBytes(a: ByteArray, b: ByteArray): ByteArray {
        val len = minOf(a.size, b.size)
        return ByteArray(len) { i -> (a[i].toInt() xor b[i].toInt()).toByte() }
    }
}
