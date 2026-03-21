#!/bin/bash
## Скрипт деплоя sOn Messenger на VPS
## Использование: ./deploy.sh [user@host]
##
## Предварительные требования на VPS:
## 1. Docker + Docker Compose
## 2. Git
## 3. Открытые порты: 80, 443

set -e

HOST=${1:-"root@your-server.com"}
APP_DIR="/opt/son-messenger"
RUN_SMOKE=${RUN_SMOKE:-1}
BASE_URL=${SMOKE_BASE_URL:-"http://$(echo "$HOST" | cut -d@ -f2)"}

echo "🚀 Деплой sOn Messenger на $HOST"

# 1. Подключение и подготовка
ssh $HOST "mkdir -p $APP_DIR"

# 2. Копирование файлов
echo "📦 Копирование файлов..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' \
  --exclude='.vite' --exclude='.DS_Store' \
  ./ $HOST:$APP_DIR/

# 3. Создать .env если не существует
ssh $HOST "cd $APP_DIR && [ ! -f .env ] && cp .env.production .env && echo '⚠️  Отредактируйте .env на сервере!' || echo '.env уже существует'"

# 4. Сборка и запуск
echo "🔨 Сборка и запуск контейнеров..."
ssh $HOST "cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d --build"

# 5. Проверка
echo "✅ Проверка здоровья..."
sleep 5
ssh $HOST "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# 6. Smoke-check (по умолчанию включён)
if [ "$RUN_SMOKE" = "1" ]; then
  echo "🧪 Smoke-check: $BASE_URL"
  if ! command -v node >/dev/null 2>&1; then
    echo "❌ Для smoke-check нужен node (локально на машине запуска deploy.sh)"
    exit 1
  fi
  node ./scripts/smoke-web-server.mjs --base-url "$BASE_URL"
else
  echo "ℹ️ Smoke-check пропущен (RUN_SMOKE=0)"
fi

echo ""
echo "🎉 Деплой завершён!"
echo "📱 Откройте $BASE_URL в браузере"
