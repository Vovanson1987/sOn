package com.son.domain

import com.son.model.Message
import com.son.model.MessageType
import com.son.model.DeliveryStatus
import com.son.model.ChatType
import com.son.crypto.DoubleRatchet
import com.son.crypto.MessageEncryptor
import com.son.network.WebSocketClient
import kotlinx.datetime.Clock

/** Use case: отправка сообщения */
class SendMessageUseCase(
    private val webSocket: WebSocketClient,
) {

    /** Отправить текстовое сообщение */
    suspend fun execute(
        chatId: String,
        content: String,
        senderId: String,
        senderName: String,
        chatType: ChatType = ChatType.DIRECT,
        replyTo: String? = null,
    ): Message {
        // Для секретных чатов — шифруем (TODO: получить ratchet state из хранилища)
        val finalContent = if (chatType == ChatType.SECRET) {
            // Имитация шифрования
            "[ENCRYPTED] $content"
        } else {
            content
        }

        val message = Message(
            id = generateMessageId(),
            chatId = chatId,
            senderId = senderId,
            senderName = senderName,
            content = finalContent,
            type = MessageType.TEXT,
            status = DeliveryStatus.SENDING,
            replyTo = replyTo,
            createdAt = Clock.System.now().toString(),
        )

        // Отправить через WebSocket
        webSocket.sendMessage(chatId, finalContent)

        return message.copy(status = DeliveryStatus.SENT)
    }

    private fun generateMessageId(): String = "msg-${Clock.System.now().toEpochMilliseconds()}"
}
