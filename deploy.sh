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

echo ""
echo "🎉 Деплой завершён!"
echo "📱 Откройте http://$(echo $HOST | cut -d@ -f2) в браузере"
