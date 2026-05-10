#!/usr/bin/env bash
set -euo pipefail

ROOT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="${2:-}"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel)"
fi
cd "$ROOT"

is_guard_target() {
  local path="$1"
  case "$path" in
    web-client/dist/*|web-client/test-results/*|test-results/*|playwright-report/*)
      return 0
      ;;
    */__snapshots__/*|*.snap)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

artifact_name_pattern='(^|/)(error-context\.md|network\.json|requests\.json)$|(^|/)request-xml/.*\.xml$|(^|/).*raw.*\.(xml|json|txt)$|\.(har|webm|mp4|png|jpe?g)$|(^|/)trace[^/]*\.zip$'
content_pattern='Authorization[[:space:]:=]+[^[:space:]"'"'"'\'',;{}]+|Cookie[[:space:]:=]+[^[:space:]"'"'"'\'',;{}]+|Set-Cookie[[:space:]:=]+[^[:space:]"'"'"'\'',;{}]+|JSESSIONID[[:space:]=:]+[^[:space:]"'"'"'\'',;{}]+|CSRF[[:space:]_-]*(Token)?[[:space:]=:]+[^[:space:]"'"'"'\'',;{}]+|Basic[[:space:]]+[A-Za-z0-9+/=]{12,}|ORCA_(API|BASIC)_(USER|PASSWORD)[[:space:]=:]+[^[:space:]"'"'"'\'',;{}]+|raw(Orca|ORCA)?(Body|Xml|XML|Response)|requestXml|responseXml|Patient_Name|WholeName|Home_Address|HealthInsuredPerson_(Symbol|Number)|Insurance_Number'

list_review_candidates() {
  if git rev-parse --git-dir >/dev/null 2>&1; then
    {
      git ls-files -z
      git ls-files --others --exclude-standard -z
    } | tr '\0' '\n' | sort -u
  else
    find web-client tests test-results playwright-report -type f -print 2>/dev/null | sed 's#^\./##' | sort -u
  fi
}

candidates=()
while IFS= read -r path; do
  if [[ -f "$path" ]] && is_guard_target "$path"; then
    candidates+=("$path")
  fi
done < <(list_review_candidates)

forbidden_artifacts=()
for path in "${candidates[@]}"; do
  if [[ "$path" =~ $artifact_name_pattern ]]; then
    forbidden_artifacts+=("$path")
  fi
done

if [[ ${#forbidden_artifacts[@]} -gt 0 ]]; then
  printf 'sensitive evidence guard rejected raw browser/test artifact files:\n' >&2
  printf ' - %s\n' "${forbidden_artifacts[@]}" >&2
  exit 1
fi

if [[ ${#candidates[@]} -gt 0 ]]; then
  if rg -n -I --pcre2 "$content_pattern" "${candidates[@]}"; then
    printf 'sensitive evidence guard rejected credential/PHI/raw ORCA markers in review outputs or snapshots\n' >&2
    exit 1
  fi
fi

printf 'sensitive evidence redaction guard passed\n'
