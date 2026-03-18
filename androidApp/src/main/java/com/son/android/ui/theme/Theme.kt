package com.son.android.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Цветовая палитра sOn в стиле iMessage Dark */
val SonDarkColors = darkColorScheme(
    primary = Color(0xFF007AFF),          // Акцентный синий
    onPrimary = Color.White,
    secondary = Color(0xFF34C759),         // Зелёный (секретные чаты)
    background = Color(0xFF000000),        // Чёрный фон
    surface = Color(0xFF1C1C1E),           // Карточки
    surfaceVariant = Color(0xFF2C2C2E),    // Вторичные поверхности
    onBackground = Color.White,
    onSurface = Color.White,
    outline = Color(0xFF38383A),           // Разделители
    error = Color(0xFFFF3B30),             // Ошибки / красный
)

/** Дополнительные цвета */
object SonColors {
    val BubbleOutgoing = Color(0xFF007AFF)
    val BubbleIncoming = Color(0xFF26252A)
    val BubbleSecretOutgoing = Color(0xFF34C759)
    val BubbleSecretIncoming = Color(0xFF1E1E22)
    val TextSecondary = Color(0xFF8E8E93)
    val Separator = Color(0xFF38383A)
    val Online = Color(0xFF34C759)
    val Destructive = Color(0xFFFF3B30)
    val Warning = Color(0xFFFF9500)
}

@Composable
fun SonTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SonDarkColors,
        content = content
    )
}
