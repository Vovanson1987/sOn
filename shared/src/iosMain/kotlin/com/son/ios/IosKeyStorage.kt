package com.son.ios

import com.son.util.SecureKeyStorage

/** iOS: хранение ключей через Keychain + Secure Enclave */
actual class SecureKeyStorage {
    // TODO: реализовать через Security framework (SecItemAdd/SecItemCopyMatching)
    private val store = mutableMapOf<String, ByteArray>()

    actual fun saveKey(alias: String, key: ByteArray) { store[alias] = key }
    actual fun getKey(alias: String): ByteArray? = store[alias]
    actual fun deleteKey(alias: String) { store.remove(alias) }
    actual fun hasKey(alias: String): Boolean = store.containsKey(alias)
}
