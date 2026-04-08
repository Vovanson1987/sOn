// sOn Messenger — десктопное приложение на Tauri
// Обёртка над Web-приложением с нативными интеграциями

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpProbeRequest {
    url: String,
    token: String,
    backend: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct McpProbeResponse {
    ok: bool,
    status: u16,
    backend: String,
    tool_count: usize,
    server_name: Option<String>,
    server_version: Option<String>,
    message: String,
}

fn extract_jsonrpc_error(body: &Value) -> Option<String> {
    body.get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

async fn close_mcp_session(client: &reqwest::Client, url: &str, token: &str, session_id: &str) {
    let mut headers = HeaderMap::new();
    headers.insert(
        HeaderName::from_static("mcp-session-id"),
        HeaderValue::from_str(session_id).unwrap_or_else(|_| HeaderValue::from_static("invalid")),
    );

    if !token.is_empty() {
        if let Ok(value) = HeaderValue::from_str(&format!("Bearer {token}")) {
            headers.insert(AUTHORIZATION, value);
        }
    }

    let _ = client.delete(url).headers(headers).send().await;
}

#[tauri::command]
async fn probe_mcp_connection(request: McpProbeRequest) -> Result<McpProbeResponse, String> {
    let url = request.url.trim().to_owned();
    if url.is_empty() {
        return Err("Укажи URL MCP gateway.".into());
    }

    let backend = request.backend.trim().to_lowercase();
    if backend != "claude" && backend != "codex" {
        return Err("Допустимые backend значения: claude или codex.".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|err| format!("Не удалось создать HTTP client: {err}"))?;

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/json, text/event-stream"),
    );
    headers.insert(
        HeaderName::from_static("x-agent-backend"),
        HeaderValue::from_str(&backend).map_err(|_| "Не удалось подготовить backend header.")?,
    );

    let token = request.token.trim();
    if !token.is_empty() {
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}"))
                .map_err(|_| "Bearer token содержит неподдерживаемые символы.")?,
        );
    }

    let initialize_response = client
        .post(&url)
        .headers(headers.clone())
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {
                    "name": "son-desktop",
                    "version": "1.0.0"
                }
            }
        }))
        .send()
        .await
        .map_err(|err| format!("MCP gateway недоступен: {err}"))?;

    let initialize_status = initialize_response.status().as_u16();
    let session_id = initialize_response
        .headers()
        .get("mcp-session-id")
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let initialize_body: Value = initialize_response
        .json()
        .await
        .map_err(|err| format!("Не удалось разобрать initialize response: {err}"))?;

    if let Some(message) = extract_jsonrpc_error(&initialize_body) {
        return Ok(McpProbeResponse {
            ok: false,
            status: initialize_status,
            backend,
            tool_count: 0,
            server_name: None,
            server_version: None,
            message,
        });
    }

    let Some(session_id) = session_id else {
        return Ok(McpProbeResponse {
            ok: false,
            status: initialize_status,
            backend,
            tool_count: 0,
            server_name: None,
            server_version: None,
            message: "MCP gateway не вернул session id после initialize.".into(),
        });
    };

    let server_name = initialize_body
        .pointer("/result/serverInfo/name")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let server_version = initialize_body
        .pointer("/result/serverInfo/version")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    let mut tool_headers = headers.clone();
    tool_headers.insert(
        HeaderName::from_static("mcp-session-id"),
        HeaderValue::from_str(&session_id)
            .map_err(|_| "Некорректный session id от MCP gateway.")?,
    );

    let tools_response = client
        .post(&url)
        .headers(tool_headers)
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }))
        .send()
        .await
        .map_err(|err| format!("Не удалось выполнить tools/list: {err}"))?;

    let tools_status = tools_response.status().as_u16();
    let tools_body: Value = tools_response
        .json()
        .await
        .map_err(|err| format!("Не удалось разобрать tools/list response: {err}"))?;

    close_mcp_session(&client, &url, token, &session_id).await;

    if let Some(message) = extract_jsonrpc_error(&tools_body) {
        return Ok(McpProbeResponse {
            ok: false,
            status: tools_status,
            backend,
            tool_count: 0,
            server_name,
            server_version,
            message,
        });
    }

    let tool_count = tools_body
        .pointer("/result/tools")
        .and_then(Value::as_array)
        .map(|tools| tools.len())
        .unwrap_or(0);

    Ok(McpProbeResponse {
        ok: true,
        status: tools_status,
        backend,
        tool_count,
        server_name,
        server_version,
        message: format!("Подключение подтверждено, доступно tools: {tool_count}"),
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![probe_mcp_connection])
        .run(tauri::generate_context!())
        .expect("Ошибка запуска sOn Desktop");
}
