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

is_allowed_http_surface() {
  local path="$1"
  case "$path" in
    server-modernized/src/main/java/open/dolphin/orca/transport/*)
      return 0
      ;;
    server-modernized/src/main/java/open/dolphin/orca/push/*)
      return 0
      ;;
    server-modernized/src/main/java/open/dolphin/rest/masterupdate/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

http_surface_pattern='import java\.net\.http\.(HttpClient|HttpRequest|HttpResponse)|HttpClient\.newBuilder\(|\.send\([^;]*(HttpResponse|BodyHandlers|HttpRequest)'

violations=()
while IFS= read -r path; do
  if is_allowed_http_surface "$path"; then
    continue
  fi
  if rg -n --pcre2 "$http_surface_pattern" "$path" >/tmp/orca-transport-boundary-match.$$ 2>/dev/null; then
    while IFS= read -r line; do
      violations+=("$path:$line")
    done </tmp/orca-transport-boundary-match.$$
  fi
done < <(find server-modernized/src/main/java -type f -name '*.java' | LC_ALL=C sort)
rm -f /tmp/orca-transport-boundary-match.$$

if [[ ${#violations[@]} -gt 0 ]]; then
  printf 'ORCA transport boundary guard failed: direct JDK HTTP usage outside the approved transport surfaces.\n' >&2
  printf 'Approved surfaces: open/dolphin/orca/transport, open/dolphin/orca/push, open/dolphin/rest/masterupdate.\n' >&2
  printf 'Move ORCA API traffic behind OrcaTransport/OrcaHttpClient, or document a non-ORCA exception in this guard.\n' >&2
  printf ' - %s\n' "${violations[@]}" >&2
  exit 1
fi

printf 'ORCA transport boundary guard passed\n'
