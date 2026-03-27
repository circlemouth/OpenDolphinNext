#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-all}"

run_web() {
  echo "[ws9-guards] running web guards"
  (
    cd "${ROOT_DIR}/web-client"
    npm run verify:web-guard
  )
}

run_server() {
  echo "[ws9-guards] running server AsyncContext zero-hit guard"
  local hits
  hits="$(
    rg -n \
      -e 'AsyncContext' \
      -e 'addAsyncContext' \
      -e 'removeAsyncContext' \
      -e 'getAsyncContextList' \
      -e 'setAsyncContext' \
      "${ROOT_DIR}/server-modernized/src/main" \
      "${ROOT_DIR}/server-modernized/src/test" || true
  )"

  if [[ -n "${hits}" ]]; then
    echo "[ws9-guards] AsyncContext fallback drift detected:" >&2
    echo "${hits}" >&2
    return 2
  fi

  echo "[ws9-guards] AsyncContext fallback drift not detected"
}

case "${MODE}" in
  web)
    run_web
    ;;
  server)
    run_server
    ;;
  all)
    run_web
    run_server
    ;;
  *)
    echo "usage: $0 [web|server|all]" >&2
    exit 64
    ;;
esac
