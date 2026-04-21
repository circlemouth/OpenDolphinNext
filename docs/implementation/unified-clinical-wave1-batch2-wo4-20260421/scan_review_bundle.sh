#!/usr/bin/env bash
set -euo pipefail

zip_path="$1"
scan_log="$2"
tmp_list="$(mktemp)"
tmp_text="$(mktemp)"
trap 'rm -f "$tmp_list" "$tmp_text"' EXIT

unzip -Z1 "$zip_path" > "$tmp_list"
forbidden_matches="$(rg -n '(^|/)(\.git|node_modules|dist|target|coverage|test-results|traces|videos|screenshots)(/|$)|\.(har)$' "$tmp_list" || true)"
forbidden_count="$(printf '%s\n' "$forbidden_matches" | sed '/^$/d' | wc -l | tr -d ' ')"

: > "$tmp_text"
while IFS= read -r entry; do
  case "$entry" in
    *.md|*.txt|*.json|*.jsonl|*.ts|*.tsx|*.java|*.sh)
      {
        printf '\n--- %s ---\n' "$entry"
        unzip -p "$zip_path" "$entry" || true
      } >> "$tmp_text"
      ;;
  esac
done < "$tmp_list"

secret_hits="$(rg -n 'Authorization:[[:space:]]*[^<[:space:]][^[:space:]]{8,}|Cookie:[[:space:]]*[^<[:space:]][^[:space:]]{8,}|JSESSIONID=|CSRF[_-]?TOKEN=[^[:space:]]{8,}|ORCA_API_PASSWORD=[^[:space:]]+|Basic[[:space:]]+[A-Za-z0-9+/=]{16,}|password[[:space:]]*[:=][[:space:]]*[^<[:space:]][^[:space:]]{10,}' "$tmp_text" || true)"
secret_count="$(printf '%s\n' "$secret_hits" | sed '/^$/d' | wc -l | tr -d ' ')"

{
  printf 'zip=%s\n' "$zip_path"
  printf 'file_count=%s\n' "$(wc -l < "$tmp_list" | tr -d ' ')"
  printf 'forbidden_path_hits=%s\n' "$forbidden_count"
  if [ "$forbidden_count" != "0" ]; then
    printf '%s\n' "$forbidden_matches"
  fi
  printf 'secret_pattern_hits=%s\n' "$secret_count"
  if [ "$secret_count" != "0" ]; then
    printf '%s\n' "$secret_hits"
  fi
  if [ "$forbidden_count" = "0" ] && [ "$secret_count" = "0" ]; then
    printf 'verdict=PASS\n'
  else
    printf 'verdict=FAIL\n'
  fi
} > "$scan_log"

cat "$scan_log"

if [ "$forbidden_count" != "0" ] || [ "$secret_count" != "0" ]; then
  exit 2
fi
