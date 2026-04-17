#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/create-review-package.sh [--run-id RUN_ID] [--out-dir PATH]

Options:
  --run-id   Package id in format YYYYMMDDTHHMMSSZ (default: current UTC timestamp)
  --out-dir  Directory to output the zip file (default: ./artifacts/review-bundles)
  -h, --help Show this message

Creates one reviewer package zip for this repository using git tracked files only.
The package excludes:
  - client/
  - artifacts/
  - node_modules/
  - dist/, target/, build/, out/
  - tmp/, output/, coverage/, test-results/
  - caches and temporary editor/runtime outputs
Additionally, if present, the package includes:
  - qa/browser-manual-qa-progress.json
  - qa/browser-manual-qa-report.md
USAGE
}

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="./artifacts/review-bundles"
PACKAGE_PREFIX="OpenDolphin_WebClient-review-package"
OPTIONAL_INCLUDE_FILES=(
  "qa/browser-manual-qa-progress.json"
  "qa/browser-manual-qa-report.md"
)

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
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command not found" >&2
  exit 1
fi

if ! command -v zipinfo >/dev/null 2>&1; then
  echo "zipinfo command not found" >&2
  exit 1
fi

calculate_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FILE_LIST="$TMP_DIR/file-list.txt"
MANIFEST_FILE="$TMP_DIR/REVIEW_PACKAGE_MANIFEST.txt"
PACKAGE_FILE="$OUT_DIR/${PACKAGE_PREFIX}-${RUN_ID}.zip"

git ls-files -- \
  . \
  ':(exclude)client/**' \
  ':(exclude)artifacts/**' \
  ':(exclude)web-client/artifacts/**' \
  ':(exclude)**/node_modules/**' \
  ':(exclude)**/dist/**' \
  ':(exclude)**/target/**' \
  ':(exclude)**/build/**' \
  ':(exclude)**/out/**' \
  ':(exclude)**/coverage/**' \
  ':(exclude)**/test-results/**' \
  ':(exclude)tmp/**' \
  ':(exclude)output/**' \
  ':(exclude)**/.cache/**' \
  ':(exclude)**/.vite/**' \
  ':(exclude)**/.parcel-cache/**' \
  ':(exclude)**/.turbo/**' \
  ':(exclude)**/.nyc_output/**' \
  ':(exclude)**/*.log' \
  ':(exclude)**/*.tsbuildinfo' \
  ':(exclude)**/.DS_Store' \
  ':(exclude)**/Thumbs.db' \
  > "$FILE_LIST"

TRACKED_FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"

OPTIONAL_INCLUDED=()
for include_path in "${OPTIONAL_INCLUDE_FILES[@]}"; do
  if [[ -f "$include_path" ]] && ! grep -Fxq "$include_path" "$FILE_LIST"; then
    printf '%s\n' "$include_path" >> "$FILE_LIST"
    OPTIONAL_INCLUDED+=("$include_path")
  fi
done

FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"
OPTIONAL_INCLUDE_COUNT="${#OPTIONAL_INCLUDED[@]}"
if [[ "$OPTIONAL_INCLUDE_COUNT" -gt 0 ]]; then
  OPTIONAL_INCLUDES_CSV="$(printf '%s\n' "${OPTIONAL_INCLUDED[@]}" | paste -sd, -)"
else
  OPTIONAL_INCLUDES_CSV="none"
fi

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "No tracked files remained after exclusions" >&2
  exit 1
fi

cat > "$MANIFEST_FILE" <<EOF
review_package_name=${PACKAGE_PREFIX}-${RUN_ID}.zip
run_id=${RUN_ID}
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
root_dir=${ROOT_DIR}
tracked_file_count=${FILE_COUNT}
tracked_git_file_count=${TRACKED_FILE_COUNT}
optional_include_count=${OPTIONAL_INCLUDE_COUNT}
optional_includes=${OPTIONAL_INCLUDES_CSV}
policy=tracked-files-plus-optional-qa
excluded_roots=client/,artifacts/
excluded_generated_dirs=node_modules/,dist/,target/,build/,out/,tmp/,output/,coverage/,test-results/
excluded_cache_dirs=.cache/,.vite/,.parcel-cache/,.turbo/,.nyc_output/
notes=Repository reviewer package without artifacts or legacy client sources. Includes browser manual QA summary files when present.
EOF

rm -f "$PACKAGE_FILE"
zip -q "$PACKAGE_FILE" -@ < "$FILE_LIST"
zip -q "$PACKAGE_FILE" "$MANIFEST_FILE" -j

BAD_PATHS="$(zipinfo -1 "$PACKAGE_FILE" | grep -E '^(client/|artifacts/|web-client/artifacts/|.*/node_modules/|.*/dist/|.*/target/|.*/build/|.*/out/|tmp/|output/|.*/coverage/|.*/test-results/)' || true)"
if [[ -n "$BAD_PATHS" ]]; then
  echo "Excluded paths were found in package:" >&2
  echo "$BAD_PATHS" >&2
  exit 1
fi

ZIP_FILE_COUNT="$(zipinfo -1 "$PACKAGE_FILE" | wc -l | awk '{print $1}')"
ZIP_SIZE="$(wc -c < "$PACKAGE_FILE" | awk '{print $1}')"
ZIP_SHA="$(calculate_sha256 "$PACKAGE_FILE")"

echo "[INFO] created ${PACKAGE_FILE}"
echo "[INFO] files=${ZIP_FILE_COUNT} size=${ZIP_SIZE} sha256=${ZIP_SHA}"
echo "[DONE] RUN_ID=${RUN_ID}"
