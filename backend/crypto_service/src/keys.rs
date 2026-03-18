use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use x25519_dalek::{EphemeralSecret, PublicKey};
use rand::rngs::OsRng;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Ключевая пара
#[derive(Serialize)]
pub struct KeyPairResponse {
    pub public_key: String,
    pub algorithm: String,
    pub created_at: String,
}

/// Генерация ключевой пары Curve25519
pub async fn generate_keypair() -> HttpResponse {
    let secret = EphemeralSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);

    HttpResponse::Ok().json(KeyPairResponse {
        public_key: BASE64.encode(public.as_bytes()),
        algorithm: "Curve25519".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Pre-key bundle пользователя
#[derive(Serialize)]
pub struct PreKeyBundle {
    pub identity_key: String,
    pub signed_pre_key: String,
    pub signed_pre_key_signature: String,
    pub one_time_pre_keys: Vec<String>,
}

/// Получить pre-key bundle пользователя
pub async fn get_prekey_bundle(path: web::Path<String>) -> HttpResponse {
    let user_id = path.into_inner();
    log::info!("Запрос pre-key bundle для пользователя: {}", user_id);

    // TODO: получить из БД
    HttpResponse::Ok().json(serde_json::json!({
        "user_id": user_id,
        "bundle": {
            "identity_key": BASE64.encode(b"mock-identity-key-32bytes-pad!!!"),
            "signed_pre_key": BASE64.encode(b"mock-signed-prekey-32bytes-pad!!"),
            "signed_pre_key_signature": BASE64.encode(b"mock-signature"),
            "one_time_pre_keys": [
                BASE64.encode(b"mock-otpk-1-32bytes-padded!!!!!"),
                BASE64.encode(b"mock-otpk-2-32bytes-padded!!!!!")
            ]
        }
    }))
}

/// Загрузить one-time pre-keys
pub async fn upload_prekeys(body: web::Json<serde_json::Value>) -> HttpResponse {
    log::info!("Загрузка pre-keys: {:?}", body);
    HttpResponse::Created().json(serde_json::json!({"status": "uploaded"}))
}

/// Ротация signed pre-key
pub async fn rotate_signed_prekey(body: web::Json<serde_json::Value>) -> HttpResponse {
    log::info!("Ротация signed pre-key: {:?}", body);
    HttpResponse::Ok().json(serde_json::json!({"status": "rotated"}))
}
