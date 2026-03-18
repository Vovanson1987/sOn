# sOn Messenger — Mobile Strategy (KMP)

## 1. Почему Kotlin Multiplatform

Для мессенджера с E2E-шифрованием KMP — оптимальный выбор:

| Критерий | KMP | React Native | Flutter |
|----------|-----|-------------|---------|
| **Криптография** | Нативный код, один раз | JS-мост, overhead | Dart FFI, сложнее |
| **UI** | Нативный (Compose/SwiftUI) | Нативный* (мост) | Свой движок |
| **Производительность** | Максимальная | Мост = задержки | Хорошая |
| **Push/CallKit** | Прямой API | Плагины | Плагины |
| **Безопасность** | Keystore/Keychain напрямую | Через плагины | Через плагины |
| **Размер приложения** | 15-25 MB (с Compose, Ktor, SQLDelight, Libsodium) | ~50MB+ движок | ~20MB+ движок |
| **Общий код** | ~65% | ~60-70% (с нативными интеграциями) | ~90% (но свой рендер) |

> \* React Native UI — через JS-мост к нативным компонентам

---

## 2. Архитектура KMP-проекта

```
messenger-kmp/
│
├── shared/                          # Общий код (Kotlin) — 60-70%
│   └── src/
│       ├── commonMain/kotlin/com/son/
│       │   ├── crypto/
│       │   │   ├── X3DH.kt                    # Extended Triple Diffie-Hellman
│       │   │   ├── DoubleRatchet.kt            # Double Ratchet Algorithm
│       │   │   ├── SignalSession.kt            # Управление сессиями
│       │   │   ├── KeyPairGenerator.kt         # Curve25519 ключи
│       │   │   ├── MessageEncryptor.kt         # AES-256-GCM шифрование
│       │   │   ├── KeyStore.kt                 # Хранение ключей (expect/actual)
│       │   │   ├── FingerprintGenerator.kt     # Визуальные отпечатки (эмодзи + hex)
│       │   │   └── SelfDestructTimer.kt        # Таймер самоуничтожения
│       │   ├── network/
│       │   │   ├── WebSocketClient.kt          # WebSocket соединение (Ktor)
│       │   │   ├── ApiClient.kt                # REST API (Ktor HttpClient)
│       │   │   ├── MessageTransport.kt         # Отправка/получение сообщений
│       │   │   ├── PresenceManager.kt          # Онлайн-статусы
│       │   │   ├── SyncEngine.kt               # Синхронизация offline → online
│       │   │   ├── RetryPolicy.kt              # Reconnect + exponential backoff
│       │   │   └── CertificatePinner.kt        # Certificate pinning
│       │   ├── data/                # Models + Repository + SQLDelight
│       │   ├── domain/              # Use Cases
│       │   ├── viewmodel/           # Shared ViewModels
│       │   └── util/                # Утилиты
│       │
│       ├── androidMain/kotlin/         # Android-специфичный код
│       │   ├── crypto/AndroidKeyStore.kt        # Android Keystore для ключей
│       │   ├── network/AndroidWebSocket.kt      # OkHttp WebSocket
│       │   ├── notifications/FcmService.kt      # Firebase Cloud Messaging
│       │   ├── media/AndroidMediaRecorder.kt    # Запись голосовых
│       │   ├── biometric/AndroidBiometric.kt    # Fingerprint / Face Unlock
│       │   └── calls/AndroidCallService.kt      # ConnectionService / Telecom API
│       │
│       ├── iosMain/kotlin/             # iOS-специфичный код
│       │   ├── crypto/IosKeyChain.kt            # iOS Keychain для ключей
│       │   ├── network/IosWebSocket.kt          # URLSessionWebSocketTask
│       │   ├── notifications/ApnsPush.kt        # Apple Push Notification Service
│       │   ├── media/IosMediaRecorder.kt        # AVAudioRecorder
│       │   ├── biometric/IosBiometric.kt        # Face ID / Touch ID
│       │   └── calls/CallKitIntegration.kt      # Интеграция с CallKit
│       │
│       └── commonTest/              # Общие тесты
│
├── androidApp/                      # Jetpack Compose UI
│   └── src/main/kotlin/com/son/android/
│       ├── ui/
│       │   ├── theme/               # iOS Dark тема для Compose
│       │   ├── chatlist/            # ChatListScreen
│       │   ├── conversation/        # ConversationScreen
│       │   ├── secretchat/          # SecretChatScreen
│       │   ├── calls/               # CallScreen
│       │   ├── settings/            # SettingsScreen
│       │   └── components/          # Avatar, FrostedGlassBar, ...
│       └── service/
│           ├── MessengerFirebaseService.kt
│           └── CallService.kt
│
├── iosApp/                          # SwiftUI UI
│   └── iosApp/
│       ├── Views/
│       │   ├── ChatList/
│       │   ├── Conversation/
│       │   ├── SecretChat/
│       │   ├── Calls/
│       │   ├── Settings/
│       │   └── Components/
│       ├── Services/
│       │   ├── CallKitProvider.swift
│       │   └── NotificationService.swift
│       └── Extensions/
│
├── webApp/                          # React/TypeScript (Web MVP)
│
├── backend/                         # Серверная часть
│
└── proto/                           # Protobuf-схемы
    ├── messages.proto
    ├── auth.proto
    ├── calls.proto
    └── encryption.proto
```

---

## 3. Общие модули (commonMain)

### 3.1 Распределение кода

| Модуль | Описание | % общего кода |
|--------|----------|:-------------:|
| **crypto** | Signal Protocol: X3DH, Double Ratchet, AES-256-GCM | 90% |
| **network** | Ktor Client + WebSocket, reconnect, cert pinning | 85% |
| **data/models** | User, Chat, Message, Attachment, SecretChat | 100% |
| **data/database** | SQLDelight — локальная БД | 95% |
| **data/repository** | ChatRepository, MessageRepository, KeyRepository | 90% |
| **domain** | Use cases (SendMessage, CreateSecretChat, ...) | 100% |
| **viewmodel** | Shared ViewModels (Kotlin Coroutines + Flow) | 85% |
| **util** | Форматирование, Base64, логирование | 65% |
| **webrtc** | Аудио/видео звонки (нативный код) | 0% (полностью платформо-специфичный) |
| | **ИТОГО** | **~60%** |

### 3.2 expect/actual — Платформо-специфичный код

```kotlin
// ═══ commonMain ═══
expect class SecureKeyStorage {
    fun storePrivateKey(keyId: String, keyData: ByteArray)
    fun retrievePrivateKey(keyId: String): ByteArray?
    fun deleteKey(keyId: String)
    fun hasKey(keyId: String): Boolean
}

expect class BiometricAuth {
    suspend fun authenticate(reason: String): BiometricResult
    fun isAvailable(): Boolean
}

expect class PushNotificationManager {
    fun registerForPush()
    fun getToken(): String?
}

// ═══ androidMain ═══
actual class SecureKeyStorage {
    // Android Keystore + StrongBox
}

actual class BiometricAuth {
    // BiometricPrompt API
}

actual class PushNotificationManager {
    // Firebase Cloud Messaging
}

// ═══ iosMain ═══
actual class SecureKeyStorage {
    // iOS Keychain + Secure Enclave
}

actual class BiometricAuth {
    // LocalAuthentication (Face ID / Touch ID)
}

actual class PushNotificationManager {
    // APNs + PushKit
}
```

#### Дополнительные expect/actual классы

```kotlin
// ═══ commonMain ═══
expect class WebSocketEngine {
    fun connect(url: String, token: String)
    fun send(message: ByteArray)
    fun disconnect()
    fun onMessage(handler: (ByteArray) -> Unit)
}

expect class MediaRecorder {
    suspend fun startRecording(): Flow<Float>  // amplitude 0-1
    suspend fun stopRecording(): ByteArray      // opus-encoded audio
    fun isRecording(): Boolean
}

expect class CoroutineDispatchers {
    val main: CoroutineDispatcher
    val io: CoroutineDispatcher
    val default: CoroutineDispatcher
}

// ═══ androidMain ═══
actual class WebSocketEngine {
    // OkHttp WebSocket (okhttp3.WebSocket)
}

actual class MediaRecorder {
    // Android MediaRecorder API (android.media.MediaRecorder)
}

actual class CoroutineDispatchers {
    // Dispatchers.Main (Main thread)
    // Dispatchers.IO (IO thread pool)
    // Dispatchers.Default (CPU-bound)
}

// ═══ iosMain ═══
actual class WebSocketEngine {
    // URLSessionWebSocketTask (Foundation)
}

actual class MediaRecorder {
    // AVAudioRecorder (AVFoundation)
}

actual class CoroutineDispatchers {
    // NSRunLoop-based main dispatcher
    // Background dispatch queues for IO/Default
}
```

---

## 4. KMP-библиотеки

| Назначение | Библиотека | Платформы |
|-----------|-----------|-----------|
| HTTP + WebSocket | **Ktor Client** | Android, iOS, Web |
| Локальная БД | **SQLDelight** | Android, iOS, Web |
| Сериализация | **kotlinx.serialization** | Все |
| Корутины | **kotlinx.coroutines** | Все |
| DI | **Koin** | Все |
| Shared ViewModel | **KMP-ViewModel (Rickclephas)**. Альтернатива: androidx.lifecycle:lifecycle-viewmodel-compose 2.8+ (официальная поддержка KMP от Google, начиная с Kotlin 2.0) | Android, iOS |
| Криптография | **com.ionspin.kotlin:multiplatform-crypto-libsodium-bindings:0.9.2** (Libsodium KMP) | Android, iOS |
| Навигация | **Decompose 3.x** | Android, iOS |
| Дата/время | **kotlinx-datetime** | Все |
| Логирование | **Napier** | Все |
| Настройки | **multiplatform-settings** | Android, iOS |
| Protobuf | **pbandk** | Все |
| WebRTC | **нативный** — expect/actual | Android (Google WebRTC SDK), iOS (Apple WebRTC SDK) |
| Изображения | **Coil 3** (Android) / **SDWebImageSwiftUI** (iOS) | Раздельно |

---

## 5. Нативные интеграции

### 5.1 Android-only

| Функция | API |
|---------|-----|
| Push-уведомления | Firebase Cloud Messaging |
| Аппаратные ключи | Android Keystore + StrongBox |
| Биометрия | BiometricPrompt |
| Фоновые звонки | Foreground Service + ConnectionService |
| Запись медиа | CameraX + MediaStore |
| Фоновая синхронизация | WorkManager |
| Уведомления | Notification Channels (сообщения / звонки / системные) |
| Screen sharing | MediaProjection API |
| WebRTC | Google WebRTC SDK (libwebrtc) |
| Иконка | Adaptive Icon |

### 5.2 iOS-only

| Функция | API |
|---------|-----|
| Системные звонки | CallKit (CXProvider) |
| VoIP Push | PushKit |
| E2E push дешифрация | Notification Service Extension |
| Аппаратные ключи | Keychain + Secure Enclave |
| Биометрия | LocalAuthentication (Face ID / Touch ID) |
| Тактильная отдача | Core Haptics |
| Шаринг | ShareExtension |
| Виджет | WidgetKit |
| Dynamic Island | Live Activities |
| WebRTC | Apple WebRTC SDK |
| Голосовой помощник | App Intents (Siri) |

---

## 6. План миграции

```
ФАЗА 0: WEB MVP (Месяцы 1-4)                    ← ТЕКУЩАЯ ФАЗА
├── React + TypeScript фронтенд
├── Базовый бэкенд: Elixir/Phoenix + PostgreSQL
├── WebSocket real-time
├── Web Crypto API для E2E
└── Docker + docker-compose

ФАЗА 1: SHARED CORE (Месяцы 5-8)
├── Создание KMP-проекта (shared модуль)
├── Перенос моделей данных в Kotlin
├── Signal Protocol на Kotlin (X3DH + Double Ratchet)
├── Ktor Client + WebSocket
├── SQLDelight (локальная БД)
└── Тесты: crypto 100%, domain 90%

ФАЗА 2: ANDROID (Месяцы 9-14)
├── Jetpack Compose UI
├── Firebase Cloud Messaging
├── Android Keystore
├── BiometricPrompt
├── CameraX + MediaStore
└── Google Play Internal Testing → Release

ФАЗА 3: iOS (Месяцы 15-20)
├── SwiftUI UI
├── CallKit + PushKit
├── Keychain + Secure Enclave
├── Core Haptics
├── Live Activities + Dynamic Island
└── TestFlight → App Store

ФАЗА 4: СИНХРОНИЗАЦИЯ (Месяцы 21-26)
├── Multi-device (Sesame Protocol)
├── Web ↔ Android ↔ iOS синхронизация
├── Desktop: Tauri обёртка
├── Accessibility + Локализация (RU, EN, KZ)
└── Performance optimization

ФАЗА 5: МАСШТАБИРОВАНИЕ (Месяц 27+)
├── Post-Quantum Cryptography (CRYSTALS-Kyber)
├── Decentralized identity
├── Open source клиенты
├── Security audit
└── Federation

> Сроки рассчитаны для команды из 3-5 разработчиков
```

---

## 7. Общая схема архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                      КЛИЕНТЫ                                │
│  ┌───────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │  Web App  │  │  Android App  │  │      iOS App        │  │
│  │ React/TS  │  │Jetpack Compose│  │      SwiftUI        │  │
│  └─────┬─────┘  └──────┬────────┘  └──────────┬──────────┘  │
│        │        ┌──────┴──────────────────────┘             │
│        │        │    KMP Shared Module (com.son)            │
│        │        │    Signal Protocol + Ktor + SQLDelight    │
└────────┼────────┼───────────────────────────────────────────┘
         │        │
    WebSocket  WebSocket + gRPC (inter-service only)
         │        │
┌────────┴────────┴───────────────────────────────────────────┐
│  Elixir/Phoenix │ Rust Crypto │ Go Push │ coturn (TURN)    │
│  Kafka │ PostgreSQL │ ScyllaDB │ Redis │ MinIO             │
│  Kubernetes + Istio + Vault + Prometheus                    │
└─────────────────────────────────────────────────────────────┘
```
