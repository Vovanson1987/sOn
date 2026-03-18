package com.son.util

/** Платформо-специфичное безопасное хранение ключей */
expect class SecureKeyStorage {
    /** Сохранить ключ */
    fun saveKey(alias: String, key: ByteArray)
    /** Получить ключ */
    fun getKey(alias: String): ByteArray?
    /** Удалить ключ */
    fun deleteKey(alias: String)
    /** Проверить наличие ключа */
    fun hasKey(alias: String): Boolean
}
