#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/create-review-package-curated.sh [--run-id RUN_ID] [--out-dir PATH] [--size-limit-mb N] [--include-archive-docs]

Options:
  --run-id               Package id in format YYYYMMDDTHHMMSSZ (default: current UTC timestamp)
  --out-dir              Directory to output the zip file (default: ./artifacts/review-bundles)
  --size-limit-mb        Maximum zip size in MiB (default: 50)
  --include-archive-docs Include docs/archive/** in the bundle
  -h, --help             Show this message

Creates one curated review package zip for this repository.
Default contents:
  - current implementation body
  - current / workflow / reference docs
  - ops / tests / scripts / workflows
  - small review evidence under artifacts/doc-reorg/

Default exclusions:
  - legacy implementation/reference trees: client/, server/, ext_lib/, docker/orca/jma-receipt-docker/
  - generated outputs and caches
  - nested zip artifacts and large review-irrelevant binary assets
  - docs/archive/** unless --include-archive-docs is passed
USAGE
}

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="./artifacts/review-bundles"
SIZE_LIMIT_MB=50
INCLUDE_ARCHIVE_DOCS=0
PACKAGE_PREFIX="OpenDolphin_WebClient-review-package-curated"

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
    --size-limit-mb)
      SIZE_LIMIT_MB="${2:-}"
      shift 2
      ;;
    --include-archive-docs)
      INCLUDE_ARCHIVE_DOCS=1
      shift
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

case "$SIZE_LIMIT_MB" in
  ''|*[!0-9]*)
    echo "--size-limit-mb must be a positive integer" >&2
    exit 1
    ;;
esac

calculate_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

file_size_bytes() {
  wc -c < "$1" | awk '{print $1}'
}

should_include_tracked() {
  local path="$1"

  case "$path" in
    client/*|server/*|ext_lib/*|docker/orca/jma-receipt-docker/*)
      return 1
      ;;
    artifacts/*|web-client/artifacts/*)
      return 1
      ;;
    */node_modules/*|*/dist/*|*/target/*|*/build/*|*/out/*|*/coverage/*|*/test-results/*)
      return 1
      ;;
    tmp/*|output/*|*/.cache/*|*/.vite/*|*/.parcel-cache/*|*/.turbo/*|*/.nyc_output/*)
      return 1
      ;;
    docs/archive/*)
      [[ "$INCLUDE_ARCHIVE_DOCS" -eq 1 ]] || return 1
      ;;
    docs/reference/repository-history/OpenDolphin-Lab-A4.pdf)
      return 1
      ;;
    ops/assets/fonts/NotoSansCJKjp-Regular.otf)
      return 1
      ;;
    *.zip|*.har|*.webm|*/.DS_Store|*/Thumbs.db)
      return 1
      ;;
  esac

  case "$path" in
    README.md|AGENTS.md|LICENSE|.gitmodules|.gitignore|.gitattributes|.editorconfig|package.json|package-lock.json|pom.xml|pom.server-modernized.xml|docker-compose*.yml|docker-compose*.yaml|setup-modernized-env.sh|setup-modernized-env.ps1)
      return 0
      ;;
    .github/*|.codex/skills/*|docs/*|web-client/*|server-modernized/*|domain/*|api-contract/*|persistence/*|reporting/*|ops/*|tests/*|scripts/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

add_extra_tree() {
  local root="$1"
  [[ -d "$root" ]] || return 0

  while IFS= read -r -d '' path; do
    case "$path" in
      *.md|*.txt|*.log|*.json|*.yaml|*.yml)
        printf '%s\n' "$path" >> "$RAW_FILE_LIST"
        ;;
    esac
  done < <(find "$root" -type f ! -name '.DS_Store' ! -name '*.zip' -print0)
}

add_extra_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0
  printf '%s\n' "$path" >> "$RAW_FILE_LIST"
}

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RAW_FILE_LIST="$TMP_DIR/raw-file-list.txt"
FILE_LIST="$TMP_DIR/file-list.txt"
MANIFEST_FILE="$TMP_DIR/REVIEW_PACKAGE_MANIFEST.txt"
TOP_FILES_FILE="$TMP_DIR/top-files.txt"
PACKAGE_FILE="$OUT_DIR/${PACKAGE_PREFIX}-${RUN_ID}.zip"

: > "$RAW_FILE_LIST"

while IFS= read -r tracked_path; do
  if should_include_tracked "$tracked_path"; then
    printf '%s\n' "$tracked_path" >> "$RAW_FILE_LIST"
  fi
done < <(git ls-files)

add_extra_tree ".codex/skills"
add_extra_tree "artifacts/doc-reorg"
add_extra_file "scripts/create-review-package-curated.sh"
add_extra_file ".codex/skills/review-curated-50mb-bundle/SKILL.md"

LC_ALL=C sort -u "$RAW_FILE_LIST" | while IFS= read -r path; do
  [[ -f "$path" ]] && printf '%s\n' "$path"
done > "$FILE_LIST"

FILE_COUNT="$(wc -l < "$FILE_LIST" | awk '{print $1}')"

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "No files remained after curated selection" >&2
  exit 1
fi

TOTAL_UNCOMPRESSED_BYTES=0
: > "$TOP_FILES_FILE"
while IFS= read -r path; do
  size_bytes="$(file_size_bytes "$path")"
  TOTAL_UNCOMPRESSED_BYTES=$((TOTAL_UNCOMPRESSED_BYTES + size_bytes))
  printf '%012d %s\n' "$size_bytes" "$path" >> "$TOP_FILES_FILE"
done < "$FILE_LIST"

TOP_10="$(sort -nr "$TOP_FILES_FILE" | sed -n '1,10p' | sed 's/^0*//' | tr '\n' '; ')"

cat > "$MANIFEST_FILE" <<EOF
review_package_name=${PACKAGE_PREFIX}-${RUN_ID}.zip
run_id=${RUN_ID}
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
root_dir=${ROOT_DIR}
selection_policy=curated-current-docs-and-review-evidence
tracked_and_extra_file_count=${FILE_COUNT}
size_limit_mb=${SIZE_LIMIT_MB}
include_archive_docs=${INCLUDE_ARCHIVE_DOCS}
included_roots=README.md,AGENTS.md,.github/,docs/,web-client/,server-modernized/,domain/,api-contract/,persistence/,reporting/,ops/,tests/,scripts/,.codex/skills/
included_extra_roots=artifacts/doc-reorg/,.codex/skills/
review_targets=server-modernized,web-client
review_entry_docs=docs/README.md,docs/architecture/server-modernization-overview.md,docs/runbooks/release-validation.md,web-client/README.md,web-client/notes/ui-current-contract.md
excluded_roots=client/,server/,ext_lib/,docker/orca/jma-receipt-docker/,artifacts/except-doc-reorg/
excluded_large_assets=ops/assets/fonts/NotoSansCJKjp-Regular.otf,docs/reference/repository-history/OpenDolphin-Lab-A4.pdf
excluded_generated=node_modules/,dist/,target/,build/,out/,coverage/,test-results/,tmp/,output/,cache-dirs
uncompressed_bytes=${TOTAL_UNCOMPRESSED_BYTES}
top_10_largest_files=${TOP_10}
notes=Curated review bundle that keeps current docs and selected doc-reorg logs under a strict size cap.
EOF

rm -f "$PACKAGE_FILE"
zip -q "$PACKAGE_FILE" -@ < "$FILE_LIST"
zip -q "$PACKAGE_FILE" "$MANIFEST_FILE" -j

BAD_PATHS="$(
  {
    zipinfo -1 "$PACKAGE_FILE" | grep -E '^(client/|server/|ext_lib/|docker/orca/jma-receipt-docker/|web-client/artifacts/|tmp/|output/|artifacts/review-bundles/|artifacts/reviewer-submission-packets/|.*/node_modules/|.*/dist/|.*/target/|.*/build/|.*/out/|.*/coverage/|.*/test-results/|.*\.zip$)' || true
    zipinfo -1 "$PACKAGE_FILE" | grep '^artifacts/' | grep -v '^artifacts/doc-reorg/' || true
  } | sed '/^$/d'
)"
if [[ -n "$BAD_PATHS" ]]; then
  echo "Excluded paths were found in curated package:" >&2
  echo "$BAD_PATHS" >&2
  exit 1
fi

for required_path in \
  README.md \
  docs/README.md \
  docs/architecture/server-modernization-overview.md \
  docs/implementation/README.md \
  docs/runbooks/release-validation.md \
  docs/runbooks/reviewer-submission-packet.md \
  web-client/README.md \
  web-client/notes/ui-current-contract.md \
  .github/workflows/web-client-test-shards.yml \
  .github/workflows/server-modernized-static-analysis-gate.yml \
  scripts/create-review-package-curated.sh \
  .codex/skills/review-curated-50mb-bundle/SKILL.md
do
  if [[ -f "$required_path" ]] && ! zipinfo -1 "$PACKAGE_FILE" | grep -Fx "$required_path" >/dev/null; then
    echo "Required curated review file missing from package: $required_path" >&2
    exit 1
  fi
done

LATEST_FINAL_REPORT="$(find artifacts/doc-reorg -maxdepth 2 -type f -name 'final-report.md' 2>/dev/null | LC_ALL=C sort | tail -n 1 || true)"
LATEST_ADDENDUM_REPORT="$(find artifacts/doc-reorg -maxdepth 2 -type f -name 'addendum-report.md' 2>/dev/null | LC_ALL=C sort | tail -n 1 || true)"

for optional_review_report in "$LATEST_FINAL_REPORT" "$LATEST_ADDENDUM_REPORT"; do
  if [[ -n "$optional_review_report" ]] && ! zipinfo -1 "$PACKAGE_FILE" | grep -Fx "$optional_review_report" >/dev/null; then
    echo "Expected doc-reorg review report missing from package: $optional_review_report" >&2
    exit 1
  fi
done

ZIP_FILE_COUNT="$(zipinfo -1 "$PACKAGE_FILE" | wc -l | awk '{print $1}')"
ZIP_SIZE_BYTES="$(file_size_bytes "$PACKAGE_FILE")"
ZIP_SIZE_MB="$(awk "BEGIN { printf \"%.2f\", $ZIP_SIZE_BYTES / 1024 / 1024 }")"
ZIP_SHA="$(calculate_sha256 "$PACKAGE_FILE")"
SIZE_LIMIT_BYTES=$((SIZE_LIMIT_MB * 1024 * 1024))

if [[ "$ZIP_SIZE_BYTES" -gt "$SIZE_LIMIT_BYTES" ]]; then
  echo "Curated package exceeds size limit: ${ZIP_SIZE_MB} MiB > ${SIZE_LIMIT_MB} MiB" >&2
  echo "Largest included files:" >&2
  sort -nr "$TOP_FILES_FILE" | sed -n '1,20p' >&2
  exit 1
fi

echo "[INFO] created ${PACKAGE_FILE}"
echo "[INFO] files=${ZIP_FILE_COUNT} size_bytes=${ZIP_SIZE_BYTES} size_mib=${ZIP_SIZE_MB} sha256=${ZIP_SHA}"
echo "[DONE] RUN_ID=${RUN_ID}"
