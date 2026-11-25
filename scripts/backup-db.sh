#!/usr/bin/env bash
# Brand AI database backup: consistent online dump (InnoDB, no table locks),
# gzip-compressed, checksummed, with local retention and an optional copy to
# S3-compatible storage. Schedule it daily (cron, systemd timer, or the
# `backup` service in docker-compose.yml).
#
#   DATABASE_URL=mysql://user:pass@host:3306/brandai BACKUP_DIR=/var/backups/brandai ./scripts/backup-db.sh
#
# Optional: BACKUP_RETENTION_DAYS (default 14), BACKUP_S3_URI (e.g. s3://bucket/brandai/) plus the
# usual AWS_* variables and BACKUP_S3_ENDPOINT for R2/B2/MinIO.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"

# Parse mysql://user:pass@host:port/db?params
proto_removed="${DATABASE_URL#*://}"
creds="${proto_removed%%@*}"
hostpart="${proto_removed#*@}"
DB_USER="${creds%%:*}"
urldecode() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }
DB_PASS="$(urldecode "${creds#*:}")"
hostport="${hostpart%%/*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport##*:}"; [ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=3306
DB_NAME="${hostpart#*/}"; DB_NAME="${DB_NAME%%\?*}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/brandai-${DB_NAME}-${stamp}.sql.gz"
cnf="$(mktemp)"; trap 'rm -f "$cnf"' EXIT
chmod 600 "$cnf"
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$cnf"

# --single-transaction: consistent snapshot without blocking the app.
mysqldump --defaults-extra-file="$cnf" --single-transaction --quick --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces "$DB_NAME" | gzip -9 > "$file.partial"
mv "$file.partial" "$file"
sha256sum "$file" > "$file.sha256"
echo "Backup written: $file ($(du -h "$file" | cut -f1))"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} "$file" "$BACKUP_S3_URI"
  aws s3 cp ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} "$file.sha256" "$BACKUP_S3_URI"
  echo "Copied to $BACKUP_S3_URI"
fi

find "$BACKUP_DIR" -name 'brandai-*.sql.gz*' -mtime +"$RETENTION" -print -delete | sed 's/^/Removed old backup: /'
