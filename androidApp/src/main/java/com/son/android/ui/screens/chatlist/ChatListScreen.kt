package com.son.android.ui.screens.chatlist

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.son.android.ui.theme.SonColors

/** Моковые данные для списка чатов */
data class ChatPreview(
    val id: String,
    val name: String,
    val lastMessage: String,
    val time: String,
    val isOnline: Boolean = false,
    val isSecret: Boolean = false,
    val unreadCount: Int = 0,
    val initials: String,
    val color: Long,
)

val mockChats = listOf(
    ChatPreview("1", "Алексей", "🔒 Зашифрованное сообщение", "13:15", isSecret = true, initials = "АЛ", color = 0xFFFFC107),
    ChatPreview("2", "Vladimir", "Привет! Как дела?", "12:00", isOnline = true, initials = "VL", color = 0xFF9E9E9E),
    ChatPreview("3", "🏢 Работа SCIF", "Совещание перенесено на 15:00", "11:30", initials = "PS", color = 0xFFE91E63),
    ChatPreview("4", "🏠 Семья", "Всех с праздником!", "10:00", initials = "C", color = 0xFF4CAF50),
    ChatPreview("5", "900", "Владимир Николаевич, вы можете получить...", "Вчера", initials = "", color = 0xFF9E9E9E),
    ChatPreview("6", "Ксенька Доч", "📎 Файл: 49574f08d447...", "Пн", isOnline = true, initials = "КД", color = 0xFFFFC107),
    ChatPreview("7", "Папа Петропавловск", "Тест", "11 мар.", initials = "ПП", color = 0xFFE91E63),
    ChatPreview("8", "MIRATORG", "Код для подтверждения списания баллов", "11 мар.", initials = "MI", color = 0xFF9E9E9E),
)

/** Экран списка чатов */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen() {
    var searchQuery by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Верхняя панель
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { }) {
                Icon(Icons.Default.FilterList, "Фильтр", tint = SonColors.TextSecondary)
            }
            IconButton(onClick = { }) {
                Icon(Icons.Default.Edit, "Новое сообщение", tint = MaterialTheme.colorScheme.primary)
            }
        }

        // Поиск
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Поиск", color = SonColors.TextSecondary) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.outline,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            )
        )

        // Список чатов
        LazyColumn {
            items(mockChats.filter {
                searchQuery.isEmpty() || it.name.contains(searchQuery, ignoreCase = true)
            }) { chat ->
                ChatListItem(chat = chat, onClick = { /* TODO: открыть чат */ })
                HorizontalDivider(
                    modifier = Modifier.padding(start = 72.dp),
                    thickness = 0.5.dp,
                    color = SonColors.Separator
                )
            }
        }
    }
}

/** Элемент списка чатов */
@Composable
fun ChatListItem(chat: ChatPreview, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Аватар
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(androidx.compose.ui.graphics.Color(chat.color)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    chat.initials,
                    color = androidx.compose.ui.graphics.Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            if (chat.isOnline) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(SonColors.Online)
                )
            }
        }

        Spacer(Modifier.width(12.dp))

        // Текст
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (chat.isSecret) "🔒 ${chat.name}" else chat.name,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    chat.time,
                    color = SonColors.TextSecondary,
                    fontSize = 13.sp
                )
            }
            Text(
                chat.lastMessage,
                color = SonColors.TextSecondary,
                fontSize = 14.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
