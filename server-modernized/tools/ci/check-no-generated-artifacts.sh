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

artifact_pattern='(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$'
review_target_exclude_pattern='^artifacts/'

filter_review_target() {
  if command -v rg >/dev/null 2>&1; then
    rg -v "$review_target_exclude_pattern" | rg "$artifact_pattern"
  else
    grep -E -v "$review_target_exclude_pattern" | grep -E "$artifact_pattern"
  fi
}

if git rev-parse --git-dir >/dev/null 2>&1; then
  offenders=$(
    {
      git ls-files -z
      git ls-files --others --exclude-standard -z
    } |
      tr '\0' '\n' |
      filter_review_target |
      sort -u || true
  )
else
  offenders=$(
    find . -type f \( \
      -path '*/target/*' -o \
      -name '*.war' -o \
      -path '*/__MACOSX/*' -o \
      -name '.DS_Store' -o \
      -name 'Thumbs.db' \
    \) -print \
      | sed 's#^\./##' \
      | filter_review_target \
      | sort -u || true
  )
fi

if [[ -n "$offenders" ]]; then
  printf 'generated artifacts must not be part of the review target:\n%s\n' "$offenders" >&2
  exit 1
fi

exit 0
