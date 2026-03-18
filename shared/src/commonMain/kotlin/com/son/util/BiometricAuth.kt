package com.son.util

/** Результат биометрической аутентификации */
enum class BiometricResult { SUCCESS, FAILED, NOT_AVAILABLE, CANCELLED }

/** Платформо-специфичная биометрическая аутентификация */
expect class BiometricAuth {
    /** Проверить доступность биометрии */
    fun isAvailable(): Boolean
    /** Запросить аутентификацию */
    suspend fun authenticate(reason: String): BiometricResult
}
