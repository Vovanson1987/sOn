package com.son.model

import kotlinx.serialization.Serializable

/** Пользователь */
@Serializable
data class User(
    val id: String,
    val phone: String,
    val username: String? = null,
    val displayName: String,
    val avatarUrl: String? = null,
    val statusText: String? = null,
    val isOnline: Boolean = false,
    val lastSeenAt: String? = null,
)

/** Контакт (расширение User с дополнительными полями) */
@Serializable
data class Contact(
    val id: String,
    val userId: String,
    val contactId: String,
    val nickname: String? = null,
    val isBlocked: Boolean = false,
    val user: User? = null,
)
