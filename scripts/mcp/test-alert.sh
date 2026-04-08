#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

MESSAGE="${1:-MCP watchdog test alert. host=$(hostname)}"
rc=0

send_webhook_alert "$MESSAGE" || rc=$?
if [[ "$rc" -eq 0 ]]; then
  log_info "Test alert delivered"
  exit 0
fi
if [[ "$rc" -eq 2 ]]; then
  log_warn "No alert channel configured. Set MCP_ALERT_WEBHOOK_URL or MCP_ALERT_TELEGRAM_* in $ENV_FILE"
  exit 2
fi

log_err "Failed to deliver test alert"
exit 1
