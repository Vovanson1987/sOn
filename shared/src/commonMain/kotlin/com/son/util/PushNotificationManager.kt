package com.son.util

/** Платформо-специфичное управление push-уведомлениями */
expect class PushNotificationManager {
    /** Получить push-токен устройства */
    suspend fun getToken(): String?
    /** Зарегистрировать токен на сервере */
    suspend fun registerToken(token: String)
}
