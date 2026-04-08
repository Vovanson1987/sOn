#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

export PATH="$PATH:/home/son/.local/bin:/home/son/.npm-global/bin:$HOME/.local/bin:$HOME/.npm-global/bin"

WRAPPER_SCRIPT="$ROOT_DIR/mcp-bridge/multi-backend-wrapper.js"
BRIDGE_SCRIPT="$ROOT_DIR/mcp-bridge/index.js"

if [[ ! -f "$WRAPPER_SCRIPT" ]]; then
  log_err "Wrapper script not found: $WRAPPER_SCRIPT"
  exit 1
fi

if [[ ! -f "$BRIDGE_SCRIPT" ]]; then
  log_err "Bridge script not found: $BRIDGE_SCRIPT"
  exit 1
fi

export CLAUDE_WRAPPER_HOST="127.0.0.1"
export CLAUDE_WRAPPER_PORT="$(env_or_default CLAUDE_WRAPPER_PORT "8790")"
export CLAUDE_WRAPPER_IDLE_TIMEOUT_MS="$(env_or_default CLAUDE_WRAPPER_IDLE_TIMEOUT_MS "900000")"
export MCP_BACKEND_DEFAULT="$(env_or_default MCP_BACKEND_DEFAULT "claude")"
export CLAUDE_ENABLED="$(env_or_default CLAUDE_ENABLED "true")"
export CLAUDE_BIN="$(env_or_default CLAUDE_BIN "/home/son/.local/bin/claude")"
export CLAUDE_ARGS="$(env_or_default CLAUDE_ARGS "mcp serve")"
export CLAUDE_CWD="$(env_or_default CLAUDE_CWD "$ROOT_DIR")"
export CODEX_REMOTE_ENABLED="$(env_or_default CODEX_REMOTE_ENABLED "true")"
export CODEX_SSH_BIN="$(env_or_default CODEX_SSH_BIN "ssh")"
export CODEX_SSH_TARGET="$(env_or_default CODEX_SSH_TARGET "mac")"
export CODEX_REMOTE_CMD="$(env_or_default CODEX_REMOTE_CMD "/opt/homebrew/bin/codex mcp-server")"
export CODEX_REMOTE_CONNECT_TIMEOUT_MS="$(env_or_default CODEX_REMOTE_CONNECT_TIMEOUT_MS "8000")"

export PORT="$(env_or_default MCP_BRIDGE_PORT "4100")"
export BRIDGE_AUTH_TOKEN="$(env_or_default MCP_BRIDGE_AUTH_TOKEN "")"
export ALLOWED_ORIGINS="$(env_or_default MCP_BRIDGE_ALLOWED_ORIGINS "")"
export UPSTREAM_TRANSPORT="$(env_or_default MCP_BRIDGE_UPSTREAM_TRANSPORT "legacy-sse")"
export UPSTREAM_SSE_URL="$(env_or_default MCP_BRIDGE_UPSTREAM_SSE_URL "http://127.0.0.1:8790/sse")"
export UPSTREAM_HTTP_URL="$(env_or_default MCP_BRIDGE_UPSTREAM_HTTP_URL "http://127.0.0.1:8791/mcp")"
export UPSTREAM_AUTH_BEARER="$(env_or_default MCP_BRIDGE_UPSTREAM_AUTH_BEARER "")"
export UPSTREAM_HEADERS_JSON="$(env_or_default MCP_BRIDGE_UPSTREAM_HEADERS_JSON "")"

start_or_restart_pm2() {
  local process_name="$1"
  local script_path="$2"

  pm2_script_matches() {
    local name="$1"
    local expected="$2"
    if [[ -z "$NODE_BIN" ]]; then
      return 1
    fi
    "$PM2_BIN" jlist | "$NODE_BIN" -e '
      const fs = require("node:fs");
      const name = process.argv[1];
      const expected = process.argv[2];
      const list = JSON.parse(fs.readFileSync(0, "utf8"));
      const proc = list.find((entry) => entry.name === name);
      if (!proc) process.exit(1);
      process.exit(proc.pm2_env?.pm_exec_path === expected ? 0 : 1);
    ' "$name" "$expected"
  }

  if has_pm2_process "$process_name"; then
    if pm2_script_matches "$process_name" "$script_path"; then
      log_info "Restarting PM2 process: $process_name"
      "$PM2_BIN" restart "$process_name" --update-env >/dev/null
    else
      log_warn "PM2 process script changed for $process_name; recreating process"
      "$PM2_BIN" delete "$process_name" >/dev/null || true
      "$PM2_BIN" start "$script_path" --name "$process_name" --cwd "$ROOT_DIR" >/dev/null
    fi
  else
    log_info "Starting PM2 process: $process_name"
    "$PM2_BIN" start "$script_path" --name "$process_name" --cwd "$ROOT_DIR" >/dev/null
  fi
}

log_info "Applying environment and restarting MCP services"
start_or_restart_pm2 "$MCP_WRAPPER_PROCESS_NAME" "$WRAPPER_SCRIPT"
start_or_restart_pm2 "$MCP_BRIDGE_PROCESS_NAME" "$BRIDGE_SCRIPT"

log_info "Persisting PM2 process list"
"$PM2_BIN" save >/dev/null

log_info "Waiting for local health checks"
sleep 2

if ! check_http_health "$(mcp_wrapper_health_url)"; then
  log_err "Wrapper health check failed at $(mcp_wrapper_health_url)"
  exit 1
fi

if ! check_http_health "$(mcp_bridge_health_url)"; then
  log_err "Bridge health check failed at $(mcp_bridge_health_url)"
  exit 1
fi

log_info "MCP services are healthy"
