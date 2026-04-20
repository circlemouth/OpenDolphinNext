#!/usr/bin/env bash

set -uo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/tools/command-log-wrapper.sh --run-id RUN_ID --log PATH [--cwd PATH] [--target-path PATH --target-sha256 HASH] -- COMMAND [ARGS...]

Writes command evidence logs with command/cwd/runId/start/end/exit_code metadata.
When the command validates a concrete artifact, pass --target-path and
--target-sha256 so the evidence binds to the exact target.
The wrapped command's stdout and stderr are captured in the log. If the command
emits no output, the log records an explicit no-output marker so the evidence
still has a non-empty command output section. The wrapper exits with the wrapped
command's exit code.
USAGE
}

RUN_ID="${RUN_ID:-}"
LOG_PATH=""
COMMAND_CWD=""
TARGET_PATH=""
TARGET_SHA256=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --log)
      LOG_PATH="${2:-}"
      shift 2
      ;;
    --cwd)
      COMMAND_CWD="${2:-}"
      shift 2
      ;;
    --target-path)
      TARGET_PATH="${2:-}"
      shift 2
      ;;
    --target-sha256)
      TARGET_SHA256="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$RUN_ID" ]]; then
  echo "--run-id is required" >&2
  exit 2
fi

if [[ -z "$LOG_PATH" ]]; then
  echo "--log is required" >&2
  exit 2
fi

if [[ $# -eq 0 ]]; then
  echo "wrapped command is required after --" >&2
  exit 2
fi

if { [[ -n "$TARGET_PATH" ]] && [[ -z "$TARGET_SHA256" ]]; } || { [[ -z "$TARGET_PATH" ]] && [[ -n "$TARGET_SHA256" ]]; }; then
  echo "--target-path and --target-sha256 must be provided together" >&2
  exit 2
fi

if [[ -z "$COMMAND_CWD" ]]; then
  COMMAND_CWD="$(pwd -P)"
else
  if [[ ! -d "$COMMAND_CWD" ]]; then
    echo "--cwd does not exist or is not a directory: $COMMAND_CWD" >&2
    exit 2
  fi
  COMMAND_CWD="$(cd "$COMMAND_CWD" && pwd -P)"
fi

mkdir -p "$(dirname "$LOG_PATH")"
OUTPUT_TMP="$(mktemp)"
trap 'rm -f "$OUTPUT_TMP"' EXIT

quote_command() {
  local quoted=()
  local arg
  for arg in "$@"; do
    quoted+=("$(printf '%q' "$arg")")
  done
  local IFS=' '
  printf '%s\n' "${quoted[*]}"
}

COMMAND_TEXT="$(quote_command "$@")"
START_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "command_log_version=1"
  echo "command=${COMMAND_TEXT}"
  echo "cwd=${COMMAND_CWD}"
  echo "runId=${RUN_ID}"
  echo "start_utc=${START_UTC}"
  if [[ -n "$TARGET_PATH" ]]; then
    echo "target_path=${TARGET_PATH}"
    echo "target_sha256=${TARGET_SHA256}"
  fi
  echo "--- command output ---"
} > "$LOG_PATH"

set +e
(
  cd "$COMMAND_CWD" || exit 125
  "$@"
) > "$OUTPUT_TMP" 2>&1
EXIT_CODE=$?
set -e

if [[ -s "$OUTPUT_TMP" ]]; then
  cat "$OUTPUT_TMP" >> "$LOG_PATH"
else
  echo "[no stdout/stderr emitted]" >> "$LOG_PATH"
fi

END_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "--- command summary ---"
  echo "end_utc=${END_UTC}"
  echo "exit_code=${EXIT_CODE}"
  if [[ "$EXIT_CODE" -eq 0 ]]; then
    echo "result=PASS"
  else
    echo "result=FAIL"
  fi
} >> "$LOG_PATH"

exit "$EXIT_CODE"
