#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

STATE_FILE="${STATE_FILE:-/tmp/mcp-watchdog.state}"
ALERT_COOLDOWN_SECONDS="${ALERT_COOLDOWN_SECONDS:-600}"
MAX_RECOVERY_ATTEMPTS="${MAX_RECOVERY_ATTEMPTS:-1}"

now_epoch() {
  date +%s
}

read_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "0"
    return 0
  fi
  cat "$STATE_FILE"
}

write_state() {
  local value="$1"
  printf '%s\n' "$value" > "$STATE_FILE"
}

alert_once_per_cooldown() {
  local message="$1"
  local now
  local last_alert
  local rc=0

  now="$(now_epoch)"
  last_alert="$(read_state)"

  if [[ $((now - last_alert)) -lt "$ALERT_COOLDOWN_SECONDS" ]]; then
    log_warn "Alert throttled (cooldown active): $message"
    return 0
  fi

  send_webhook_alert "$message" || rc=$?
  if [[ "$rc" -eq 0 ]]; then
    write_state "$now"
    log_warn "Alert sent: $message"
    return 0
  fi
  if [[ "$rc" -eq 2 ]]; then
    log_warn "No alert channel configured (set MCP_ALERT_WEBHOOK_URL or MCP_ALERT_TELEGRAM_*)."
    return 0
  fi
  log_warn "Failed to deliver alert to configured channels."
  return 0
}

check_wrapper_backends() {
  local health_json
  health_json="$("$CURL_BIN" -fsS -m 8 "$(mcp_wrapper_health_url)")" || return 1

  if [[ -z "$NODE_BIN" ]]; then
    log_warn "NODE_BIN is not available; skipping backend availability checks."
    return 0
  fi

  local claude_enabled codex_enabled
  claude_enabled="$(env_or_default CLAUDE_ENABLED "true")"
  codex_enabled="$(env_or_default CODEX_REMOTE_ENABLED "true")"

  if ! printf '%s' "$health_json" | CLAUDE_ENABLED="$claude_enabled" CODEX_REMOTE_ENABLED="$codex_enabled" "$NODE_BIN" -e '
    const fs = require("node:fs");
    const body = JSON.parse(fs.readFileSync(0, "utf8"));
    const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
    const required = [];
    if (truthy(process.env.CLAUDE_ENABLED || "true")) required.push("claude");
    if (truthy(process.env.CODEX_REMOTE_ENABLED || "true")) required.push("codex");
    for (const backend of required) {
      const entry = body?.backends?.[backend];
      if (!entry || entry.available !== true) {
        const reason = entry?.reason || "unknown";
        console.error(`backend=${backend} unavailable reason=${reason}`);
        process.exit(1);
      }
    }
  '; then
    return 1
  fi
  return 0
}

is_healthy_now() {
  if ! has_pm2_process "$MCP_WRAPPER_PROCESS_NAME"; then
    log_warn "PM2 process not found: $MCP_WRAPPER_PROCESS_NAME"
    return 1
  fi

  if ! has_pm2_process "$MCP_BRIDGE_PROCESS_NAME"; then
    log_warn "PM2 process not found: $MCP_BRIDGE_PROCESS_NAME"
    return 1
  fi

  if ! is_pm2_process_online "$MCP_WRAPPER_PROCESS_NAME"; then
    log_warn "PM2 process is not online: $MCP_WRAPPER_PROCESS_NAME"
    return 1
  fi

  if ! is_pm2_process_online "$MCP_BRIDGE_PROCESS_NAME"; then
    log_warn "PM2 process is not online: $MCP_BRIDGE_PROCESS_NAME"
    return 1
  fi

  if ! check_http_health "$(mcp_wrapper_health_url)"; then
    log_warn "Wrapper health check failed: $(mcp_wrapper_health_url)"
    return 1
  fi

  if ! check_wrapper_backends; then
    log_warn "Wrapper backend availability check failed"
    return 1
  fi

  if ! check_http_health "$(mcp_bridge_health_url)"; then
    log_warn "Bridge health check failed: $(mcp_bridge_health_url)"
    return 1
  fi

  return 0
}

run_recovery_cycle() {
  local attempts=0

  while [[ "$attempts" -lt "$MAX_RECOVERY_ATTEMPTS" ]]; do
    attempts=$((attempts + 1))
    log_warn "Running recovery attempt ${attempts}/${MAX_RECOVERY_ATTEMPTS}"
    if "$SCRIPT_DIR/restart-services.sh"; then
      sleep 2
      if is_healthy_now; then
        log_info "Recovery succeeded on attempt $attempts"
        return 0
      fi
    fi
  done

  return 1
}

if is_healthy_now; then
  log_info "Watchdog OK"
  exit 0
fi

if run_recovery_cycle; then
  exit 0
fi

alert_once_per_cooldown "MCP watchdog failed: processes unhealthy after recovery. host=$(hostname)"
log_err "Watchdog failed after all recovery attempts"
exit 1
