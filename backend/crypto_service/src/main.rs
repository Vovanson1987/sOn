use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};

mod keys;

/// Конфигурация сервера
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    log::info!("🔐 sOn Crypto Service запущен на :8080");

    HttpServer::new(|| {
        App::new()
            .wrap(middleware::Logger::default())
            .route("/health", web::get().to(health))
            .service(
                web::scope("/api/keys")
                    .route("/generate", web::post().to(keys::generate_keypair))
                    .route("/prekey-bundle/{user_id}", web::get().to(keys::get_prekey_bundle))
                    .route("/prekey-bundle", web::post().to(keys::upload_prekeys))
                    .route("/signed-prekey", web::put().to(keys::rotate_signed_prekey))
            )
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}

/// Проверка здоровья сервиса
async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "son-crypto-service",
        "version": "0.1.0"
    }))
}
