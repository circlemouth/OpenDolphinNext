#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/create-review-bundles.sh [--mode server|web|both] [--run-id RUN_ID] [--out-dir PATH]

Options:
  --mode     Target bundle mode. one of: server, web, both (default: both)
  --run-id   Bundle id in format YYYYMMDDTHHMMSSZ (default: current UTC timestamp)
  --out-dir  Directory to output zip files (default: ./artifacts)
  -h, --help Show this message

Creates clean review bundles (zip) for web-client and/or server-modernized
using git tracked files only and excluding:
  node_modules, dist, target, artifacts, tmp, test-results
USAGE
}

MODE="both"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="./artifacts"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
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

case "$MODE" in
  server|web|both)
    ;;
  *)
    echo "Invalid --mode value: $MODE"
    echo "Supported values are: server | web | both"
    exit 1
    ;;
esac

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command not found"
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip command not found"
  exit 1
fi

mkdir -p "$OUT_DIR"

EXCLUDE_PATTERN='(^|/)node_modules(/|$)|(^|/)dist(/|$)|(^|/)target(/|$)|(^|/)artifacts(/|$)|(^|/)tmp(/|$)|(^|/)test-results(/|$)'

calculate_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

create_bundle() {
  local target=$1
  local zip_file="$OUT_DIR/${target}-${RUN_ID}.zip"
  local file_list
  local count
  local bad_paths

  if [[ ! -d "$target" ]]; then
    echo "[WARN] target not found: $target, skip"
    return 0
  fi

  file_list="$(mktemp)"
  trap 'rm -f "$file_list"' RETURN

  git ls-files "$target" | grep -Ev "$EXCLUDE_PATTERN" > "$file_list"
  count=$(wc -l < "$file_list")

  if [[ "$count" -eq 0 ]]; then
    echo "[WARN] no tracked files to package for $target after exclusion, skip"
    rm -f "$file_list"
    trap - RETURN
    return 0
  fi

  if ! zip -q "$zip_file" -@ < "$file_list"; then
    echo "[ERROR] zip creation failed: $zip_file"
    rm -f "$file_list"
    trap - RETURN
    return 1
  fi

  bad_paths="$(unzip -l "$zip_file" | tail -n +4 | sed '$d' | awk 'NF >= 4 {print $4}' | grep -E "$EXCLUDE_PATTERN" || true)"
  if [[ -n "$bad_paths" ]]; then
    echo "[ERROR] excluded paths were found in $zip_file"
    echo "$bad_paths"
    rm -f "$file_list"
    trap - RETURN
    return 1
  fi

  file_size="$(wc -c < "$zip_file")"
  file_sha="$(calculate_sha256 "$zip_file")"
  file_count=$(unzip -l "$zip_file" | tail -n +4 | sed '$d' | wc -l | awk '{print $1}')

  echo "[INFO] created ${zip_file}"
  echo "[INFO] files=${file_count} size=${file_size} sha256=${file_sha}"

  rm -f "$file_list"
  trap - RETURN
}

case "$MODE" in
  web)
    create_bundle web-client
    ;;
  server)
    create_bundle server-modernized
    ;;
  both)
    create_bundle web-client
    create_bundle server-modernized
    ;;
esac

echo "[DONE] RUN_ID=${RUN_ID}"
