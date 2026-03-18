package com.son.android.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * Foreground Service для аудио/видео звонков.
 * Поддерживает звонок при свёрнутом приложении.
 */
class CallService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d("CallService", "Действие: $action")

        when (action) {
            ACTION_START_CALL -> startCall(intent)
            ACTION_END_CALL -> endCall()
        }

        return START_NOT_STICKY
    }

    private fun startCall(intent: Intent?) {
        val contactName = intent?.getStringExtra(EXTRA_CONTACT_NAME) ?: "Неизвестный"
        val isVideo = intent?.getBooleanExtra(EXTRA_IS_VIDEO, false) ?: false
        Log.d("CallService", "Начало звонка: $contactName (видео: $isVideo)")
        // TODO: создать Foreground Notification + WebRTC
    }

    private fun endCall() {
        Log.d("CallService", "Завершение звонка")
        stopSelf()
    }

    companion object {
        const val ACTION_START_CALL = "com.son.android.START_CALL"
        const val ACTION_END_CALL = "com.son.android.END_CALL"
        const val EXTRA_CONTACT_NAME = "contact_name"
        const val EXTRA_IS_VIDEO = "is_video"
    }
}
