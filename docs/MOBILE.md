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
| **Размер приложения** | Минимальный | ~50MB+ движок | ~20MB+ движок |
| **Общий код** | ~65% | ~85% (но с ограничениями) | ~90% (но свой рендер) |

---

## 2. Архитектура KMP-проекта

```
messenger-kmp/
│
├── shared/                          # Общий код (Kotlin) — 60-70%
│   └── src/
│       ├── commonMain/kotlin/com/son/
│       │   ├── crypto/              # Signal Protocol
│       │   ├── network/             # Ktor Client + WebSocket
│       │   ├── data/                # Models + Repository + SQLDelight
│       │   ├── domain/              # Use Cases
│       │   ├── viewmodel/           # Shared ViewModels
│       │   └── util/                # Утилиты
│       │
│       ├── androidMain/             # Android-специфичный код
│       │   ├── crypto/AndroidKeyStore.kt
│       │   ├── notifications/FcmService.kt
│       │   └── biometric/AndroidBiometric.kt
│       │
│       ├── iosMain/                 # iOS-специфичный код
│       │   ├── crypto/IosKeyChain.kt
│       │   ├── notifications/ApnsPush.kt
│       │   ├── biometric/IosBiometric.kt
│       │   └── calls/CallKitIntegration.kt
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
| **util** | Форматирование, Base64, логирование | 80% |
| | **ИТОГО** | **~65%** |

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

---

## 4. KMP-библиотеки

| Назначение | Библиотека | Платформы |
|-----------|-----------|-----------|
| HTTP + WebSocket | **Ktor Client** | Android, iOS, Web |
| Локальная БД | **SQLDelight** | Android, iOS, Web |
| Сериализация | **kotlinx.serialization** | Все |
| Корутины | **kotlinx.coroutines** | Все |
| DI | **Koin** | Все |
| Shared ViewModel | **KMP-ViewModel** | Android, iOS |
| Криптография | **Libsodium KMP** | Android, iOS |
| Навигация | **Decompose** | Android, iOS |
| Дата/время | **kotlinx-datetime** | Все |
| Логирование | **Napier** | Все |
| Настройки | **multiplatform-settings** | Android, iOS |
| Protobuf | **pbandk** | Все |

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
| Голосовой помощник | App Intents (Siri) |

---

## 6. План миграции

```
ФАЗА 0: WEB MVP (Месяцы 1-3)                    ← ТЕКУЩАЯ ФАЗА
├── React + TypeScript фронтенд
├── Базовый бэкенд: Elixir/Phoenix + PostgreSQL
├── WebSocket real-time
├── Web Crypto API для E2E
└── Docker + docker-compose

ФАЗА 1: SHARED CORE (Месяцы 3-5)
├── Создание KMP-проекта (shared модуль)
├── Перенос моделей данных в Kotlin
├── Signal Protocol на Kotlin (X3DH + Double Ratchet)
├── Ktor Client + WebSocket
├── SQLDelight (локальная БД)
└── Тесты: crypto 100%, domain 90%

ФАЗА 2: ANDROID (Месяцы 5-7)
├── Jetpack Compose UI
├── Firebase Cloud Messaging
├── Android Keystore
├── BiometricPrompt
├── CameraX + MediaStore
└── Google Play Internal Testing → Release

ФАЗА 3: iOS (Месяцы 7-9)
├── SwiftUI UI
├── CallKit + PushKit
├── Keychain + Secure Enclave
├── Core Haptics
├── Live Activities + Dynamic Island
└── TestFlight → App Store

ФАЗА 4: СИНХРОНИЗАЦИЯ (Месяцы 9-11)
├── Multi-device (Sesame Protocol)
├── Web ↔ Android ↔ iOS синхронизация
├── Desktop: Tauri обёртка
├── Accessibility + Локализация (RU, EN, KZ)
└── Performance optimization

ФАЗА 5: МАСШТАБИРОВАНИЕ (Месяц 12+)
├── Post-Quantum Cryptography (CRYSTALS-Kyber)
├── Decentralized identity
├── Open source клиенты
├── Security audit
└── Federation
```
