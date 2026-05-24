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
  "docs/source-overview.md"
  "docs/current-state.md"
  "docs/architecture.md"
  "docs/setup-and-validation.md"
  "docs/security-and-orca.md"
  "docs/minagawa-research/README.md"
  "web-client/README.md"
)

status=0
for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'missing markdown file: %s\n' "$file" >&2
    status=1
    continue
  fi

  if command -v rg >/dev/null 2>&1; then
    matches_cmd=(rg -n -o -P '\[[^][]+\]\((?!https?://|mailto:|#)[^)]+\)' "$file")
  else
    matches_cmd=(perl -ne 'while(/\[[^][]+\]\((?!https?:\/\/|mailto:|#)[^)]+\)/g){print "$.:$&\n"}' "$file")
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
  done < <("${matches_cmd[@]}" || true)
done

exit "$status"
