package com.son.android

import android.app.Application
import com.son.android.di.appModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

/** Точка входа приложения — инициализация DI */
class SonApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@SonApp)
            modules(appModule)
        }
    }
}
