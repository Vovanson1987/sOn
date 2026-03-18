# sOn Messenger — Security & Encryption

## 1. Обзор модели безопасности

sOn использует **Zero-Knowledge Architecture**: сервер никогда не имеет доступа к открытому тексту сообщений. Вся криптография выполняется на устройствах пользователей.

```
┌──────────┐                              ┌──────────┐
│ Алиса    │                              │   Боб    │
│          │                              │          │
│ Plaintext│   ┌──────────────────────┐   │ Plaintext│
│    ↓     │   │      СЕРВЕР          │   │    ↑     │
│ Encrypt  │──→│  Хранит ТОЛЬКО       │──→│ Decrypt  │
│ (AES-256)│   │  зашифрованные blob  │   │ (AES-256)│
│          │   │  Нет ключей          │   │          │
│ Private  │   │  Нет доступа к       │   │ Private  │
│ Key: ███ │   │  содержимому          │   │ Key: ███ │
└──────────┘   └──────────────────────┘   └──────────┘
```

---

## 2. Signal Protocol — Детальная реализация

### 2.1 Ключи пользователя

Каждое устройство генерирует при регистрации:

| Ключ | Алгоритм | Назначение | Срок жизни |
|------|----------|-----------|------------|
| **Identity Key (IK)** | Curve25519 | Долгосрочная идентификация устройства | Постоянный |
| **Signed Pre-Key (SPK)** | Curve25519 | Подписанный пре-ключ для X3DH | 7 дней (ротация) |
| **One-Time Pre-Keys (OPK)** | Curve25519 | Одноразовые ключи для X3DH | Одноразовый |
| **Ephemeral Key (EK)** | Curve25519 | Генерируется при каждом новом чате | Сессионный |

### 2.2 X3DH — Extended Triple Diffie-Hellman

Протокол начального обмена ключами при создании секретного чата.

```
Алиса (инициатор)                    Сервер                    Боб
     │                                  │                        │
     │  1. Запрос PreKey Bundle Боба    │                        │
     │ ────────────────────────────────→│                        │
     │                                  │                        │
     │  2. {IKb, SPKb, SPKb_sig, OPKb} │                        │
     │ ←────────────────────────────────│                        │
     │                                  │                        │
     │  3. Генерация EKa               │                        │
     │  4. Вычисление:                 │                        │
     │     DH1 = DH(IKa, SPKb)        │                        │
     │     DH2 = DH(EKa, IKb)         │                        │
     │     DH3 = DH(EKa, SPKb)        │                        │
     │     DH4 = DH(EKa, OPKb)*       │                        │
     │     SK = KDF(DH1‖DH2‖DH3‖DH4)  │                        │
     │                                  │                        │
     │  5. Initial message:            │                        │
     │     {IKa, EKa, OPKb_id,        │                        │
     │      encrypted_first_msg}       │                        │
     │ ────────────────────────────────→│  6. Forward to Bob    │
     │                                  │ ──────────────────────→│
     │                                  │                        │
     │                                  │  7. Боб вычисляет SK  │
     │                                  │     DH1 = DH(SPKb, IKa)
     │                                  │     DH2 = DH(IKb, EKa)
     │                                  │     DH3 = DH(SPKb, EKa)
     │                                  │     DH4 = DH(OPKb, EKa)*
     │                                  │     SK = KDF(...)      │
     │                                  │                        │
     │                                  │  8. Decrypt first msg │
     │                                  │     Удалить OPKb      │

* DH4 вычисляется только если OPK доступен
```

**KDF (Key Derivation Function):**
```
SK = HKDF-SHA256(
  salt: 0x00...00 (32 bytes),
  input: DH1 || DH2 || DH3 [|| DH4],
  info: "sOn-X3DH"
)
```

### 2.3 Double Ratchet

После установки общего секрета (SK) через X3DH, каждое сообщение использует уникальный ключ шифрования.

```
                Sending Chain                    Receiving Chain
                ─────────────                    ───────────────
  Root Key ──→ Chain Key 0                  Root Key ──→ Chain Key 0
                   │                                        │
                   ├──→ Message Key 0                       ├──→ Message Key 0
                   │                                        │
                Chain Key 1                              Chain Key 1
                   │                                        │
                   ├──→ Message Key 1                       ├──→ Message Key 1
                   │                                        │
                Chain Key 2                              Chain Key 2
                   ↓                                        ↓
                  ...                                      ...
```

**Ratchet Step:**
```
Chain Key[n+1] = HMAC-SHA256(Chain Key[n], 0x02)
Message Key[n] = HMAC-SHA256(Chain Key[n], 0x01)
```

**DH Ratchet (при каждой смене направления):**
```
Алиса → Боб: сообщение 1, 2, 3 (sending chain)
Боб → Алиса: сообщение 4        (DH ratchet step, новые chain keys)
Алиса → Боб: сообщение 5        (DH ratchet step, новые chain keys)
```

При каждом DH ratchet step:
```
DH_out = DH(my_ratchet_key, their_ratchet_key)
Root Key[n+1], Chain Key[n+1] = KDF(Root Key[n], DH_out)
```

### 2.4 Шифрование сообщения

```
Plaintext
    │
    ▼
┌──────────────────────────────────────┐
│  AES-256-GCM Encryption             │
│                                      │
│  Key:   Message Key (32 bytes)       │
│  IV:    Random 12 bytes              │
│  AAD:   sender_id ‖ message_number   │
│                                      │
│  Output: Ciphertext + Auth Tag       │
└──────────────────────────────────────┘
    │
    ▼
Encrypted Message = {
  header: {
    sender_ratchet_key: Curve25519 public key,
    previous_chain_length: N,
    message_number: M
  },
  ciphertext: AES-256-GCM encrypted data,
  iv: 12 bytes,
  auth_tag: 16 bytes
}
```

---

## 3. Верификация ключей

### 3.1 Fingerprint Generation

```
fingerprint_data = SHA-256(
  "sOn-fingerprint" ‖
  Alice_identity_key ‖
  Alice_user_id ‖
  Bob_identity_key ‖
  Bob_user_id
)
```

### 3.2 Эмодзи-отпечаток

Fingerprint (32 bytes) → разбивается на 16 блоков по 2 байта → каждый блок mod 256 → индекс в таблице эмодзи → сетка 4×4.

```
Emoji Pool (256 entries):
🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔
🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞
🐜🦟🦗🕷🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡
🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪
🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮
...
```

### 3.3 QR-код

QR содержит:
```
son://verify?
  v=1&
  ik1=base64_identity_key_alice&
  ik2=base64_identity_key_bob&
  fp=hex_fingerprint_first_16_bytes
```

---

## 4. Таймер самоуничтожения

### 4.1 Механизм

```
1. Алиса устанавливает таймер: 30 секунд
2. Алиса отправляет сообщение с self_destruct=30
3. Сообщение доставляется Бобу
4. Боб ОТКРЫВАЕТ чат (сообщение становится "прочитанным")
5. Таймер запускается: countdown 30с на обоих устройствах
6. По истечении:
   - Клиент Алисы: fade out + blur → "🔒 Сообщение удалено"
   - Клиент Боба: fade out + blur → "🔒 Сообщение удалено"
   - Сервер: DELETE message (через Kafka consumer с задержкой)
```

### 4.2 Серверная очистка

```
Kafka topic: messages.self_destruct
Consumer: проверяет каждые 5 секунд
Действия:
  1. DELETE из ScyllaDB (ciphertext)
  2. DELETE из MinIO (вложения, если есть)
  3. UPDATE в PostgreSQL (attachments.is_destroyed = true)
```

---

## 5. Безопасность транспортного уровня

### 5.1 TLS 1.3

- Все соединения: HTTPS / WSS
- Cipher suites: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256
- Certificate: Let's Encrypt (auto-renewal)
- HSTS: max-age=31536000; includeSubDomains; preload

### 5.2 Certificate Pinning (мобильные клиенты)

```kotlin
// Android (OkHttp)
val certificatePinner = CertificatePinner.Builder()
    .add("api.son-messenger.com", "sha256/AAAA...=")
    .add("api.son-messenger.com", "sha256/BBBB...=") // backup
    .build()

// iOS (URLSession)
func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge) {
    let serverTrust = challenge.protectionSpace.serverTrust
    let serverCert = SecTrustGetCertificateAtIndex(serverTrust, 0)
    // Compare SHA-256 of DER-encoded cert with pinned hash
}
```

### 5.3 HTTP Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  connect-src 'self' wss://api.son-messenger.com; img-src 'self' blob: data:;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 6. Аутентификация

### 6.1 Пароли

```
Алгоритм: Argon2id
Memory:    64 MB
Iterations: 3
Parallelism: 4
Salt:      16 bytes (crypto-random)
Output:    32 bytes
```

### 6.2 JWT Token Structure

```json
{
  "header": {
    "alg": "EdDSA",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_uuid",
    "dev": "device_uuid",
    "iat": 1710756000,
    "exp": 1710756900,
    "iss": "son-messenger"
  }
}
```

### 6.3 Rate Limiting

| Endpoint | Лимит | Окно |
|----------|-------|------|
| POST /auth/login | 5 | 60 сек |
| POST /auth/register | 3 | 300 сек |
| POST /chats/:id/messages | 60 | 60 сек |
| POST /media/upload | 10 | 60 сек |
| WebSocket events | 100 | 60 сек |

---

## 7. Хранение ключей на устройствах

### 7.1 Web (Web Crypto API + IndexedDB)

```javascript
// Генерация ключа — ключ НЕ извлекается из CryptoSubtle
const keyPair = await crypto.subtle.generateKey(
  { name: "ECDH", namedCurve: "P-256" },  // Fallback, т.к. Curve25519 limited support
  false,  // extractable: FALSE — ключ не покидает CryptoSubtle
  ["deriveKey", "deriveBits"]
);

// Хранение в IndexedDB (зашифрованная база)
// Ключ защищён CryptoSubtle — не может быть прочитан JS-кодом
```

### 7.2 Android (Android Keystore)

```kotlin
val keyPairGenerator = KeyPairGenerator.getInstance(
    KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore"
)
keyPairGenerator.initialize(
    KeyGenParameterSpec.Builder("son_identity_key", PURPOSE_SIGN or PURPOSE_AGREE_KEY)
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setUserAuthenticationRequired(true)  // Требует биометрию
        .setIsStrongBoxBacked(true)           // Аппаратный модуль (если доступен)
        .build()
)
```

### 7.3 iOS (Keychain + Secure Enclave)

```swift
let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    [.privateKeyUsage, .biometryCurrentSet],  // Face ID / Touch ID
    nil
)

let attributes: [String: Any] = [
    kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
    kSecAttrKeySizeInBits: 256,
    kSecAttrTokenID: kSecAttrTokenIDSecureEnclave,  // Secure Enclave
    kSecPrivateKeyAttrs: [kSecAttrAccessControl: access]
]
```

---

## 8. Threat Model

| Угроза | Защита |
|--------|--------|
| Man-in-the-Middle | TLS 1.3 + Certificate Pinning + E2E encryption |
| Компрометация сервера | Zero-Knowledge: сервер не имеет ключей дешифрации |
| Компрометация устройства | Ключи в Hardware Security Module (Keystore/Secure Enclave) |
| Replay Attack | Message numbers + nonce в AES-GCM |
| Перехват сессии | JWT с коротким TTL + device binding |
| Брутфорс пароля | Argon2id + Rate Limiting + Account Lockout |
| XSS | CSP + React auto-escaping + input sanitization |
| CSRF | SameSite cookies + CSRF tokens |
| Key Compromise | Perfect Forward Secrecy (Double Ratchet) |
| Quantum Computing (будущее) | Фаза 5: CRYSTALS-Kyber (PQC) |
