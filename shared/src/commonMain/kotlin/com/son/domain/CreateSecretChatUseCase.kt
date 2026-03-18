package com.son.domain

import com.son.crypto.KeyPairGenerator
import com.son.crypto.X3DH
import com.son.crypto.DoubleRatchet
import com.son.model.Chat
import com.son.model.ChatType
import io.github.aakira.napier.Napier

/** Результат создания секретного чата */
data class SecretChatResult(
    val chat: Chat,
    val sharedSecret: ByteArray,
    val ratchetIndex: Int,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SecretChatResult) return false
        return chat == other.chat && sharedSecret.contentEquals(other.sharedSecret)
    }

    override fun hashCode(): Int = chat.hashCode() * 31 + sharedSecret.contentHashCode()
}

/** Use case: создание секретного чата с E2E шифрованием */
class CreateSecretChatUseCase {

    /** Создать секретный чат */
    fun execute(contactId: String, contactName: String): SecretChatResult {
        Napier.i("Создание секретного чата с $contactName")

        // 1. Генерация ключей
        val myIdentityKey = KeyPairGenerator.generate()
        val myEphemeralKey = KeyPairGenerator.generate()

        // 2. Получить pre-key bundle собеседника (TODO: из API)
        val theirIdentityKey = KeyPairGenerator.generate()
        val theirSignedPreKey = KeyPairGenerator.generate()

        // 3. X3DH обмен
        val x3dhResult = X3DH.perform(myIdentityKey, myEphemeralKey, theirIdentityKey, theirSignedPreKey)
        Napier.i("X3DH завершён, shared secret получен")

        // 4. Инициализация Double Ratchet
        val ratchetState = DoubleRatchet.ratchetStep(x3dhResult.sharedSecret)
        Napier.i("Double Ratchet инициализирован, index: ${ratchetState.ratchetIndex}")

        // 5. Создать объект чата
        val chat = Chat(
            id = "secret-${System.currentTimeMillis()}",
            type = ChatType.SECRET,
            name = contactName,
        )

        return SecretChatResult(
            chat = chat,
            sharedSecret = x3dhResult.sharedSecret,
            ratchetIndex = ratchetState.ratchetIndex,
        )
    }
}
