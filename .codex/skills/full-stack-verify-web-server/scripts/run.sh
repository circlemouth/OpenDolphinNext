#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"
mkdir -p tmp/full-stack-verify
REPORT="tmp/full-stack-verify-report.md"

run_cmd() {
  local name="$1"; shift
  local logfile="tmp/full-stack-verify/${name}.log"
  echo "### ${name}" >> "$REPORT"
  echo '```bash' >> "$REPORT"
  echo "$*" >> "$REPORT"
  echo '```' >> "$REPORT"
  if "$@" >"$logfile" 2>&1; then
    echo "- status: PASS" >> "$REPORT"
  else
    echo "- status: FAIL" >> "$REPORT"
    echo "- log: \
\`$logfile\`" >> "$REPORT"
  fi
  echo >> "$REPORT"
}

echo "# Full Stack Verify Report" > "$REPORT"
echo >> "$REPORT"

if [[ -d web-client ]]; then
  run_cmd "web-lint" bash -lc "cd web-client && npm run lint"
  run_cmd "web-typecheck" bash -lc "cd web-client && npm run typecheck"
  run_cmd "web-test" bash -lc "cd web-client && npm run test -- --runInBand"
  run_cmd "web-build" bash -lc "cd web-client && npm run build"
fi

if [[ -d server-modernized ]]; then
  run_cmd "server-test" bash -lc "cd server-modernized && ./gradlew test"
  run_cmd "server-build" bash -lc "cd server-modernized && ./gradlew build -x test"
  run_cmd "server-checkstyle" bash -lc "cd server-modernized && ./gradlew checkstyleMain checkstyleTest"
fi

echo "generated: $REPORT"
