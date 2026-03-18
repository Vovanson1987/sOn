package com.son.crypto

/** Состояние рэтчета */
data class RatchetState(
    val chainKey: ByteArray,
    val messageKey: ByteArray,
    val nextChainKey: ByteArray,
    val ratchetIndex: Int,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is RatchetState) return false
        return chainKey.contentEquals(other.chainKey) && ratchetIndex == other.ratchetIndex
    }

    override fun hashCode(): Int = chainKey.contentHashCode() * 31 + ratchetIndex
}

/**
 * Имитация Double Ratchet Algorithm.
 * В продакшене: HMAC-SHA256 для KDF.
 */
object DoubleRatchet {

    /** Один шаг симметричного рэтчета */
    fun ratchetStep(chainKey: ByteArray, index: Int = 0): RatchetState {
        // CK_new = HMAC(CK, 0x02), MK = HMAC(CK, 0x01)
        val messageKey = hmacMock(chainKey, byteArrayOf(0x01))
        val nextChainKey = hmacMock(chainKey, byteArrayOf(0x02))

        return RatchetState(
            chainKey = chainKey,
            messageKey = messageKey,
            nextChainKey = nextChainKey,
            ratchetIndex = index + 1,
        )
    }

    /** Простой HMAC-mock (в продакшене: javax.crypto.Mac / libsodium) */
    private fun hmacMock(key: ByteArray, data: ByteArray): ByteArray {
        val result = ByteArray(32)
        for (i in result.indices) {
            result[i] = (key[i % key.size].toInt() xor data[i % data.size].toInt() xor i).toByte()
        }
        return result
    }
}
