package com.son.network

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json
import com.son.model.*

/** HTTP клиент для REST API */
class ApiClient(private val baseUrl: String = "http://localhost:4000") {

    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true; isLenient = true })
        }
    }

    private var token: String? = null

    /** Установить JWT токен */
    fun setToken(jwt: String) { token = jwt }

    /** Регистрация */
    suspend fun register(phone: String, displayName: String, password: String): AuthResponse {
        return client.post("$baseUrl/api/auth/register") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("phone" to phone, "display_name" to displayName, "password" to password))
        }.body()
    }

    /** Вход */
    suspend fun login(phone: String, password: String): AuthResponse {
        return client.post("$baseUrl/api/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("phone" to phone, "password" to password))
        }.body()
    }

    /** Получить профиль */
    suspend fun getProfile(): User {
        return client.get("$baseUrl/api/users/me") {
            bearerAuth(token ?: "")
        }.body()
    }

    /** Получить список чатов */
    suspend fun getChats(): List<Chat> {
        return client.get("$baseUrl/api/chats") {
            bearerAuth(token ?: "")
        }.body()
    }

    /** Поиск пользователей */
    suspend fun searchUsers(query: String): List<User> {
        return client.get("$baseUrl/api/users/search") {
            parameter("q", query)
            bearerAuth(token ?: "")
        }.body()
    }
}

/** Ответ аутентификации */
@kotlinx.serialization.Serializable
data class AuthResponse(
    val token: String,
    val user: User,
)
