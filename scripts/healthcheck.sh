#!/bin/bash
# sOn Messenger Health Monitor
# Проверяет доступность всех сервисов и перезапускает при необходимости

LOG="/Users/vovanson/Desktop/Son/backups/healthcheck.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

check_container() {
  local name=$1
  local status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null)
  if [ "$status" != "healthy" ] && [ "$status" != "" ]; then
    echo "$TIMESTAMP [WARN] $name is $status — restarting..." >> "$LOG"
    docker restart "$name" >> "$LOG" 2>&1
    return 1
  fi
  return 0
}

# Check all containers
ISSUES=0
for svc in son-api son-web son-postgres son-redis son-minio; do
  if ! docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
    echo "$TIMESTAMP [CRIT] $svc is NOT running — starting all..." >> "$LOG"
    docker compose -f docker-compose.prod.yml up -d >> "$LOG" 2>&1
    ISSUES=1
    break
  fi
  check_container "$svc" || ISSUES=$((ISSUES+1))
done

# Check tunnel
if ! pgrep -f "cloudflared tunnel run" > /dev/null; then
  echo "$TIMESTAMP [CRIT] Cloudflare tunnel is DOWN — restarting..." >> "$LOG"
  launchctl kickstart -k gui/$(id -u)/com.son.cloudflared >> "$LOG" 2>&1
  ISSUES=$((ISSUES+1))
fi

# Check HTTP endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://chat.sonchat.uk/health 2>/dev/null)
if [ "$HTTP_STATUS" != "200" ]; then
  echo "$TIMESTAMP [WARN] chat.sonchat.uk/health returned $HTTP_STATUS" >> "$LOG"
  ISSUES=$((ISSUES+1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "$TIMESTAMP [OK] All systems healthy" >> "$LOG"
fi
