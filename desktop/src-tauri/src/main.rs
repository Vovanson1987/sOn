// sOn Messenger — десктопное приложение на Tauri
// Обёртка над Web-приложением с нативными интеграциями

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri::plugin::shell::init())
        .run(tauri::generate_context!())
        .expect("Ошибка запуска sOn Desktop");
}
