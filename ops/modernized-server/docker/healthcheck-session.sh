#!/bin/sh
set -eu

BASE_URL="${HEALTHCHECK_BASE_URL:-https://localhost:8443/openDolphin}"
FACILITY_ID="${HEALTHCHECK_FACILITY_ID:-1.3.6.1.4.1.9414.72.103}"
USER_ID="${HEALTHCHECK_USER_ID:-doctor1}"
PASSWORD="${HEALTHCHECK_PASSWORD:-doctor2025}"
CLIENT_UUID="${HEALTHCHECK_CLIENT_UUID:-container-healthcheck}"
ORIGIN="${HEALTHCHECK_ORIGIN:-$(printf '%s\n' "$BASE_URL" | sed 's#^\(https\?://[^/]*\).*$#\1#')}"
if [ "${HEALTHCHECK_TLS_INSECURE:-true}" = "true" ]; then
  CURL_TLS_ARGS="-k"
else
  CURL_TLS_ARGS=""
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

INDEX_HTML="$TMP_DIR/index.html"
COOKIE_JAR="$TMP_DIR/cookies.txt"
LOGIN_BODY="$TMP_DIR/login.json"
READY_BODY="$TMP_DIR/readiness.json"

curl -fssS $CURL_TLS_ARGS -c "$COOKIE_JAR" "$BASE_URL/" -o "$INDEX_HTML"

CSRF_TOKEN="$(
  sed -n 's/.*<meta name="csrf-token" content="\([^"]*\)".*/\1/p' "$INDEX_HTML" | head -n 1
)"
[ -n "$CSRF_TOKEN" ]

LOGIN_PAYLOAD=$(cat <<EOF
{"facilityId":"$FACILITY_ID","userId":"$USER_ID","password":"$PASSWORD","clientUuid":"$CLIENT_UUID"}
EOF
)

curl -fsS \
  $CURL_TLS_ARGS \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Origin: $ORIGIN" \
  -X POST \
  "$BASE_URL/api/session/login" \
  --data "$LOGIN_PAYLOAD" \
  -o "$LOGIN_BODY"

curl -fsS \
  $CURL_TLS_ARGS \
  -b "$COOKIE_JAR" \
  "$BASE_URL/api/health/readiness" \
  -o "$READY_BODY"

grep -q '"status":"UP"' "$READY_BODY"
