package com.son.model

import kotlinx.serialization.Serializable

/** Тип чата */
enum class ChatType { DIRECT, GROUP, SECRET }

/** Роль участника */
enum class MemberRole { ADMIN, MEMBER }

/** Чат */
@Serializable
data class Chat(
    val id: String,
    val type: ChatType,
    val name: String? = null,
    val description: String? = null,
    val avatarUrl: String? = null,
    val createdBy: String? = null,
    val memberCount: Int = 0,
    val lastMessageAt: String? = null,
    val lastMessagePreview: String? = null,
    val unreadCount: Int = 0,
    val isMuted: Boolean = false,
    val isArchived: Boolean = false,
)

/** Участник чата */
@Serializable
data class ChatMember(
    val id: String,
    val chatId: String,
    val userId: String,
    val role: MemberRole = MemberRole.MEMBER,
    val user: User? = null,
)
