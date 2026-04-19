#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/create-review-package.sh [--run-id RUN_ID] [--out-dir PATH] [--name-suffix SUFFIX] [--include-review-log-manifest PATH]

Options:
  --run-id                       Package id in format YYYYMMDDTHHMMSSZ (default: current UTC timestamp)
  --out-dir                      Directory to output the zip file (default: ./artifacts/review-bundles)
  --name-suffix                  Suffix appended after RUN_ID in the zip filename, e.g. -with-dynamic-evidence
  --include-review-log-manifest  Add this manifest and its bullet-listed log files as package evidence
  -h, --help                     Show this message

Creates one reviewer package zip for this repository using git tracked files as the base.
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
If --include-review-log-manifest is provided, the package also includes that
manifest and the manifest's "- path" entries, resolved relative to the manifest
directory. Manifest-listed evidence may be generated/untracked, but must stay
inside the repository and outside excluded roots. This is for sanitized review
log evidence only; it does not make the zip a clean git checkout and it does
not include .git metadata.
USAGE
}

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="./artifacts/review-bundles"
PACKAGE_PREFIX="OpenDolphin_WebClient-review-package"
PACKAGE_NAME_SUFFIX=""
REVIEW_LOG_MANIFEST=""
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
    --name-suffix)
      PACKAGE_NAME_SUFFIX="${2:-}"
      shift 2
      ;;
    --include-review-log-manifest)
      REVIEW_LOG_MANIFEST="${2:-}"
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

if [[ -n "$PACKAGE_NAME_SUFFIX" && ! "$PACKAGE_NAME_SUFFIX" =~ ^[-._A-Za-z0-9]+$ ]]; then
  echo "--name-suffix may only contain alphanumeric characters, dash, dot, and underscore" >&2
  exit 1
fi

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

repo_relative_path() {
  local input_path="$1"
  local input_dir
  local input_base
  local input_abs
  input_dir="$(dirname "$input_path")"
  input_base="$(basename "$input_path")"
  input_abs="$(cd "$input_dir" && pwd -P)/$input_base"
  case "$input_abs" in
    "$ROOT_DIR"/*)
      printf '%s\n' "${input_abs#"$ROOT_DIR"/}"
      ;;
    *)
      echo "review log manifest entry is outside repository: $input_path" >&2
      exit 1
      ;;
  esac
}

is_excluded_package_path() {
  case "$1" in
    .git|.git/*|client/*|artifacts/*|web-client/artifacts/*|node_modules/*|*/node_modules/*|dist/*|*/dist/*|target/*|*/target/*|build/*|*/build/*|out/*|*/out/*|coverage/*|*/coverage/*|test-results/*|*/test-results/*|tmp/*|output/*|.cache/*|*/.cache/*|.vite/*|*/.vite/*|.parcel-cache/*|*/.parcel-cache/*|.turbo/*|*/.turbo/*|.nyc_output/*|*/.nyc_output/*|*.tsbuildinfo|*/.DS_Store|*/Thumbs.db)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FILE_LIST="$TMP_DIR/file-list.txt"
RAW_FILE_LIST="$TMP_DIR/raw-file-list.txt"
MANIFEST_FILE="$TMP_DIR/REVIEW_PACKAGE_MANIFEST.txt"
PACKAGE_FILE="$OUT_DIR/${PACKAGE_PREFIX}-${RUN_ID}${PACKAGE_NAME_SUFFIX}.zip"

git ls-files -- \
  . \
  ':(exclude)client/**' \
  ':(exclude)artifacts/**' \
  ':(exclude)web-client/artifacts/**' \
  ':(exclude)node_modules/**' \
  ':(exclude)**/node_modules/**' \
  ':(exclude)dist/**' \
  ':(exclude)**/dist/**' \
  ':(exclude)target/**' \
  ':(exclude)**/target/**' \
  ':(exclude)build/**' \
  ':(exclude)**/build/**' \
  ':(exclude)out/**' \
  ':(exclude)**/out/**' \
  ':(exclude)coverage/**' \
  ':(exclude)**/coverage/**' \
  ':(exclude)test-results/**' \
  ':(exclude)**/test-results/**' \
  ':(exclude)tmp/**' \
  ':(exclude)output/**' \
  ':(exclude).cache/**' \
  ':(exclude)**/.cache/**' \
  ':(exclude).vite/**' \
  ':(exclude)**/.vite/**' \
  ':(exclude).parcel-cache/**' \
  ':(exclude)**/.parcel-cache/**' \
  ':(exclude).turbo/**' \
  ':(exclude)**/.turbo/**' \
  ':(exclude).nyc_output/**' \
  ':(exclude)**/.nyc_output/**' \
  ':(exclude)**/*.log' \
  ':(exclude)**/*.tsbuildinfo' \
  ':(exclude)**/.DS_Store' \
  ':(exclude)**/Thumbs.db' \
  > "$RAW_FILE_LIST"

: > "$FILE_LIST"
TRACKED_MISSING=()
while IFS= read -r tracked_path; do
  if [[ -e "$tracked_path" ]]; then
    printf '%s\n' "$tracked_path" >> "$FILE_LIST"
  else
    TRACKED_MISSING+=("$tracked_path")
  fi
done < "$RAW_FILE_LIST"

TRACKED_FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"
TRACKED_MISSING_FILE_COUNT="${#TRACKED_MISSING[@]}"

OPTIONAL_INCLUDED=()
for include_path in "${OPTIONAL_INCLUDE_FILES[@]}"; do
  if [[ -f "$include_path" ]] && ! grep -Fxq "$include_path" "$FILE_LIST"; then
    printf '%s\n' "$include_path" >> "$FILE_LIST"
    OPTIONAL_INCLUDED+=("$include_path")
  fi
done

REVIEW_LOG_INCLUDED=()
if [[ -n "$REVIEW_LOG_MANIFEST" ]]; then
  if [[ ! -f "$REVIEW_LOG_MANIFEST" ]]; then
    echo "review log manifest not found: $REVIEW_LOG_MANIFEST" >&2
    exit 1
  fi

  MANIFEST_DIR="$(dirname "$REVIEW_LOG_MANIFEST")"
  MANIFEST_REPO_PATH="$(git ls-files --full-name -- "$REVIEW_LOG_MANIFEST" | head -n 1)"
  if [[ -z "$MANIFEST_REPO_PATH" ]]; then
    MANIFEST_REPO_PATH="$(repo_relative_path "$REVIEW_LOG_MANIFEST")"
  fi
  if is_excluded_package_path "$MANIFEST_REPO_PATH"; then
    echo "review log manifest is excluded from review packages: $MANIFEST_REPO_PATH" >&2
    exit 1
  fi
  if ! grep -Fxq "$MANIFEST_REPO_PATH" "$FILE_LIST"; then
    printf '%s\n' "$MANIFEST_REPO_PATH" >> "$FILE_LIST"
    REVIEW_LOG_INCLUDED+=("$MANIFEST_REPO_PATH")
  fi

  while IFS= read -r log_path; do
    [[ -z "$log_path" ]] && continue
    if [[ "$log_path" = /* || "$log_path" == *".."* ]]; then
      echo "unsafe review log manifest entry: $log_path" >&2
      exit 1
    fi
    repo_path="$MANIFEST_DIR/$log_path"
    if [[ ! -f "$repo_path" ]]; then
      echo "review log manifest entry not found: $repo_path" >&2
      exit 1
    fi
    tracked_repo_path="$(git ls-files --full-name -- "$repo_path" | head -n 1)"
    if [[ -n "$tracked_repo_path" ]]; then
      repo_path="$tracked_repo_path"
    else
      repo_path="$(repo_relative_path "$repo_path")"
    fi
    if is_excluded_package_path "$repo_path"; then
      echo "review log manifest entry is excluded from review packages: $repo_path" >&2
      exit 1
    fi
    if ! grep -Fxq "$repo_path" "$FILE_LIST"; then
      printf '%s\n' "$repo_path" >> "$FILE_LIST"
      REVIEW_LOG_INCLUDED+=("$repo_path")
    fi
  done < <(sed -n 's/^- //p' "$REVIEW_LOG_MANIFEST")
fi

FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"
OPTIONAL_INCLUDE_COUNT="${#OPTIONAL_INCLUDED[@]}"
REVIEW_LOG_INCLUDE_COUNT="${#REVIEW_LOG_INCLUDED[@]}"
if [[ "$OPTIONAL_INCLUDE_COUNT" -gt 0 ]]; then
  OPTIONAL_INCLUDES_CSV="$(printf '%s\n' "${OPTIONAL_INCLUDED[@]}" | paste -sd, -)"
else
  OPTIONAL_INCLUDES_CSV="none"
fi
if [[ "$REVIEW_LOG_INCLUDE_COUNT" -gt 0 ]]; then
  REVIEW_LOG_INCLUDES_CSV="$(printf '%s\n' "${REVIEW_LOG_INCLUDED[@]}" | paste -sd, -)"
else
  REVIEW_LOG_INCLUDES_CSV="none"
fi

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "No tracked files remained after exclusions" >&2
  exit 1
fi

cat > "$MANIFEST_FILE" <<EOF
review_package_name=${PACKAGE_PREFIX}-${RUN_ID}${PACKAGE_NAME_SUFFIX}.zip
run_id=${RUN_ID}
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
root_dir=.
tracked_file_count=${FILE_COUNT}
tracked_git_file_count=${TRACKED_FILE_COUNT}
tracked_missing_file_count=${TRACKED_MISSING_FILE_COUNT}
optional_include_count=${OPTIONAL_INCLUDE_COUNT}
optional_includes=${OPTIONAL_INCLUDES_CSV}
review_log_include_count=${REVIEW_LOG_INCLUDE_COUNT}
review_log_includes=${REVIEW_LOG_INCLUDES_CSV}
git_metadata_included=no
clean_checkout_claim=not_applicable
policy=tracked-files-plus-optional-qa
excluded_roots=client/,artifacts/
excluded_generated_dirs=node_modules/,dist/,target/,build/,out/,tmp/,output/,coverage/,test-results/
excluded_cache_dirs=.cache/,.vite/,.parcel-cache/,.turbo/,.nyc_output/
notes=Repository reviewer support package without artifacts or legacy client sources. Includes browser manual QA summary files when present. This zip has no .git directory and must not be used as clean checkout evidence.
EOF

rm -f "$PACKAGE_FILE"
zip -q "$PACKAGE_FILE" -@ < "$FILE_LIST"
zip -q "$PACKAGE_FILE" "$MANIFEST_FILE" -j

BAD_PATHS="$(zipinfo -1 "$PACKAGE_FILE" | grep -E '^(\.git/|client/|artifacts/|web-client/artifacts/|node_modules/|dist/|target/|build/|out/|tmp/|output/|coverage/|test-results/|.*/node_modules/|.*/dist/|.*/target/|.*/build/|.*/out/|.*/coverage/|.*/test-results/)' || true)"
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
