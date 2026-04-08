#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
PM2_BIN="${PM2_BIN:-$HOME/.npm-global/bin/pm2}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
CURL_BIN="${CURL_BIN:-$(command -v curl || true)}"

MCP_BRIDGE_PROCESS_NAME="${MCP_BRIDGE_PROCESS_NAME:-mcp-bridge-host}"
MCP_WRAPPER_PROCESS_NAME="${MCP_WRAPPER_PROCESS_NAME:-claude-mcp-wrapper}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at $ENV_FILE" >&2
  exit 1
fi

if [[ ! -x "$PM2_BIN" ]]; then
  echo "ERROR: pm2 not found at $PM2_BIN" >&2
  exit 1
fi

if [[ -z "$CURL_BIN" ]]; then
  echo "ERROR: curl not found in PATH" >&2
  exit 1
fi

get_env() {
  local key="$1"
  local line
  line="$(grep -m1 "^${key}=" "$ENV_FILE" || true)"
  printf '%s' "${line#*=}"
}

env_or_default() {
  local key="$1"
  local default_value="$2"
  local value
  value="$(get_env "$key")"
  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

has_pm2_process() {
  local name="$1"
  if [[ -n "$NODE_BIN" ]]; then
    "$PM2_BIN" jlist | "$NODE_BIN" -e '
      const fs = require("node:fs");
      const name = process.argv[1];
      const raw = fs.readFileSync(0, "utf8");
      const list = JSON.parse(raw);
      process.exit(list.some((p) => p.name === name) ? 0 : 1);
    ' "$name"
  else
    "$PM2_BIN" jlist | grep -q "\"name\":\"${name}\""
  fi
}

is_pm2_process_online() {
  local name="$1"
  if [[ -n "$NODE_BIN" ]]; then
    "$PM2_BIN" jlist | "$NODE_BIN" -e '
      const fs = require("node:fs");
      const name = process.argv[1];
      const raw = fs.readFileSync(0, "utf8");
      const list = JSON.parse(raw);
      const proc = list.find((p) => p.name === name);
      process.exit(proc && proc.pm2_env && proc.pm2_env.status === "online" ? 0 : 1);
    ' "$name"
  else
    "$PM2_BIN" jlist | tr -d "\n" | grep -q "\"name\":\"${name}\".*\"status\":\"online\""
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_file

  tmp_file="$(mktemp)"
  awk -v k="$key" -v v="$value" '
    BEGIN { updated = 0 }
    $0 ~ ("^" k "=") {
      if (!updated) {
        print k "=" v;
        updated = 1;
      }
      next;
    }
    { print }
    END {
      if (!updated) {
        print k "=" v;
      }
    }
  ' "$ENV_FILE" > "$tmp_file"

  mv "$tmp_file" "$ENV_FILE"
}

random_hex() {
  local bytes="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
    return 0
  fi
  if [[ -n "$NODE_BIN" ]]; then
    "$NODE_BIN" -e '
      const crypto = require("node:crypto");
      const bytes = Number.parseInt(process.argv[1], 10) || 32;
      process.stdout.write(crypto.randomBytes(bytes).toString("hex"));
    ' "$bytes"
    return 0
  fi
  return 1
}

mcp_bridge_port() {
  env_or_default MCP_BRIDGE_PORT "4100"
}

mcp_wrapper_port() {
  env_or_default CLAUDE_WRAPPER_PORT "8790"
}

mcp_bridge_health_url() {
  local port
  port="$(mcp_bridge_port)"
  printf 'http://127.0.0.1:%s/health' "$port"
}

mcp_wrapper_health_url() {
  local port
  port="$(mcp_wrapper_port)"
  printf 'http://127.0.0.1:%s/health' "$port"
}

json_text_payload() {
  local text="$1"
  if [[ -n "$NODE_BIN" ]]; then
    printf '%s' "$text" | "$NODE_BIN" -e '
      const fs = require("node:fs");
      const text = fs.readFileSync(0, "utf8");
      process.stdout.write(JSON.stringify({ text }));
    '
  else
    printf '{"text":"%s"}' "${text//\"/\\\"}"
  fi
}

log_info() {
  local msg="$1"
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] INFO $msg"
}

log_warn() {
  local msg="$1"
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] WARN $msg"
}

log_err() {
  local msg="$1"
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ERROR $msg" >&2
}

send_webhook_alert() {
  local text="$1"
  local webhook
  local tg_token
  local tg_chat_id
  local tg_api_base
  local attempted=0
  local delivered=0
  local payload

  webhook="$(get_env MCP_ALERT_WEBHOOK_URL)"
  tg_token="$(get_env MCP_ALERT_TELEGRAM_BOT_TOKEN)"
  tg_chat_id="$(get_env MCP_ALERT_TELEGRAM_CHAT_ID)"
  tg_api_base="$(env_or_default MCP_ALERT_TELEGRAM_API_BASE "https://api.telegram.org")"

  if [[ -n "$webhook" ]]; then
    attempted=1
    payload="$(json_text_payload "$text")"
    if "$CURL_BIN" -fsS -m 10 \
      -H 'Content-Type: application/json' \
      -d "$payload" \
      "$webhook" >/dev/null 2>&1; then
      delivered=1
    fi
  fi

  if [[ -n "$tg_token" && -n "$tg_chat_id" ]]; then
    attempted=1
    if "$CURL_BIN" -fsS -m 10 -X POST "${tg_api_base%/}/bot${tg_token}/sendMessage" \
      --data-urlencode "chat_id=${tg_chat_id}" \
      --data-urlencode "text=${text}" \
      --data-urlencode "disable_web_page_preview=true" >/dev/null 2>&1; then
      delivered=1
    fi
  fi

  if [[ "$attempted" -eq 0 ]]; then
    return 2
  fi
  if [[ "$delivered" -eq 1 ]]; then
    return 0
  fi
  return 1
}

check_http_health() {
  local url="$1"
  "$CURL_BIN" -fsS -m 8 "$url" >/dev/null
}
