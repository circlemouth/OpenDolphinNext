#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'USAGE'
Usage: ops/tests/orca/api-smoke.sh [options] [-- curl_args]

Options:
  -o, --output DIR      保存先ディレクトリ (default: artifacts/orca-connectivity/<RUN_ID>)
      --base-url URL    ORCA ベース URL (default: http://orca:8000)
      --prefixes LIST   走査対象プレフィックス (カンマ区切り、default: route,direct)
      --run-id ID       Evidence ディレクトリ名 (default: <UTC>TorcaApiSmoke)
  -h, --help            本ヘルプを表示

Example:
  RUN_ID=20251113TorcaApiSmokeZ1 \
  ops/tests/orca/api-smoke.sh -o artifacts/orca-connectivity/20251113TorcaApiSmokeZ1 -- \
    -u ormaster:change_me -H 'Accept: application/json'
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

load_orca_env_file() {
  local env_file="${ORCA_ENV_FILE:-}"
  local repo_local="$REPO_ROOT/orca.env.local"
  local home_local=""
  if [[ -n "${HOME:-}" ]]; then
    home_local="$HOME/.config/opendolphin/orca.env"
  fi

  if [[ -n "$env_file" ]]; then
    if [[ ! -r "$env_file" ]]; then
      echo "[ERROR] ORCA_ENV_FILE is set but not readable: $env_file" >&2
      exit 1
    fi
    # shellcheck disable=SC1090
    source "$env_file"
    return 0
  fi

  for candidate in "$repo_local" "$home_local"; do
    if [[ -r "$candidate" ]]; then
      # shellcheck disable=SC1090
      source "$candidate"
      return 0
    fi
  done
}

load_orca_env_file

RUN_ID_DEFAULT="$(date -u +%Y%m%dT%H%M%SZ)TorcaApiSmoke"
BASE_URL="${ORCA_SMOKE_BASE_URL:-http://orca:8000}"
REQUESTED_PREFIXES="${ORCA_SMOKE_PREFIXES:-route,direct}"
RUN_ID="${RUN_ID:-$RUN_ID_DEFAULT}"
OUTPUT_DIR=""

EXTRA_CURL_ARGS=()
if [[ -n "${ORCA_SMOKE_CURL_OPTS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_CURL_ARGS+=(${ORCA_SMOKE_CURL_OPTS})
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      [[ $# -ge 2 ]] || { echo "[ERROR] --output requires DIR" >&2; exit 1; }
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --base-url)
      [[ $# -ge 2 ]] || { echo "[ERROR] --base-url requires URL" >&2; exit 1; }
      BASE_URL="$2"
      shift 2
      ;;
    --prefixes)
      [[ $# -ge 2 ]] || { echo "[ERROR] --prefixes requires LIST" >&2; exit 1; }
      REQUESTED_PREFIXES="$2"
      shift 2
      ;;
    --run-id)
      [[ $# -ge 2 ]] || { echo "[ERROR] --run-id requires ID" >&2; exit 1; }
      RUN_ID="$2"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    --)
      shift
      EXTRA_CURL_ARGS+=("$@")
      break
      ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="artifacts/orca-connectivity/${RUN_ID}"
fi

mkdir -p "$OUTPUT_DIR"

IFS=',' read -r -a PREFIX_TOKENS <<<"$REQUESTED_PREFIXES"
PREFIX_NAMES=()
PREFIX_PATHS=()
for token in "${PREFIX_TOKENS[@]}"; do
  case "$token" in
    "" )
      continue
      ;;
    route)
      PREFIX_NAMES+=("route")
      PREFIX_PATHS+=("route")
      ;;
    direct)
      PREFIX_NAMES+=("direct")
      PREFIX_PATHS+=("")
      ;;
    api)
      PREFIX_NAMES+=("api")
      PREFIX_PATHS+=("api")
      ;;
    *)
      echo "[ERROR] Unsupported prefix token: $token" >&2
      exit 1
      ;;
  esac
done

if [[ ${#PREFIX_NAMES[@]} -eq 0 ]]; then
  echo "[ERROR] プレフィックスが 0 件です (--prefixes を確認してください)" >&2
  exit 1
fi

ENDPOINTS=(
  "patientgetv2|GET|api01rv2/patientgetv2?id=000001"
  "appointmodv2|GET|orca14/appointmodv2?class=01"
  "medicalmodv2|GET|api21/medicalmodv2?class=01"
  "acceptmodv2|GET|orca11/acceptmodv2?class=01"
  "acceptlstv2|POST|api01rv2/acceptlstv2?class=01"
  "patientmemomodv2|GET|orca06/patientmemomodv2"
)

slugify() {
  echo "$1" | tr '/?=&' '_____' | tr -c 'A-Za-z0-9._-' '_'
}

build_url() {
  local prefix="$1"
  local endpoint="$2"
  local base="${BASE_URL%/}"
  local clean_endpoint="${endpoint#/}"
  if [[ -n "$prefix" ]]; then
    local clean_prefix="${prefix#/}"
    echo "${base}/${clean_prefix}/${clean_endpoint}"
  else
    echo "${base}/${clean_endpoint}"
  fi
}

run_curl() {
  local method="$1"
  local url="$2"
  local outfile="$3"
  local tmp_err
  tmp_err="$(mktemp)"

  local -a cmd=(curl -isS)
  if [[ ${#EXTRA_CURL_ARGS[@]} -gt 0 ]]; then
    cmd+=("${EXTRA_CURL_ARGS[@]}")
  fi
  if [[ "$method" == "GET" ]]; then
    cmd+=("$url")
  else
    cmd+=(-X "$method" -H "Content-Length: 0" -d '' "$url")
  fi

  local exit_code
  set +e
  "${cmd[@]}" >"$outfile" 2>"$tmp_err"
  exit_code=$?
  set -e

  local http_status
  if (( exit_code != 0 )); then
    cat "$tmp_err" >>"$outfile"
    http_status="curl_error_${exit_code}"
  else
    http_status="$(awk 'NR==1 {print $2; exit}' "$outfile")"
    [[ -n "$http_status" ]] || http_status="unknown"
  fi

  rm -f "$tmp_err"
  printf '%s\n' "$http_status"
}

SUMMARY_FILE="${OUTPUT_DIR}/summary.csv"
echo "prefix,label,method,url,http_status,output_file" >"$SUMMARY_FILE"

printf "%-8s %-12s %-6s %-55s %s\n" "PREFIX" "STATUS" "METHOD" "ENDPOINT" "FILE"

overall_rc=0
for entry in "${ENDPOINTS[@]}"; do
  IFS='|' read -r label method endpoint <<<"$entry"
  endpoint="${endpoint#/}"
  for idx in "${!PREFIX_NAMES[@]}"; do
    prefix_name="${PREFIX_NAMES[$idx]}"
    prefix_path="${PREFIX_PATHS[$idx]}"
    url="$(build_url "$prefix_path" "$endpoint")"
    slug="$(slugify "${label}_${prefix_name}")"
    outfile="${OUTPUT_DIR}/${slug}.http"
    status="$(run_curl "$method" "$url" "$outfile")"
    echo "$prefix_name,$label,$method,$url,$status,$outfile" >>"$SUMMARY_FILE"
    printf "%-8s %-12s %-6s %-55s %s\n" "$prefix_name" "$status" "$method" "$endpoint" "$outfile"
    [[ "$status" == curl_error_* ]] && overall_rc=1
  done
done

echo ""
echo "Summary: $SUMMARY_FILE"
exit $overall_rc
