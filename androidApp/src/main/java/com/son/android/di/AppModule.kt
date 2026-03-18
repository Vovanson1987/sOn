package com.son.android.di

import com.son.network.ApiClient
import com.son.network.WebSocketClient
import com.son.domain.SendMessageUseCase
import com.son.domain.CreateSecretChatUseCase
import org.koin.dsl.module

/** Koin DI модуль */
val appModule = module {
    // Сетевой слой
    single { ApiClient("https://son-messenger.com") }
    single { WebSocketClient("wss://son-messenger.com/socket/websocket") }

    // Use cases
    factory { SendMessageUseCase(get()) }
    factory { CreateSecretChatUseCase() }
}
