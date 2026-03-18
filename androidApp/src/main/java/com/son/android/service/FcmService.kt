package com.son.android.service

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Firebase Cloud Messaging — обработка push-уведомлений */
class FcmService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FcmService", "Новый FCM токен: $token")
        // TODO: отправить токен на сервер через ApiClient
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val type = message.data["type"] ?: "message"
        val chatId = message.data["chat_id"]
        val title = message.notification?.title ?: "sOn"
        val body = message.notification?.body ?: ""

        Log.d("FcmService", "Push: type=$type, chat=$chatId, title=$title")

        when (type) {
            "message" -> showMessageNotification(chatId, title, body)
            "call" -> showCallNotification(chatId, title)
            else -> Log.w("FcmService", "Неизвестный тип push: $type")
        }
    }

    private fun showMessageNotification(chatId: String?, title: String, body: String) {
        // TODO: показать уведомление через NotificationCompat
        Log.d("FcmService", "Уведомление о сообщении: $title — $body")
    }

    private fun showCallNotification(chatId: String?, callerName: String) {
        // TODO: показать полноэкранное уведомление о звонке
        Log.d("FcmService", "Входящий звонок от $callerName")
    }
}
