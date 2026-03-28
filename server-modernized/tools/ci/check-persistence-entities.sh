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

list_entity_files() {
  if command -v rg >/dev/null 2>&1; then
    rg -l '^\s*@Entity\b' persistence/src/main/java server-modernized/src/main/java || true
  else
    grep -R -l -E '^[[:space:]]*@Entity\b' persistence/src/main/java server-modernized/src/main/java || true
  fi
}

extract_package_name() {
  local file="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -oP '^package\s+\K[^;]+' "$file" | head -n 1 || true
  else
    perl -ne 'print "$1\n" if /^package\s+([^;]+);/' "$file" | head -n 1 || true
  fi
}

extract_class_name() {
  local file="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -oP '^\s*(?:public\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|record)\s+\K[A-Za-z0-9_]+' "$file" | head -n 1 || true
  else
    perl -ne 'print "$1\n" if /^\s*(?:public\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|record)\s+([A-Za-z0-9_]+)/' "$file" | head -n 1 || true
  fi
}

contains_persistence_entry() {
  local entity="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -q "<class>${entity}</class>" "$persistence_xml"
  else
    grep -F -q "<class>${entity}</class>" "$persistence_xml"
  fi
}

entities=$(list_entity_files \
  | while IFS= read -r file; do
    pkg=$(extract_package_name "$file")
    cls=$(extract_class_name "$file")
    if [[ -n "$pkg" && -n "$cls" ]]; then
      printf '%s.%s\n' "$pkg" "$cls"
    fi
  done \
  | sort -u)

missing=0
for entity in $entities; do
  if ! contains_persistence_entry "$entity"; then
    printf 'missing persistence.xml registration: %s\n' "$entity" >&2
    missing=1
  fi
done

exit "$missing"
