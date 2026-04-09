#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/create-review-archive.sh [--run-id RUN_ID] [--out-dir PATH]

Options:
  --run-id   Bundle id in format YYYYMMDDTHHMMSSZ (default: current UTC timestamp)
  --out-dir  Directory to output the zip file (default: ./artifacts/review-bundles)
  -h, --help Show this message

Creates a comprehensive review zip for this repository using tracked source/config
files, excluding historical development documents and generated outputs, while
including review-relevant log files from curated directories.
USAGE
}

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="./artifacts/review-bundles"
REPO_NAME="$(basename "$ROOT_DIR")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$RUN_ID" ]]; then
  echo "RUN_ID is required"
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command not found"
  exit 1
fi

if ! command -v zipinfo >/dev/null 2>&1; then
  echo "zipinfo command not found"
  exit 1
fi

mkdir -p "$OUT_DIR"
OUT_DIR_ABS="$(cd "$OUT_DIR" && pwd)"
ZIP_FILE="${OUT_DIR_ABS}/${REPO_NAME}-review-${RUN_ID}.zip"

TRACKED_EXCLUDE_REGEX='(^|/)node_modules(/|$)|(^|/)dist(/|$)|(^|/)target(/|$)|(^|/)coverage(/|$)|(^|/)test-results(/|$)|(^|/)artifacts(/|$)|(^|/)tmp(/|$)|(^|/)\.playwright-cli(/|$)|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$|^docs/working-notes/|^docs/implementation/|^docs/managerdocs/|^docs/web-client/product-improvement/|^managerdocs_seed_bundle/'
FORBIDDEN_ENTRY_REGEX='(^|/)node_modules(/|$)|(^|/)dist(/|$)|(^|/)target(/|$)|(^|/)coverage(/|$)|(^|/)test-results(/|$)|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$|^docs/working-notes/|^docs/implementation/|^docs/managerdocs/|^docs/web-client/product-improvement/|^managerdocs_seed_bundle/'
LOG_ROOT_REGEX='^(artifacts/|tmp/|\.playwright-cli/)'
ALLOWED_LOG_ENTRY_REGEX='^(artifacts/|tmp/|\.playwright-cli/).*(\.log|.*log.*\.txt)$'

WORK_DIR="$(mktemp -d)"
STAGING_DIR="${WORK_DIR}/staging"
TRACKED_FILE_LIST="${WORK_DIR}/tracked-files.txt"
LOG_FILE_LIST="${WORK_DIR}/log-files.txt"
ZIP_ENTRY_LIST="${WORK_DIR}/zip-entries.txt"
mkdir -p "$STAGING_DIR"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

calculate_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

copy_path() {
  local rel_path="$1"
  local src_path="$ROOT_DIR/$rel_path"
  local dst_path="$STAGING_DIR/$rel_path"

  if [[ ! -f "$src_path" ]]; then
    return 0
  fi

  mkdir -p "$(dirname "$dst_path")"
  cp -Pp "$src_path" "$dst_path"
}

collect_tracked_files() {
  git ls-files | grep -Ev "$TRACKED_EXCLUDE_REGEX" > "$TRACKED_FILE_LIST" || true
}

collect_log_files() {
  : > "$LOG_FILE_LIST"

  for root in artifacts tmp .playwright-cli; do
    [[ -d "$root" ]] || continue
    while IFS= read -r file_path; do
      local_path="${file_path#./}"
      case "$local_path" in
        *.log|*log*.txt)
          printf '%s\n' "$local_path" >> "$LOG_FILE_LIST"
          ;;
      esac
    done < <(find "$root" -type f | LC_ALL=C sort)
  done

  sort -u "$LOG_FILE_LIST" -o "$LOG_FILE_LIST"
}

stage_files() {
  local tracked_count=0
  local log_count=0

  while IFS= read -r rel_path; do
    [[ -n "$rel_path" ]] || continue
    copy_path "$rel_path"
    tracked_count=$((tracked_count + 1))
  done < "$TRACKED_FILE_LIST"

  while IFS= read -r rel_path; do
    [[ -n "$rel_path" ]] || continue
    copy_path "$rel_path"
    log_count=$((log_count + 1))
  done < "$LOG_FILE_LIST"

  cat > "${STAGING_DIR}/REVIEW_BUNDLE_MANIFEST.txt" <<EOF
RUN_ID=${RUN_ID}
CREATED_AT_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPO_NAME=${REPO_NAME}
REPO_ROOT=${ROOT_DIR}
TRACKED_FILE_COUNT=${tracked_count}
LOG_FILE_COUNT=${log_count}

Tracked-file exclusions:
- node_modules, dist, target, coverage, test-results
- artifacts/, tmp/, .playwright-cli/ (logs are re-added separately)
- docs/working-notes/
- docs/implementation/
- docs/managerdocs/
- docs/web-client/product-improvement/
- managerdocs_seed_bundle/
- __MACOSX, .DS_Store, Thumbs.db

Log roots included:
- artifacts/
- tmp/
- .playwright-cli/

Log filename rule:
- *.log
- *log*.txt
EOF
}

create_zip() {
  rm -f "$ZIP_FILE"
  (
    cd "$STAGING_DIR"
    find . -type f | LC_ALL=C sort | sed 's#^\./##' | zip -q "$ZIP_FILE" -@
  )
}

verify_zip() {
  local forbidden_entries
  local invalid_log_entries

  zipinfo -1 "$ZIP_FILE" > "$ZIP_ENTRY_LIST"

  forbidden_entries="$(grep -E "$FORBIDDEN_ENTRY_REGEX" "$ZIP_ENTRY_LIST" || true)"
  if [[ -n "$forbidden_entries" ]]; then
    echo "[ERROR] forbidden paths were found in the review zip"
    echo "$forbidden_entries"
    exit 1
  fi

  invalid_log_entries="$(grep -E "$LOG_ROOT_REGEX" "$ZIP_ENTRY_LIST" | grep -Ev "$ALLOWED_LOG_ENTRY_REGEX" || true)"
  if [[ -n "$invalid_log_entries" ]]; then
    echo "[ERROR] non-log artifact entries were found in the review zip"
    echo "$invalid_log_entries"
    exit 1
  fi
}

collect_tracked_files
collect_log_files
stage_files
create_zip
verify_zip

FILE_COUNT="$(wc -l < "$ZIP_ENTRY_LIST" | awk '{print $1}')"
LOG_COUNT="$(grep -E "$LOG_ROOT_REGEX" "$ZIP_ENTRY_LIST" | wc -l | awk '{print $1}')"
FILE_SIZE="$(wc -c < "$ZIP_FILE" | awk '{print $1}')"
FILE_SHA="$(calculate_sha256 "$ZIP_FILE")"

echo "[INFO] created ${ZIP_FILE}"
echo "[INFO] files=${FILE_COUNT} logs=${LOG_COUNT} size=${FILE_SIZE} sha256=${FILE_SHA}"
echo "[DONE] RUN_ID=${RUN_ID}"
