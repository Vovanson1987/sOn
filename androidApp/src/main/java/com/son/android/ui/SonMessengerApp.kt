package com.son.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.son.android.ui.theme.SonTheme
import com.son.android.ui.screens.chatlist.ChatListScreen
import com.son.android.ui.screens.settings.SettingsScreen

/** Корневой Composable — навигация + Tab Bar */
@Composable
fun SonMessengerApp() {
    SonTheme {
        val navController = rememberNavController()
        var selectedTab by remember { mutableIntStateOf(0) }

        Scaffold(
            bottomBar = {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.background.copy(alpha = 0.85f)
                ) {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        icon = { Icon(Icons.Default.Chat, "Чаты") },
                        label = { Text("Чаты") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        icon = { Icon(Icons.Default.Phone, "Звонки") },
                        label = { Text("Звонки") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        icon = { Icon(Icons.Default.Contacts, "Контакты") },
                        label = { Text("Контакты") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 3,
                        onClick = { selectedTab = 3 },
                        icon = { Icon(Icons.Default.Settings, "Настройки") },
                        label = { Text("Настройки") }
                    )
                }
            }
        ) { padding ->
            Box(modifier = Modifier.padding(padding)) {
                when (selectedTab) {
                    0 -> ChatListScreen()
                    1 -> PlaceholderScreen("Журнал звонков")
                    2 -> PlaceholderScreen("Контакты")
                    3 -> SettingsScreen()
                }
            }
        }
    }
}

@Composable
fun PlaceholderScreen(title: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = androidx.compose.ui.Alignment.Center
    ) {
        Text(title, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
    }
}
