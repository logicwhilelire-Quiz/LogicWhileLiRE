#!/usr/bin/env bash
# ============================================================
# LogicWhile QUIZ — Automated Supabase/Postgres Database Backup
# ============================================================
#
# Prerequisites:
#   - pg_dump installed (postgresql-client)
#   - SUPABASE_DB_URL or DATABASE_URL set in environment
#
# Usage:
#   chmod +x scripts/backup-db.sh
#   ./scripts/backup-db.sh
#
# Cron example (Daily at 02:00 AM UTC):
#   0 2 * * * /path/to/Quiz/server/scripts/backup-db.sh >> /var/log/quiz_backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/logic_while_quiz_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "============================================================"
echo "Starting database backup at $(date)"
echo "Target file: ${BACKUP_FILE}"
echo "============================================================"

if [ -z "${DATABASE_URL:-}" ] && [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ Error: Neither DATABASE_URL nor SUPABASE_DB_URL is set."
  echo "Please export your direct PostgreSQL connection string from Supabase Settings > Database."
  exit 1
fi

CONNECTION_STRING="${DATABASE_URL:-$SUPABASE_DB_URL}"

# Run pg_dump excluding transient logs if desired, compressed with gzip
pg_dump "${CONNECTION_STRING}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${BACKUP_FILE}"

echo "✅ Backup completed successfully: $(du -h "${BACKUP_FILE}" | cut -f1)"

# Prune old backups older than RETENTION_DAYS
echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "logic_while_quiz_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Done!"
