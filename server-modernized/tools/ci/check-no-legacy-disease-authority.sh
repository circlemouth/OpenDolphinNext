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

scan_roots=(
  "api-contract/src"
  "domain/src"
  "persistence/src"
  "reporting/src"
  "server-modernized/src/main"
  "server-modernized/src/test"
  "web-client/src"
  "web-client/scripts"
  "scripts"
  "tests"
  "ops"
)

existing_roots=()
for root in "${scan_roots[@]}"; do
  if [[ -e "$root" ]]; then
    existing_roots+=("$root")
  fi
done

if [[ "${#existing_roots[@]}" -eq 0 ]]; then
  printf 'no roots to scan for legacy disease authority paths\n' >&2
  exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
  printf 'ripgrep is required for legacy disease authority guard\n' >&2
  exit 2
fi

offender_found=0

scan_for() {
  local label=$1
  shift
  local output
  output=$(rg -n "$@" \
    --glob '!**/node_modules/**' \
    --glob '!**/target/**' \
    --glob '!**/dist/**' \
    "${existing_roots[@]}" || true)
  if [[ -n "$output" ]]; then
    printf 'legacy disease authority pattern detected: %s\n' "$label" >&2
    printf '%s\n' "$output" >&2
    offender_found=1
  fi
}

scan_for "ORCA diseasev2 API" -e '\bdiseasev2\b' -e '\bdiseasemodv2\b'
scan_for "ORCA patient disease DB truth read" -e '\btbl_ptbyomei\b' -e '\bptbyomei\b'
scan_for "CLAIM disease transport" \
  -e 'CLAIM.*(病名|diagnos|disease)' \
  -e '(病名|diagnos|disease).*CLAIM'

if [[ "$offender_found" -ne 0 ]]; then
  printf 'legacy disease authority guard failed\n' >&2
  exit 1
fi

printf 'legacy disease authority guard passed (%s roots scanned)\n' "${#existing_roots[@]}"
