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

persistence_xml="server-modernized/src/main/resources/META-INF/persistence.xml"
entities=$(rg -l '^\s*@Entity\b' persistence/src/main/java server-modernized/src/main/java \
  | while IFS= read -r file; do
    pkg=$(rg -oP '^package\s+\K[^;]+' "$file" | head -n 1 || true)
    cls=$(rg -oP '^\s*(?:public\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|record)\s+\K[A-Za-z0-9_]+' "$file" | head -n 1 || true)
    if [[ -n "$pkg" && -n "$cls" ]]; then
      printf '%s.%s\n' "$pkg" "$cls"
    fi
  done \
  | sort -u)

missing=0
for entity in $entities; do
  if ! rg -q "<class>${entity}</class>" "$persistence_xml"; then
    printf 'missing persistence.xml registration: %s\n' "$entity" >&2
    missing=1
  fi
done

exit "$missing"
