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

list_runtime_ddl_offenders() {
  if command -v rg >/dev/null 2>&1; then
    rg -l -i -e 'CREATE TABLE' -e 'ALTER TABLE' -e 'CREATE INDEX' -e 'DROP INDEX' -e 'DROP TABLE' server-modernized/src/main/java || true
  else
    grep -R -l -i -E 'CREATE TABLE|ALTER TABLE|CREATE INDEX|DROP INDEX|DROP TABLE' server-modernized/src/main/java || true
  fi
}

offender_found=0
while IFS= read -r file; do
  printf '  %s\n' "$file" >&2
  offender_found=1
done < <(list_runtime_ddl_offenders)

if [[ "$offender_found" -ne 0 ]]; then
  printf 'runtime DDL outside allowlist:\n' >&2
  exit 1
fi

exit 0
