#!/bin/bash
# Быстрый запуск smoke-check для staging/prod URL
# Использование: ./scripts/staging-smoke.sh https://staging.example.com

set -euo pipefail

BASE_URL="${1:-${SMOKE_BASE_URL:-}}"
if [ -z "$BASE_URL" ]; then
  echo "Ошибка: укажите URL первым аргументом или задайте SMOKE_BASE_URL"
  exit 1
fi

node "$(dirname "$0")/smoke-web-server.mjs" --base-url "$BASE_URL"
