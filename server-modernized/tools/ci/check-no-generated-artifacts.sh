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

if git rev-parse --git-dir >/dev/null 2>&1; then
  offenders=$(git status --porcelain \
    | awk '{print $2}' \
    | rg '(^|/)target/|\.war$' || true)
else
  offenders=$(find . -type f \( -path '*/target/*' -o -name '*.war' \) -print \
    | sed 's#^\./##' || true)
fi

if [[ -n "$offenders" ]]; then
  printf 'generated artifacts must not be part of the review target:\n%s\n' "$offenders" >&2
  exit 1
fi

exit 0
