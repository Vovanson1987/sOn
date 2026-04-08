#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

RUN_USER="${RUN_USER:-$(id -un)}"
SERVICE_TEMPLATE="$SCRIPT_DIR/systemd/mcp-watchdog.service"
TIMER_TEMPLATE="$SCRIPT_DIR/systemd/mcp-watchdog.timer"

if [[ ! -f "$SERVICE_TEMPLATE" || ! -f "$TIMER_TEMPLATE" ]]; then
  log_err "Systemd template files are missing under $SCRIPT_DIR/systemd"
  exit 1
fi

render_service() {
  sed \
    -e "s|__RUN_USER__|$RUN_USER|g" \
    -e "s|__ROOT_DIR__|$ROOT_DIR|g" \
    "$SERVICE_TEMPLATE"
}

log_info "Installing systemd watchdog unit files"
render_service | sudo tee /etc/systemd/system/mcp-watchdog.service >/dev/null
sudo cp "$TIMER_TEMPLATE" /etc/systemd/system/mcp-watchdog.timer

sudo systemctl daemon-reload
sudo systemctl enable --now mcp-watchdog.timer
sudo systemctl start mcp-watchdog.service

log_info "Watchdog timer installed and started"
sudo systemctl status mcp-watchdog.timer --no-pager -l | sed -n '1,20p'
