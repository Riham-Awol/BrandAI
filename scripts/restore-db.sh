#!/usr/bin/env bash
# Restores a backup made by backup-db.sh into the database in DATABASE_URL.
# Refuses to overwrite a database that already has tables unless --force is given.
#
#   DATABASE_URL=mysql://user:pass@host:3306/brandai_restore ./scripts/restore-db.sh backups/brandai-....sql.gz
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
file="${1:?Usage: restore-db.sh <backup.sql.gz> [--force]}"
force="${2:-}"

if [ -f "$file.sha256" ]; then sha256sum -c "$file.sha256" >/dev/null && echo "Checksum OK"; fi

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
cnf="$(mktemp)"; trap 'rm -f "$cnf"' EXIT
chmod 600 "$cnf"
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$cnf"

mysql --defaults-extra-file="$cnf" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
tables="$(mysql --defaults-extra-file="$cnf" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'")"
if [ "$tables" != "0" ] && [ "$force" != "--force" ]; then
  echo "Database $DB_NAME already has $tables tables. Restore into an empty database, or pass --force." >&2
  exit 1
fi
gunzip -c "$file" | mysql --defaults-extra-file="$cnf" "$DB_NAME"
echo "Restored $file into $DB_NAME. Run 'npx prisma migrate status' to confirm the schema."
