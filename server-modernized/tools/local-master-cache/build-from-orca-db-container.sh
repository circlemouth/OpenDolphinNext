#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE' >&2
Usage:
  build-from-orca-db-container.sh --output <artifact.zip> --master-version <version> [--work-dir <dir>] [--supplemental-dir <dir>]

Environment:
  ORCA_DB_CONTAINER_NAME  Optional Docker container name. When set without ORCA_DB_HOST, psql runs inside the container.
  ORCA_DB_HOST            Optional PostgreSQL host for direct psql access.
  ORCA_DB_PORT            PostgreSQL port. Default: 5432.
  ORCA_DB_NAME            PostgreSQL database. Default: orca.
  ORCA_DB_USER            Required read-only user.
  ORCA_DB_PASSWORD        Required read-only password.

Notes:
  This is a facility-side ETL tool. Do not run it in the OpenDolphin server runtime.
  Supplemental canonical CSV files are required for order-inputsets, order-interactions, and disease-candidate.
USAGE
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUTPUT=""
WORK_DIR=""
SUPPLEMENTAL_DIR=""
MASTER_VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    --work-dir)
      WORK_DIR="${2:-}"
      shift 2
      ;;
    --supplemental-dir)
      SUPPLEMENTAL_DIR="${2:-}"
      shift 2
      ;;
    --master-version)
      MASTER_VERSION="${2:-}"
      shift 2
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

if [[ -z "$OUTPUT" || -z "$MASTER_VERSION" ]]; then
  usage
  exit 2
fi

ORCA_DB_CONTAINER_NAME="${ORCA_DB_CONTAINER_NAME:-}"
ORCA_DB_HOST="${ORCA_DB_HOST:-}"
ORCA_DB_PORT="${ORCA_DB_PORT:-5432}"
ORCA_DB_NAME="${ORCA_DB_NAME:-orca}"
ORCA_DB_USER="${ORCA_DB_USER:-}"
ORCA_DB_PASSWORD="${ORCA_DB_PASSWORD:-}"

if [[ -z "$ORCA_DB_USER" || -z "$ORCA_DB_PASSWORD" ]]; then
  printf 'ORCA_DB_USER and ORCA_DB_PASSWORD must be supplied from local secrets.\n' >&2
  exit 2
fi

if [[ -z "$ORCA_DB_CONTAINER_NAME" && -z "$ORCA_DB_HOST" ]]; then
  printf 'Set ORCA_DB_CONTAINER_NAME or ORCA_DB_HOST.\n' >&2
  exit 2
fi

if [[ -z "$WORK_DIR" ]]; then
  WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/opendolphin-orca-db-master.XXXXXX")"
else
  mkdir -p "$WORK_DIR"
fi

SOURCE_DIR="$WORK_DIR/source"
MASTERS_DIR="$SOURCE_DIR/masters"
mkdir -p "$MASTERS_DIR" "$(dirname "$OUTPUT")"

sql_literal() {
  local value="${1:-}"
  value="${value//\'/\'\'}"
  printf "'%s'" "$value"
}

MV_LITERAL="$(sql_literal "$MASTER_VERSION")"
NOTE_LITERAL="$(sql_literal "orca db container extract")"

run_copy() {
  local target="$1"
  local query="$2"
  local copy_sql="COPY (${query}) TO STDOUT WITH CSV HEADER"
  if [[ -n "$ORCA_DB_CONTAINER_NAME" && -z "$ORCA_DB_HOST" ]]; then
    docker exec -i -e PGPASSWORD="$ORCA_DB_PASSWORD" "$ORCA_DB_CONTAINER_NAME" \
      psql -X -q -v ON_ERROR_STOP=1 -U "$ORCA_DB_USER" -d "$ORCA_DB_NAME" \
      -c "$copy_sql" > "$target"
  else
    PGPASSWORD="$ORCA_DB_PASSWORD" psql -X -q -v ON_ERROR_STOP=1 \
      -h "$ORCA_DB_HOST" -p "$ORCA_DB_PORT" -U "$ORCA_DB_USER" -d "$ORCA_DB_NAME" \
      -c "$copy_sql" > "$target"
  fi
  local rows
  rows="$(($(wc -l < "$target") - 1))"
  if [[ "$rows" -le 0 ]]; then
    printf 'extracted master CSV has no rows: %s\n' "$target" >&2
    exit 1
  fi
}

empty_cols="'' AS \"setCode\", '' AS entity, '' AS kind, '' AS \"classCode\", '' AS \"className\", '' AS \"itemCount\", '' AS seq, '' AS quantity, '' AS memo, '' AS \"rowRole\", '' AS \"rowSubtype\", '' AS code2, '' AS \"interactionCode\", '' AS \"interactionName\", '' AS message"

run_copy "$MASTERS_DIR/drug.csv" "
SELECT 'entry' AS \"recordType\", 'drug' AS \"masterType\", srycd::text AS code, name::text AS name,
       kananame::text AS kana, srysyukbn::text AS category, taniname::text AS unit, ten::text AS price,
       COALESCE(NULLIF(yukostymd::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(yukoedymd::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', srycd::text, name::text, kananame::text) AS \"searchText\",
       '{}' AS \"payloadJson\", $empty_cols
FROM TBL_TENSU_MASTER
WHERE srycd::text LIKE '6%'"

run_copy "$MASTERS_DIR/etensu.csv" "
SELECT 'entry' AS \"recordType\", 'etensu' AS \"masterType\", srycd::text AS code, name::text AS name,
       kananame::text AS kana, srysyukbn::text AS category, taniname::text AS unit, ten::text AS price,
       COALESCE(NULLIF(yukostymd::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(yukoedymd::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', srycd::text, name::text, kananame::text, srysyukbn::text) AS \"searchText\",
       jsonb_build_object('noticeDate', COALESCE(NULLIF(upymd::text, ''), NULL))::text AS \"payloadJson\", $empty_cols
FROM TBL_TENSU_MASTER
WHERE srycd::text NOT LIKE '6%'
  AND srycd::text NOT LIKE '7%'
  AND srycd::text NOT LIKE '002%'
  AND srycd::text !~ '^(008[1-6]|8[1-6]|098|099|98|99)'"

run_copy "$MASTERS_DIR/comment.csv" "
SELECT 'entry' AS \"recordType\", 'comment' AS \"masterType\", srycd::text AS code, name::text AS name,
       kananame::text AS kana, 'comment' AS category, '' AS unit, '' AS price,
       COALESCE(NULLIF(yukostymd::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(yukoedymd::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', srycd::text, name::text, kananame::text) AS \"searchText\",
       '{}' AS \"payloadJson\", $empty_cols
FROM TBL_TENSU_MASTER
WHERE srycd::text ~ '^(008[1-6]|8[1-6]|098|099|98|99)'"

run_copy "$MASTERS_DIR/bodypart.csv" "
SELECT 'entry' AS \"recordType\", 'bodypart' AS \"masterType\", srycd::text AS code, name::text AS name,
       kananame::text AS kana, 'bodypart' AS category, '' AS unit, '' AS price,
       COALESCE(NULLIF(yukostymd::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(yukoedymd::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', srycd::text, name::text, kananame::text) AS \"searchText\",
       '{}' AS \"payloadJson\", $empty_cols
FROM TBL_TENSU_MASTER
WHERE srycd::text LIKE '002%'"

run_copy "$MASTERS_DIR/generic-price.csv" "
SELECT 'entry' AS \"recordType\", 'generic-price' AS \"masterType\", srycd::text AS code,
       COALESCE(name::text, srycd::text) AS name, '' AS kana, '' AS category, unit::text AS unit, price::text AS price,
       COALESCE(NULLIF(start_date::text, ''), NULLIF(yukostymd::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(end_date::text, ''), NULLIF(yukoedymd::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', srycd::text, name::text) AS \"searchText\",
       '{}' AS \"payloadJson\", $empty_cols
FROM TBL_GENERIC_PRICE"

run_copy "$MASTERS_DIR/generic-class.csv" "
SELECT 'entry' AS \"recordType\", 'generic-class' AS \"masterType\", class_code::text AS code, class_name::text AS name,
       kana_name::text AS kana, category_code::text AS category, '' AS unit, '' AS price,
       COALESCE(NULLIF(start_date::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(end_date::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', class_code::text, class_name::text, kana_name::text) AS \"searchText\",
       jsonb_build_object('parentClassCode', parent_class_code::text)::text AS \"payloadJson\", $empty_cols
FROM TBL_GENERIC_CLASS"

run_copy "$MASTERS_DIR/youhou.csv" "
SELECT 'entry' AS \"recordType\", 'youhou' AS \"masterType\", youhoucode::text AS code, youhouname::text AS name,
       kana::text AS kana, 'usage' AS category, '' AS unit, '' AS price,
       COALESCE(NULLIF(start_date::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(end_date::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', youhoucode::text, youhouname::text, kana::text) AS \"searchText\",
       '{}' AS \"payloadJson\", $empty_cols
FROM TBL_YOUHOU"

run_copy "$MASTERS_DIR/material.csv" "
SELECT 'entry' AS \"recordType\", 'material' AS \"masterType\", material_code::text AS code, material_name::text AS name,
       kana_name::text AS kana, material_category::text AS category, unit::text AS unit, price::text AS price,
       COALESCE(NULLIF(start_date::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(end_date::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', material_code::text, material_name::text, kana_name::text) AS \"searchText\",
       jsonb_build_object('maker', maker::text)::text AS \"payloadJson\", $empty_cols
FROM TBL_MATERIAL_H_M"

run_copy "$MASTERS_DIR/kensa-sort.csv" "
SELECT 'entry' AS \"recordType\", 'kensa-sort' AS \"masterType\", kensa_code::text AS code, kensa_name::text AS name,
       kana_name::text AS kana, classification::text AS category, '' AS unit, '' AS price,
       COALESCE(NULLIF(start_date::text, ''), '00000000') AS \"validFrom\",
       COALESCE(NULLIF(end_date::text, ''), '99991231') AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', kensa_code::text, kensa_name::text, kana_name::text, kensa_sort::text) AS \"searchText\",
       jsonb_build_object('kensaSort', kensa_sort::text)::text AS \"payloadJson\", $empty_cols
FROM TBL_KENSASORT"

run_copy "$MASTERS_DIR/hokenja.csv" "
SELECT 'entry' AS \"recordType\", 'hokenja' AS \"masterType\", hknjanum::text AS code, hknjaname::text AS name,
       hknjaname_tan1::text AS kana, hknnum::text AS category, '' AS unit, '' AS price,
       COALESCE(NULLIF(creymd::text, ''), '00000000') AS \"validFrom\", '99991231' AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', hknjanum::text, hknjaname::text, hknjaname_tan1::text, post::text, adrs::text) AS \"searchText\",
       jsonb_build_object('zip', post::text, 'addressLine', concat_ws('', adrs::text, banti::text), 'phone', tel::text, 'payerRatio', hon_gaikyurate::text)::text AS \"payloadJson\", $empty_cols
FROM TBL_HKNJAINF_MASTER"

run_copy "$MASTERS_DIR/address.csv" "
SELECT 'entry' AS \"recordType\", 'address' AS \"masterType\", post::text AS code,
       concat_ws('', editadrs_name::text, cityname::text, townname::text) AS name,
       editadrs_kana::text AS kana, pref_code::text AS category, '' AS unit, '' AS price,
       '00000000' AS \"validFrom\", '99991231' AS \"validTo\",
       $MV_LITERAL AS \"masterVersion\", $NOTE_LITERAL AS note,
       concat_ws(' ', post::text, editadrs_name::text, cityname::text, townname::text, editadrs_kana::text) AS \"searchText\",
       jsonb_build_object('zip', post::text, 'prefCode', pref_code::text, 'cityCode', city_code::text, 'city', cityname::text, 'town', townname::text, 'addressLine', editadrs_name::text, 'kanaAddress', editadrs_kana::text, 'roman', roman::text)::text AS \"payloadJson\", $empty_cols
FROM TBL_ADRS"

copy_supplemental() {
  local name="$1"
  if [[ -z "$SUPPLEMENTAL_DIR" ]]; then
    printf 'supplemental-dir is required for %s\n' "$name" >&2
    exit 1
  fi
  local source=""
  if [[ -f "$SUPPLEMENTAL_DIR/masters/$name.csv" ]]; then
    source="$SUPPLEMENTAL_DIR/masters/$name.csv"
  elif [[ -f "$SUPPLEMENTAL_DIR/$name.csv" ]]; then
    source="$SUPPLEMENTAL_DIR/$name.csv"
  fi
  if [[ -z "$source" ]]; then
    printf 'missing supplemental canonical CSV: %s.csv\n' "$name" >&2
    exit 1
  fi
  cp "$source" "$MASTERS_DIR/$name.csv"
}

copy_supplemental "order-inputsets"
copy_supplemental "order-interactions"
copy_supplemental "disease-candidate"

SOURCE_ID_HOST="${ORCA_DB_CONTAINER_NAME:-$ORCA_DB_HOST}"
SOURCE_ID_HOST="${SOURCE_ID_HOST//[^A-Za-z0-9_.-]/_}"
SOURCE_ID="orca-db-container:${SOURCE_ID_HOST}"

(
  cd "$ROOT_DIR"
  mvn -f pom.server-modernized.xml -pl server-modernized -DskipTests compile \
    org.codehaus.mojo:exec-maven-plugin:3.5.0:java \
    -Dexec.mainClass=open.orca.master.LocalOrcaMasterCacheArtifactBuilder \
    -Dexec.args="--source-dir $SOURCE_DIR --output $OUTPUT --source-kind orca-db-container-artifact --source-id $SOURCE_ID --master-version $MASTER_VERSION"
)

printf 'canonical artifact written: %s\n' "$OUTPUT"
