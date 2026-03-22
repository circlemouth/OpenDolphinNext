#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT_DIR=$2
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$ROOT_DIR" ]]; then
  ROOT_DIR=$(git rev-parse --show-toplevel)
fi
cd "$ROOT_DIR"

allowed_files=(
  "server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java"
)

offender_found=0
while IFS= read -r file; do
  skip=1
  for allowed in "${allowed_files[@]}"; do
    if [[ "$file" == "$allowed" ]]; then
      skip=0
      break
    fi
  done
  if [[ "$skip" -ne 0 ]]; then
    printf '  %s\n' "$file" >&2
    offender_found=1
  fi
done < <(rg -l -e 'System\.getenv\(' -e 'System\.getProperty\(' -e 'ConfigProvider\.getConfig\(' server-modernized/src/main/java || true)

if [[ "$offender_found" -ne 0 ]]; then
  printf 'direct runtime lookup outside allowlist:\n' >&2
  exit 1
fi

exit 0
