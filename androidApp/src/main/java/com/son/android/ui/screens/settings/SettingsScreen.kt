package com.son.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.son.android.ui.theme.SonColors

/** Экран настроек в стиле iOS */
@Composable
fun SettingsScreen() {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Профиль
        item {
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text("В", color = MaterialTheme.colorScheme.onPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(12.dp))
                Text("Владимир", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                Text("+7 (999) 123-45-67", fontSize = 14.sp, color = SonColors.TextSecondary)
            }
        }

        // Секции
        item { SettingsSection("Основные") }
        item { SettingsRow(Icons.Default.Person, "Профиль", "Изменить") }
        item { SettingsRow(Icons.Default.Palette, "Тема", "Тёмная") }

        item { SettingsSection("Уведомления") }
        item { SettingsRow(Icons.Default.Notifications, "Уведомления", "Включены") }
        item { SettingsRow(Icons.Default.VolumeUp, "Звук", "По умолчанию") }

        item { SettingsSection("Конфиденциальность") }
        item { SettingsRow(Icons.Default.Shield, "Онлайн-статус", "Все") }
        item { SettingsRow(Icons.Default.Visibility, "Отчёты о прочтении", "Вкл") }
        item { SettingsRow(Icons.Default.Lock, "Блокировка", "Выкл") }

        item { SettingsSection("Данные") }
        item { SettingsRow(Icons.Default.Storage, "Хранилище", "1.2 ГБ") }
        item { SettingsRow(Icons.Default.Security, "Шифрование", "Signal Protocol") }

        item { SettingsSection("О приложении") }
        item { SettingsRow(Icons.Default.Info, "Версия", "1.0.0") }

        item { Spacer(Modifier.height(32.dp)) }
    }
}

@Composable
fun SettingsSection(title: String) {
    Text(
        title.uppercase(),
        modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 8.dp),
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = SonColors.TextSecondary
    )
}

@Composable
fun SettingsRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, label, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, modifier = Modifier.weight(1f), fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
        Text(value, fontSize = 14.sp, color = SonColors.TextSecondary)
        Spacer(Modifier.width(4.dp))
        Icon(Icons.Default.ChevronRight, "Далее", tint = SonColors.Separator, modifier = Modifier.size(18.dp))
    }
    HorizontalDivider(modifier = Modifier.padding(start = 50.dp), thickness = 0.5.dp, color = SonColors.Separator)
}
