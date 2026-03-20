#!/usr/bin/env bash
# ============================================================
# Резервное копирование PostgreSQL для sOn Messenger
# Использование: ./scripts/backup.sh
# Автоматическое удаление бэкапов старше 7 дней
# ============================================================

set -euo pipefail

# Настройки
CONTAINER="son-postgres"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
KEEP_DAYS=7

# Переменные из .env или значения по умолчанию
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-son_dev}"

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "📦 Резервное копирование базы данных ${DB_NAME}..."

# Проверяем, что контейнер запущен
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}❌ Контейнер ${CONTAINER} не запущен${NC}"
  exit 1
fi

# Создаём директорию для бэкапов
mkdir -p "${BACKUP_DIR}"

# Имя файла бэкапа
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Выполняем pg_dump внутри контейнера и сжимаем
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Проверяем результат
if [ -s "${BACKUP_FILE}" ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo -e "${GREEN}✅ Бэкап создан: ${BACKUP_FILE} (${SIZE})${NC}"
else
  echo -e "${RED}❌ Ошибка: файл бэкапа пуст${NC}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Удаляем старые бэкапы
DELETED=$(find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +${KEEP_DAYS} -print -delete | wc -l)
if [ "${DELETED}" -gt 0 ]; then
  echo "🗑️  Удалено старых бэкапов: ${DELETED}"
fi

echo "📋 Всего бэкапов: $(find "${BACKUP_DIR}" -name "*.sql.gz" | wc -l | tr -d ' ')"
