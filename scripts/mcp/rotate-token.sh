#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

PRINT_TOKEN="${PRINT_TOKEN:-1}"
BACKUP_ENV="${BACKUP_ENV:-1}"

if ! new_token="$(random_hex 32)"; then
  log_err "Failed to generate random token"
  exit 1
fi

if [[ "$BACKUP_ENV" == "1" ]]; then
  backup_path="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "$backup_path"
  log_info "Created backup: $backup_path"
fi

set_env_value "MCP_BRIDGE_AUTH_TOKEN" "$new_token"
log_info "MCP_BRIDGE_AUTH_TOKEN rotated in $ENV_FILE"

if ! "$SCRIPT_DIR/restart-services.sh"; then
  log_err "Failed to restart services after token rotation"
  exit 1
fi

payload='{"jsonrpc":"2.0","id":"rotate-check","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-rotate","version":"1.0.0"}}}'

status="$("$CURL_BIN" -sS -o /tmp/mcp-rotate-check.out -w "%{http_code}" \
  -H "Authorization: Bearer ${new_token}" \
  -H 'Content-Type: application/json' \
  -d "$payload" \
  "http://127.0.0.1:$(mcp_bridge_port)/mcp" || true)"

if [[ "$status" != "200" ]]; then
  log_err "Token verification failed, HTTP status: $status"
  cat /tmp/mcp-rotate-check.out >&2 || true
  exit 1
fi

log_info "Token verification passed (HTTP 200)"

if [[ "$PRINT_TOKEN" == "1" ]]; then
  echo
  echo "NEW_MCP_BRIDGE_AUTH_TOKEN=$new_token"
  echo "Use in client header: Authorization: Bearer $new_token"
fi
