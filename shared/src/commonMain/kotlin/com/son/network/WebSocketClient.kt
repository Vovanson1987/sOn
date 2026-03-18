package com.son.network

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import io.github.aakira.napier.Napier

/** Событие WebSocket */
sealed class WsEvent {
    data class NewMessage(val chatId: String, val data: String) : WsEvent()
    data class UserTyping(val chatId: String, val userId: String) : WsEvent()
    data class MessageDelivered(val messageId: String, val deliveredAt: String) : WsEvent()
    data class MessageRead(val messageId: String, val readAt: String) : WsEvent()
    data class PresenceUpdate(val userId: String, val isOnline: Boolean) : WsEvent()
    data class ReactionAdded(val messageId: String, val emoji: String, val userId: String) : WsEvent()
    data object Connected : WsEvent()
    data object Disconnected : WsEvent()
}

/** WebSocket клиент для Phoenix Channels */
class WebSocketClient(private val baseUrl: String = "ws://localhost:4000/socket/websocket") {

    private val _events = MutableSharedFlow<WsEvent>(replay = 0)

    /** Поток событий */
    val events: Flow<WsEvent> = _events

    private var token: String? = null

    /** Установить токен */
    fun setToken(jwt: String) { token = jwt }

    /** Подключиться к WebSocket */
    suspend fun connect() {
        Napier.i("WebSocket: подключение к $baseUrl")
        // TODO: реализовать через Ktor WebSocket или Phoenix Channels SDK
        _events.emit(WsEvent.Connected)
    }

    /** Отключиться */
    suspend fun disconnect() {
        Napier.i("WebSocket: отключение")
        _events.emit(WsEvent.Disconnected)
    }

    /** Подписаться на канал чата */
    suspend fun joinChat(chatId: String) {
        Napier.i("WebSocket: подключение к чату $chatId")
        // TODO: phoenix.join("chat:$chatId")
    }

    /** Отправить сообщение через WebSocket */
    suspend fun sendMessage(chatId: String, content: String, type: String = "text") {
        Napier.i("WebSocket: отправка в $chatId: $content")
        // TODO: phoenix.push("send_message", payload)
    }

    /** Отправить "печатает..." */
    suspend fun sendTyping(chatId: String) {
        // TODO: phoenix.push("user_typing", {})
    }
}
