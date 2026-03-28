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

resolver="server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java"
sample="server-modernized/config/server-modernized.env.sample"

if command -v rg >/dev/null 2>&1; then
  resolver_keys=$(rg -oP 'public static final String KEY_[A-Z0-9_]+\s*=\s*"\K[^"]+' "$resolver" \
    | sed -E 's/[.-]/_/g' \
    | tr '[:lower:]' '[:upper:]' \
    | sort -u)
  sample_keys=$(rg -oP '^[A-Z0-9_]+(?==)' "$sample" | sort -u)
else
  resolver_keys=$(perl -ne 'print "$1\n" while /public static final String KEY_[A-Z0-9_]+\s*=\s*"([^"]+)"/g' "$resolver" \
    | sed -E 's/[.-]/_/g' \
    | tr '[:lower:]' '[:upper:]' \
    | sort -u)
  sample_keys=$(perl -ne 'print "$1\n" if /^([A-Z0-9_]+)=/' "$sample" | sort -u)
fi

missing=0
for key in $resolver_keys; do
  if ! grep -qx "$key" <<<"$sample_keys"; then
    printf 'missing sample env key: %s\n' "$key" >&2
    missing=1
  fi
done

exit "$missing"
