package com.son.android

import com.son.util.SecureKeyStorage

/** Android: хранение ключей через Android Keystore */
actual class SecureKeyStorage {
    // TODO: реализовать через android.security.keystore.KeyGenParameterSpec
    private val store = mutableMapOf<String, ByteArray>()

    actual fun saveKey(alias: String, key: ByteArray) { store[alias] = key }
    actual fun getKey(alias: String): ByteArray? = store[alias]
    actual fun deleteKey(alias: String) { store.remove(alias) }
    actual fun hasKey(alias: String): Boolean = store.containsKey(alias)
}
