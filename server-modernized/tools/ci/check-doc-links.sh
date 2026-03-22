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

FILES=(
  "README.md"
  "docs/README.md"
  "docs/development/server-modernized-remediation-master-checklist.md"
  "docs/development/pull-request-checklist-template.md"
  "docs/development/execution-log.md"
  "docs/contracts/document-integrity.md"
  "docs/contracts/health-endpoints.md"
  "docs/contracts/orca-connection.md"
  "docs/contracts/orca-master-api.md"
  "docs/contracts/patient-images.md"
  "docs/contracts/runtime-config.md"
  "docs/runbooks/release-validation.md"
  "docs/server-modernization/README.md"
)

status=0
for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'missing markdown file: %s\n' "$file" >&2
    status=1
    continue
  fi

  while IFS= read -r match; do
    target=${match#*](}
    target=${target%)}
    target=${target%% *}
    target=${target%%\#*}

    if [[ -z "$target" || "$target" == "#"* || "$target" == http* || "$target" == mailto:* ]]; then
      continue
    fi

    if [[ "$target" == /* ]]; then
      resolved="$target"
    else
      resolved=$(perl -MFile::Spec -e 'print File::Spec->rel2abs($ARGV[0], $ARGV[1])' "$target" "$(dirname "$file")")
    fi

    if [[ ! -e "$resolved" ]]; then
      printf 'broken link: %s -> %s\n' "$file" "$match" >&2
      status=1
    fi
  done < <(rg -n -o -P '\[[^][]+\]\((?!https?://|mailto:|#)[^)]+\)' "$file" || true)
done

exit "$status"
