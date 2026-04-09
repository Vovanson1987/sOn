#!/usr/bin/env bash
# ============================================================
# Резервное копирование PostgreSQL + MinIO для sOn Messenger
#
# Использование:
#   ./scripts/backup.sh              # полный бэкап (pg + minio)
#   ./scripts/backup.sh --pg-only    # только PostgreSQL
#
# Offsite upload:
#   Если rclone настроен и BACKUP_REMOTE задан (например s3:son-backups),
#   бэкап автоматически копируется в облако. Иначе — только локально.
#
# Cron (VPS):
#   17 3 * * * /srv/son/scripts/backup.sh >> /srv/son/backups/cron.log 2>&1
# ============================================================

set -euo pipefail

# ==================== Настройки ====================

CONTAINER_PG="son-postgres"
CONTAINER_MINIO="son-minio"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
LOG_FILE="${BACKUP_DIR}/backup.log"

# Ротация
KEEP_DAYS=14          # ежедневные бэкапы хранятся 14 дней
KEEP_WEEKLY_DAYS=56   # воскресные хранятся 8 недель

# Offsite (опционально)
BACKUP_REMOTE="${BACKUP_REMOTE:-}"   # rclone remote, например s3:son-backups

# Чтение .env если есть
if [ -f "${PROJECT_DIR}/.env" ]; then
  set -a; source "${PROJECT_DIR}/.env"; set +a
fi

DB_USER="${POSTGRES_USER:-son}"
DB_NAME="${POSTGRES_DB:-son_prod}"

PG_ONLY=false
[ "${1:-}" = "--pg-only" ] && PG_ONLY=true

mkdir -p "${BACKUP_DIR}"

log() {
  echo "[$(date -Is)] $1" >> "${LOG_FILE}"
  echo "$1"
}

# ==================== PostgreSQL ====================

pg_backup() {
  local file="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_PG}$"; then
    log "ERROR: ${CONTAINER_PG} не запущен"
    return 1
  fi

  if docker exec "${CONTAINER_PG}" pg_dump -U "${DB_USER}" --no-owner --no-acl "${DB_NAME}" 2>>"${LOG_FILE}" | gzip > "${file}"; then
    local size
    size=$(du -h "${file}" | cut -f1)
    log "OK pg_dump → ${file} (${size})"
  else
    rm -f "${file}"
    log "ERROR pg_dump failed"
    return 2
  fi
}

# ==================== MinIO (volume tar) ====================

minio_backup() {
  local file="${BACKUP_DIR}/minio_${TIMESTAMP}.tar.gz"

  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_MINIO}$"; then
    log "WARN: ${CONTAINER_MINIO} не запущен, пропускаю MinIO backup"
    return 0
  fi

  # Используем docker run с volume mount для tar
  if docker run --rm \
    -v son_minio_data:/data:ro \
    -v "${BACKUP_DIR}:/backup" \
    alpine tar czf "/backup/minio_${TIMESTAMP}.tar.gz" -C /data . 2>>"${LOG_FILE}"; then
    local size
    size=$(du -h "${file}" | cut -f1)
    log "OK minio tar → ${file} (${size})"
  else
    rm -f "${file}"
    log "WARN minio backup failed (non-critical)"
  fi
}

# ==================== Offsite upload ====================

offsite_upload() {
  if [ -z "${BACKUP_REMOTE}" ]; then
    return 0
  fi

  if ! command -v rclone &>/dev/null; then
    log "WARN: rclone не установлен, offsite upload пропущен"
    return 0
  fi

  local today_files
  today_files=$(find "${BACKUP_DIR}" -maxdepth 1 -name "*${TIMESTAMP}*" -type f)

  if [ -z "${today_files}" ]; then
    return 0
  fi

  log "Offsite upload → ${BACKUP_REMOTE}"
  for f in ${today_files}; do
    if rclone copy "${f}" "${BACKUP_REMOTE}/" --log-level NOTICE 2>>"${LOG_FILE}"; then
      log "OK offsite: $(basename "${f}")"
    else
      log "WARN offsite failed: $(basename "${f}")"
    fi
  done
}

# ==================== Ротация ====================

rotate() {
  # Ежедневные > KEEP_DAYS дней (кроме воскресных)
  find "${BACKUP_DIR}" -maxdepth 1 \( -name "*.sql.gz" -o -name "minio_*.tar.gz" \) \
    -type f -mtime +${KEEP_DAYS} \
    ! -name "*-Sun_*" \
    -delete 2>>"${LOG_FILE}" || true

  # Воскресные > KEEP_WEEKLY_DAYS
  find "${BACKUP_DIR}" -maxdepth 1 \( -name "*.sql.gz" -o -name "minio_*.tar.gz" \) \
    -type f -mtime +${KEEP_WEEKLY_DAYS} \
    -delete 2>>"${LOG_FILE}" || true

  local count
  count=$(find "${BACKUP_DIR}" -maxdepth 1 \( -name "*.sql.gz" -o -name "*.tar.gz" \) | wc -l | tr -d ' ')
  log "Ротация: осталось ${count} файлов"
}

# ==================== Main ====================

log "BEGIN backup (pg_only=${PG_ONLY})"

pg_backup

if [ "${PG_ONLY}" = false ]; then
  minio_backup
fi

offsite_upload
rotate

log "END backup"
