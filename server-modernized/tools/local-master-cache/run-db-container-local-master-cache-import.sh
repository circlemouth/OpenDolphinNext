#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE' >&2
Usage:
  run-db-container-local-master-cache-import.sh [options]

Options:
  --output-dir <dir>           RUN_ID output directory. Default: artifacts/local-master-cache/<RUN_ID>
  --master-version <version>   Artifact masterVersion. Default: orca-db-container-YYYYMMDD
  --supplemental-dir <dir>     Supplemental canonical CSV directory. Default: generated from fixture.
  --skip-orca-start            Do not start the submodule ORCA compose stack.
  --run-orca-master-update     Run the ORCA container standard master update before extraction.
  --import-local-dev           Import generated artifact into local OpenDolphin dev Postgres.
  -h, --help                   Show this help.

Environment:
  ORCA_DB_CONTAINER_NAME       Default: jma-receipt-docker-db-1
  ORCA_DB_NAME                 Default: orca
  ORCA_DB_USER                 Default: orca
  ORCA_DB_PASSWORD             Required. Supply from a local secret.
  OPENDOLPHIN_DB_CONTAINER     Default: opendolphin-postgres-modernized
  OPENDOLPHIN_DB_NAME          Default: opendolphin_modern
  OPENDOLPHIN_DB_USER          Default: opendolphin

Notes:
  This is a local/facility-side tool. Do not run it inside the OpenDolphin server runtime.
  Production OpenDolphin must import the generated ZIP via admin upload or scheduler, not by ORCA DB connection.
USAGE
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
MASTER_VERSION="orca-db-container-$(date -u +%Y%m%d)"
OUTPUT_DIR=""
SUPPLEMENTAL_DIR=""
SKIP_ORCA_START=0
RUN_ORCA_MASTER_UPDATE=0
IMPORT_LOCAL_DEV=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --master-version)
      MASTER_VERSION="${2:-}"
      shift 2
      ;;
    --supplemental-dir)
      SUPPLEMENTAL_DIR="${2:-}"
      shift 2
      ;;
    --skip-orca-start)
      SKIP_ORCA_START=1
      shift
      ;;
    --run-orca-master-update)
      RUN_ORCA_MASTER_UPDATE=1
      shift
      ;;
    --import-local-dev)
      IMPORT_LOCAL_DEV=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$ROOT_DIR/artifacts/local-master-cache/$RUN_ID"
elif [[ "$OUTPUT_DIR" != /* ]]; then
  OUTPUT_DIR="$ROOT_DIR/$OUTPUT_DIR"
fi

ORCA_COMPOSE_DIR="$ROOT_DIR/docker/orca/jma-receipt-docker"
ORCA_DB_CONTAINER_NAME="${ORCA_DB_CONTAINER_NAME:-jma-receipt-docker-db-1}"
ORCA_DB_NAME="${ORCA_DB_NAME:-orca}"
ORCA_DB_USER="${ORCA_DB_USER:-orca}"
ORCA_DB_PASSWORD="${ORCA_DB_PASSWORD:-}"
OPENDOLPHIN_DB_CONTAINER="${OPENDOLPHIN_DB_CONTAINER:-opendolphin-postgres-modernized}"
OPENDOLPHIN_DB_NAME="${OPENDOLPHIN_DB_NAME:-opendolphin_modern}"
OPENDOLPHIN_DB_USER="${OPENDOLPHIN_DB_USER:-opendolphin}"

if [[ -z "$ORCA_DB_PASSWORD" ]]; then
  printf 'ORCA_DB_PASSWORD must be supplied from a local secret.\n' >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"
ARTIFACT="$OUTPUT_DIR/opendolphin-local-orca-master-cache-db-container.zip"
WORK_DIR="$OUTPUT_DIR/work"
LOCAL_SUPPLEMENTAL_DIR="$OUTPUT_DIR/supplemental"

log() {
  printf '[local-master-cache] %s\n' "$*"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'required command not found: %s\n' "$command_name" >&2
    exit 2
  fi
}

wait_for_orca_db() {
  for _ in $(seq 1 120); do
    if docker exec "$ORCA_DB_CONTAINER_NAME" pg_isready -U "$ORCA_DB_USER" -d "$ORCA_DB_NAME" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  printf 'ORCA DB container did not become ready: %s\n' "$ORCA_DB_CONTAINER_NAME" >&2
  exit 1
}

generate_supplemental_from_fixture() {
  local fixture="$ROOT_DIR/server-modernized/src/main/resources/open/orca/master/local-orca-master-cache-fixture.csv"
  local masters_dir="$LOCAL_SUPPLEMENTAL_DIR/masters"
  if [[ ! -f "$fixture" ]]; then
    printf 'fixture for supplemental canonical CSV not found: %s\n' "$fixture" >&2
    exit 1
  fi
  mkdir -p "$masters_dir"
  awk -F, 'NR == 1 || $2 == "order-inputsets"' "$fixture" > "$masters_dir/order-inputsets.csv"
  awk -F, 'NR == 1 || $2 == "order-interactions"' "$fixture" > "$masters_dir/order-interactions.csv"
  awk -F, 'NR == 1 || $2 == "disease-candidate"' "$fixture" > "$masters_dir/disease-candidate.csv"
  SUPPLEMENTAL_DIR="$LOCAL_SUPPLEMENTAL_DIR"
}

start_orca_stack() {
  if [[ "$SKIP_ORCA_START" -eq 1 ]]; then
    log "Skipping ORCA compose startup."
    return 0
  fi
  log "Starting submodule ORCA compose stack."
  (cd "$ORCA_COMPOSE_DIR" && docker compose up -d --build)
  wait_for_orca_db
}

run_orca_master_update() {
  if [[ "$RUN_ORCA_MASTER_UPDATE" -ne 1 ]]; then
    return 0
  fi
  log "Running ORCA standard master update in the ORCA container."
  set +e
  docker exec -u orca jma-receipt-docker-orca-1 \
    bash -lc '/opt/jma/weborca/app/scripts/tools/run_master_upgrade.sh' \
    > "$OUTPUT_DIR/orca-master-update.sanitized.log" 2>&1
  local status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    if rg -q 'マスタ更新処理が終了しました|全ての処理が完了しました' "$OUTPUT_DIR/orca-master-update.sanitized.log"; then
      log "ORCA standard master update completed, but post-update step exited with status $status. See sanitized log."
    else
      printf 'ORCA master update failed. See sanitized log: %s\n' "$OUTPUT_DIR/orca-master-update.sanitized.log" >&2
      exit "$status"
    fi
  fi
}

build_artifact() {
  if [[ -z "$SUPPLEMENTAL_DIR" ]]; then
    generate_supplemental_from_fixture
  elif [[ "$SUPPLEMENTAL_DIR" != /* ]]; then
    SUPPLEMENTAL_DIR="$ROOT_DIR/$SUPPLEMENTAL_DIR"
  fi
  log "Building canonical artifact from ORCA DB container."
  ORCA_DB_CONTAINER_NAME="$ORCA_DB_CONTAINER_NAME" \
  ORCA_DB_NAME="$ORCA_DB_NAME" \
  ORCA_DB_USER="$ORCA_DB_USER" \
  ORCA_DB_PASSWORD="$ORCA_DB_PASSWORD" \
    "$ROOT_DIR/server-modernized/tools/local-master-cache/build-from-orca-db-container.sh" \
      --output "$ARTIFACT" \
      --work-dir "$WORK_DIR" \
      --supplemental-dir "$SUPPLEMENTAL_DIR" \
      --master-version "$MASTER_VERSION"
  shasum -a 256 "$ARTIFACT" > "$ARTIFACT.sha256"
  unzip -p "$ARTIFACT" manifest.json > "$OUTPUT_DIR/manifest.sanitized.json"
}

import_local_dev() {
  if [[ "$IMPORT_LOCAL_DEV" -ne 1 ]]; then
    return 0
  fi
  require_command unzip
  local temp_dir
  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/opendolphin-local-master-cache-import.XXXXXX")"
  local csv_path="$temp_dir/local-orca-master-cache.csv"
  local sql_path="$ROOT_DIR/server-modernized/tools/local-master-cache/import-canonical-artifact-to-local-dev-db.sql"
  local db_csv_path="/tmp/opendolphin-local-orca-master-cache-${RUN_ID}.csv"
  local artifact_hash
  local version_id
  artifact_hash="$(shasum -a 256 "$ARTIFACT" | awk '{print $1}')"
  version_id="${MASTER_VERSION}-${artifact_hash:0:12}"

  log "Importing canonical artifact into local OpenDolphin dev DB."
  unzip -p "$ARTIFACT" local-orca-master-cache.csv > "$csv_path"
  docker cp "$csv_path" "$OPENDOLPHIN_DB_CONTAINER:$db_csv_path"
  docker exec -i "$OPENDOLPHIN_DB_CONTAINER" psql -U "$OPENDOLPHIN_DB_USER" -d "$OPENDOLPHIN_DB_NAME" -v ON_ERROR_STOP=1 \
    < "$ROOT_DIR/server-modernized/tools/flyway/sql/V0336__local_orca_master_cache.sql"
  docker cp "$sql_path" "$OPENDOLPHIN_DB_CONTAINER:/tmp/import-canonical-artifact-to-local-dev-db.sql"
  docker exec -i "$OPENDOLPHIN_DB_CONTAINER" psql -U "$OPENDOLPHIN_DB_USER" -d "$OPENDOLPHIN_DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -v "csv_path=$db_csv_path" \
    -v "source_file=$(basename "$ARTIFACT")" \
    -v "artifact_path=${ARTIFACT#$ROOT_DIR/}" \
    -v "artifact_sha256=$artifact_hash" \
    -v "master_version=$MASTER_VERSION" \
    -v "version_id=$version_id" \
    -v "run_id=$RUN_ID" \
    -f /tmp/import-canonical-artifact-to-local-dev-db.sql
  docker exec "$OPENDOLPHIN_DB_CONTAINER" rm -f "$db_csv_path" /tmp/import-canonical-artifact-to-local-dev-db.sql >/dev/null
  rm -rf "$temp_dir" "$WORK_DIR"
}

summarize() {
  log "RUN_ID=$RUN_ID"
  log "artifact=${ARTIFACT#$ROOT_DIR/}"
  log "sha256=$(awk '{print $1}' "$ARTIFACT.sha256")"
  if [[ "$IMPORT_LOCAL_DEV" -eq 1 ]]; then
    docker exec -i "$OPENDOLPHIN_DB_CONTAINER" psql -U "$OPENDOLPHIN_DB_USER" -d "$OPENDOLPHIN_DB_NAME" -P pager=off -c \
      "SELECT master_type, cache_status, source_kind, master_version FROM opendolphin.local_orca_master_dataset ORDER BY master_type;"
  fi
}

require_command docker
require_command shasum
require_command rg
start_orca_stack
run_orca_master_update
build_artifact
import_local_dev
summarize
