#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DB_HOST:-}" || -z "${DB_NAME:-}" || -z "${DB_USER:-}" || -z "${DB_PASSWORD:-}" ]]; then
  echo "DB_HOST, DB_NAME, DB_USER, DB_PASSWORD を設定してください" >&2
  exit 1
fi

OUTPUT_DIR=${OUTPUT_DIR:-$(pwd)/artifacts}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "${OUTPUT_DIR}"

PGPASSWORD="${DB_PASSWORD}" pg_dump \
  --schema-only \
  --no-owner \
  --file "${OUTPUT_DIR}/opendolphin-${TIMESTAMP}.sql" \
  --host "${DB_HOST}" \
  --port "${DB_PORT:-5432}" \
  --username "${DB_USER}" \
  --dbname "${DB_NAME}"

echo "Schema dump saved to ${OUTPUT_DIR}/opendolphin-${TIMESTAMP}.sql"
