#!/usr/bin/env bash
# ============================================================
# Тест восстановления PostgreSQL бэкапа
#
# Поднимает временный postgres-контейнер, загружает последний
# бэкап, проверяет что таблицы и данные на месте, удаляет контейнер.
#
# Использование:
#   ./scripts/restore-test.sh                    # последний бэкап
#   ./scripts/restore-test.sh backups/file.sql.gz  # конкретный файл
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"

RESTORE_CONTAINER="son-restore-test"
RESTORE_PORT=5433
DB_USER="${POSTGRES_USER:-son}"
DB_NAME="${POSTGRES_DB:-son_prod}"

# Определить файл бэкапа
if [ -n "${1:-}" ]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
fi

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "Нет файла бэкапа: ${BACKUP_FILE:-'(не найден)'}"
  exit 1
fi

echo "Файл: ${BACKUP_FILE}"
echo "Размер: $(du -h "${BACKUP_FILE}" | cut -f1)"

# Очистка при выходе
cleanup() {
  echo "Удаляю временный контейнер..."
  docker rm -f "${RESTORE_CONTAINER}" 2>/dev/null || true
}
trap cleanup EXIT

# Поднять временный postgres
echo "Поднимаю временный PostgreSQL..."
docker run -d --name "${RESTORE_CONTAINER}" \
  -e POSTGRES_USER="${DB_USER}" \
  -e POSTGRES_PASSWORD=restore-test \
  -e POSTGRES_DB="${DB_NAME}" \
  -p "${RESTORE_PORT}:5432" \
  postgres:16-alpine >/dev/null

# Ждём готовности
echo -n "Жду готовности"
for i in $(seq 1 30); do
  if docker exec "${RESTORE_CONTAINER}" pg_isready -U "${DB_USER}" >/dev/null 2>&1; then
    echo " готов"
    break
  fi
  echo -n "."
  sleep 1
done

# Загрузить бэкап
echo "Восстанавливаю бэкап..."
if zcat "${BACKUP_FILE}" | docker exec -i "${RESTORE_CONTAINER}" psql -U "${DB_USER}" "${DB_NAME}" >/dev/null 2>&1; then
  echo "Бэкап загружен"
else
  echo "ОШИБКА загрузки бэкапа"
  exit 2
fi

# Проверки
echo ""
echo "=== Проверка таблиц ==="
TABLES=$(docker exec "${RESTORE_CONTAINER}" psql -U "${DB_USER}" "${DB_NAME}" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
TABLES=$(echo "${TABLES}" | tr -d ' ')
echo "Таблиц в public: ${TABLES}"

if [ "${TABLES}" -lt 10 ]; then
  echo "ОШИБКА: ожидалось >= 10 таблиц, найдено ${TABLES}"
  exit 3
fi

echo ""
echo "=== Количество записей ==="
for table in users chats messages contacts; do
  COUNT=$(docker exec "${RESTORE_CONTAINER}" psql -U "${DB_USER}" "${DB_NAME}" -t -c \
    "SELECT count(*) FROM ${table}" 2>/dev/null | tr -d ' ')
  echo "  ${table}: ${COUNT:-'ошибка'}"
done

echo ""
echo "=== Проверка индексов ==="
IDX_COUNT=$(docker exec "${RESTORE_CONTAINER}" psql -U "${DB_USER}" "${DB_NAME}" -t -c \
  "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'" | tr -d ' ')
echo "Индексов: ${IDX_COUNT}"

echo ""
echo "Восстановление УСПЕШНО. ${TABLES} таблиц, ${IDX_COUNT} индексов."
