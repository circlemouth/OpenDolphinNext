#!/usr/bin/env bash
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: run_logged.sh <id> <command...>" >&2
  exit 64
fi

RUN_ID="${RUN_ID:-20260421T224445Z}"
OUT_DIR="docs/implementation/unified-clinical-wave1-batch2-wo4-20260421"
LOG_DIR="${OUT_DIR}/command-logs"
mkdir -p "$LOG_DIR"

id="$1"
shift
cmd="$*"
log="${LOG_DIR}/${id}.log"
start="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cwd="$(pwd)"

{
  printf 'runId: %s\n' "$RUN_ID"
  printf 'cwd: %s\n' "$cwd"
  printf 'command: %s\n' "$cmd"
  printf 'start_utc: %s\n\n' "$start"
} > "$log"

bash -lc "$cmd" >> "$log" 2>&1
exit_code=$?
end="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ "$(wc -l < "$log" | tr -d ' ')" -le 5 ]; then
  printf 'output_summary: command produced no stdout/stderr before metadata trailer\n' >> "$log"
fi

{
  printf '\nend_utc: %s\n' "$end"
  printf 'exit_code: %s\n' "$exit_code"
} >> "$log"

node -e 'const fs=require("fs"); const [file,runId,cwd,id,cmd,start,end,code,log]=process.argv.slice(1); fs.appendFileSync(file, JSON.stringify({runId,cwd,id,command:cmd,start_utc:start,end_utc:end,exit_code:Number(code),log})+"\n");' \
  "${OUT_DIR}/command-log.jsonl" "$RUN_ID" "$cwd" "$id" "$cmd" "$start" "$end" "$exit_code" "$log"

exit "$exit_code"
