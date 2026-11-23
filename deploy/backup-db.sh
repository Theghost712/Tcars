#!/usr/bin/env bash
# Nightly PostgreSQL backup with 14-day retention.
#   DATABASE_URL=postgres://user:pass@host:5432/db BACKUP_DIR=/var/backups/tcm ./deploy/backup-db.sh
# Suggested cron entry (02:30 daily):  30 2 * * * /opt/tcm/deploy/backup-db.sh >> /var/log/tcm-backup.log 2>&1
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tcm}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/tcm-$stamp.sql.gz"
pg_dump --no-owner --format=plain "$DATABASE_URL" | gzip -9 > "$file"
echo "Backup written: $file ($(du -h "$file" | cut -f1))"
find "$BACKUP_DIR" -name 'tcm-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
