package com.son.model

import kotlinx.serialization.Serializable

/** Тип сообщения */
enum class MessageType { TEXT, IMAGE, FILE, VOICE, LOCATION, SYSTEM }

/** Статус доставки */
enum class DeliveryStatus { SENDING, SENT, DELIVERED, READ, FAILED }

/** Сообщение */
@Serializable
data class Message(
    val id: String,
    val chatId: String,
    val senderId: String,
    val senderName: String,
    val content: String,
    val type: MessageType = MessageType.TEXT,
    val status: DeliveryStatus = DeliveryStatus.SENT,
    val replyTo: String? = null,
    val replyPreview: String? = null,
    val isForwarded: Boolean = false,
    val selfDestructAt: String? = null,
    val isDestroyed: Boolean = false,
    val reactions: Map<String, List<String>> = emptyMap(),
    val attachments: List<Attachment> = emptyList(),
    val createdAt: String,
    val deliveredAt: String? = null,
    val readAt: String? = null,
)

/** Вложение */
@Serializable
data class Attachment(
    val id: String,
    val type: String, // image, video, file, voice, location
    val url: String,
    val fileName: String? = null,
    val fileSize: Long? = null,
    val mimeType: String? = null,
    val duration: Int? = null, // для аудио/видео в секундах
    val width: Int? = null,
    val height: Int? = null,
    val thumbnailUrl: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)
