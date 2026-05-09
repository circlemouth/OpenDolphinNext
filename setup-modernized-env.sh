#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
#     → モダナイズ版サーバーは Docker で立ち上げつつ、Web クライアントはローカルの
#       npm run dev サーバーで起動します。
#   WEB_CLIENT_CODEX_BROWSER_COMPAT=1 WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
#     → Codex などのブラウザ自動化で localhost の IPv6-only 待受に詰まる場合の
#       互換起動です。Vite を 0.0.0.0 に bind し、表示される Open Web Client at
#       の URL からアクセスしてください。
#   WEB_CLIENT_MODE=docker ./setup-modernized-env.sh
#     → これまで通り Web クライアントも Docker コンテナとして立ち上げます。
#
# WEB_CLIENT_DEV_HOST / WEB_CLIENT_DEV_PORT で npm モードのホスト/ポートを調整し、
# WEB_CLIENT_DEV_LOG でログパス、VITE_* 系環境変数で Web クライアントの Vite 設定を
# 切り替えられます。Codex などのブラウザ自動化で localhost の IPv6-only 待受に
# 詰まる場合は WEB_CLIENT_CODEX_BROWSER_COMPAT=1 を指定すると、Vite を 0.0.0.0 に
# bind しつつアクセス URL は localhost として案内します。
#
# 注意（複数施設運用）:
# - 本スクリプトが起動時に与える ORCA_* は「起動時デフォルト（_default）」として扱われます。
# - 施設ごとに ORCA 接続先を分ける場合は、起動後に管理画面/API で各 facilityId の接続設定を
#   必ず登録してください（_default のみでは施設別に分かれません）。
# - 本スクリプトは server-modernized-dev を --force-recreate で再作成するため、
#   開発環境のデータ状態によっては再起動後に施設別設定を再投入する運用が必要です。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

normalize_base_path() {
  local raw="${1:-/}"
  if [[ -z "$raw" ]]; then
    raw="/"
  fi
  if [[ "$raw" != /* ]]; then
    raw="/$raw"
  fi
  while [[ "$raw" != "/" && "${raw: -1}" == "/" ]]; do
    raw="${raw%/}"
  done
  if [[ -z "$raw" ]]; then
    raw="/"
  fi
  printf '%s' "$raw"
}

is_truthy() {
  local raw="${1:-}"
  local normalized
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    1|true|yes|y|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

web_client_local_access_host() {
  local host="${1:-localhost}"
  case "$host" in
    0.0.0.0|::)
      printf 'localhost'
      ;;
    *)
      printf '%s' "$host"
      ;;
  esac
}

load_orca_env_file() {
  local env_file="${ORCA_ENV_FILE:-}"
  local repo_local="$SCRIPT_DIR/orca.env.local"
  local home_local=""
  if [[ -n "${HOME:-}" ]]; then
    home_local="$HOME/.config/opendolphin/orca.env"
  fi

  if [[ -n "$env_file" ]]; then
    if [[ ! -r "$env_file" ]]; then
      echo "ORCA_ENV_FILE is set but not readable: $env_file" >&2
      return 1
    fi
    log "Loading ORCA env from $env_file..."
    local had_allexport=0
    [[ "$-" == *a* ]] && had_allexport=1
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    if [[ "$had_allexport" != "1" ]]; then
      set +a
    fi
    return 0
  fi

  for candidate in "$repo_local" "$home_local"; do
    if [[ -r "$candidate" ]]; then
      log "Loading ORCA env from $candidate..."
      local had_allexport=0
      [[ "$-" == *a* ]] && had_allexport=1
      set -a
      # shellcheck disable=SC1090
      source "$candidate"
      if [[ "$had_allexport" != "1" ]]; then
        set +a
      fi
      return 0
    fi
  done

  log "Warning: ORCA env file not found. Looked for $repo_local${home_local:+ and $home_local}."
  return 0
}

ORCA_INFO_FILE="docs/operations/ORCA_CERTIFICATION_ONLY.md"
ORCA_CREDENTIAL_FILE="docs/operations/ORCA_CERTIFICATION_ONLY.md"
CUSTOM_PROP_TEMPLATE="ops/shared/docker/custom.properties"
CUSTOM_PROP_OUTPUT="custom.properties.dev"
COMPOSE_OVERRIDE_FILE="docker-compose.override.dev.yml"
LOCAL_SEED_FILE="ops/db/local-baseline/local_synthetic_seed.sql"
SCHEMA_DUMP_FILE_DEFAULT="artifacts/parity-manual/db-restore/20251120TbaselineGateZ1/legacy_schema_dump.sql"
SCHEMA_DUMP_FILE="${SCHEMA_DUMP_FILE:-$SCHEMA_DUMP_FILE_DEFAULT}"
DB_INIT_REPAIR_SQL_DEFAULT="ops/db/maintenance/modernized_db_init_repair.sql"
DB_INIT_REPAIR_SQL="${DB_INIT_REPAIR_SQL:-$DB_INIT_REPAIR_SQL_DEFAULT}"
DB_INIT_LOG_DIR="${DB_INIT_LOG_DIR:-artifacts/preprod/db-init}"
DB_INIT_RUN_ID="${DB_INIT_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
API_HEALTH_LOG_DIR="${API_HEALTH_LOG_DIR:-artifacts/preprod/api-health}"
FLYWAY_LOG_DIR="${FLYWAY_LOG_DIR:-artifacts/preprod/flyway}"
FLYWAY_MIGRATE_ON_BOOT="${FLYWAY_MIGRATE_ON_BOOT:-1}"
FLYWAY_OUT_OF_ORDER="${FLYWAY_OUT_OF_ORDER:-1}"
FLYWAY_REPAIR_ON_VALIDATION="${FLYWAY_REPAIR_ON_VALIDATION:-1}"
MODERNIZED_APP_HTTP_PORT="${MODERNIZED_APP_HTTP_PORT:-9080}"
export MODERNIZED_APP_HTTP_PORT
SERVER_HEALTH_URL="http://localhost:${MODERNIZED_APP_HTTP_PORT}/openDolphin/api/health"
API_HEALTH_BASE_URL="${API_HEALTH_BASE_URL:-http://localhost:${MODERNIZED_APP_HTTP_PORT}/openDolphin}"
WORKTREE_CONTAINER_SUFFIX="${WORKTREE_CONTAINER_SUFFIX:-}"
OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE="${OPENDOLPHIN_RUNTIME_PROFILE:-}"
OPENDOLPHIN_ENVIRONMENT_EFFECTIVE="${OPENDOLPHIN_ENVIRONMENT:-trial-local}"
OPENDOLPHIN_TIMEZONE_EFFECTIVE="${OPENDOLPHIN_TIMEZONE:-Asia/Tokyo}"
OPENDOLPHIN_CLOUD_ZERO_EFFECTIVE="${OPENDOLPHIN_CLOUD_ZERO:-false}"
SECURITY_TRUSTED_PROXIES_EFFECTIVE="${SECURITY_TRUSTED_PROXIES:-127.0.0.1/32,::1/128}"
MODERNIZED_DB_SSLMODE_EFFECTIVE="${MODERNIZED_DB_SSLMODE:-disable}"
MODERNIZED_DB_SSLROOTCERT_EFFECTIVE="${MODERNIZED_DB_SSLROOTCERT:-/dev/null}"
ATTACHMENT_STORAGE_MODE_EFFECTIVE="${ATTACHMENT_STORAGE_MODE:-s3}"
OBJECT_STORAGE_FREE_RUNTIME=0
OPENDOLPHIN_SCHEMA_ACTION="${OPENDOLPHIN_SCHEMA_ACTION:-create}"
export OPENDOLPHIN_SCHEMA_ACTION
SCHEMA_INITIALIZED=0
FLYWAY_APPLIED=0
DOCUMENT_INTEGRITY_KEYRING_HOST_PATH="${DOCUMENT_INTEGRITY_KEYRING_PATH:-}"
DOCUMENT_INTEGRITY_KEYRING_CONTAINER_PATH="/opt/jboss/wildfly/document-integrity-keyring.json"
DOCUMENT_INTEGRITY_KEYRING_SOURCE="env:DOCUMENT_INTEGRITY_KEYRING_PATH"

SMOKE_USER_ID="${DEV_SMOKE_USER_ID:-doctor1}"
SMOKE_USER_PASS="${DEV_SMOKE_USER_PASS:-doctor2025}"
SMOKE_USER_NAME="${DEV_SMOKE_USER_NAME:-Doctor One}"
SMOKE_USER_SIR_NAME="${DEV_SMOKE_SIR_NAME:-Takagi}"
SMOKE_USER_GIVEN_NAME="${DEV_SMOKE_GIVEN_NAME:-Kaoru}"
SMOKE_USER_EMAIL="${DEV_SMOKE_EMAIL:-doctor1@example.com}"
SMOKE_USER_PASS_CURRENT_HASH="${DEV_SMOKE_USER_PASSWORD_HASH:-pbkdf2_sha256_v1\$310000\$Iy73ehQDQ6j1pqxP7fpnpw==\$NQj7UL55NKB2QY+ojvhHxV+Cyr98koplDjaFo3ymyiE=}"
SMOKE_USER_PASS_SOURCE="default-dev-smoke-password"
FACILITY_ID="${OPENDOLPHIN_FACILITY_ID:-1.3.6.1.4.1.9414.72.103}"
SINGLE_FACILITY_MODE="${OPENDOLPHIN_SINGLE_FACILITY_MODE:-false}"
case "$(printf '%s' "$SINGLE_FACILITY_MODE" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|y|on)
    VITE_SINGLE_FACILITY_LOGIN_EFFECTIVE="${VITE_SINGLE_FACILITY_LOGIN:-1}"
    VITE_DEFAULT_FACILITY_ID_EFFECTIVE="${VITE_DEFAULT_FACILITY_ID:-$FACILITY_ID}"
    ;;
  *)
    VITE_SINGLE_FACILITY_LOGIN_EFFECTIVE="${VITE_SINGLE_FACILITY_LOGIN:-0}"
    VITE_DEFAULT_FACILITY_ID_EFFECTIVE="${VITE_DEFAULT_FACILITY_ID:-}"
    ;;
esac
SMOKE_PATIENT_ID="${DEV_SMOKE_PATIENT_ID:-0000001}"
SMOKE_PATIENT_FULL_NAME="${DEV_SMOKE_PATIENT_FULL_NAME:-スモーク 患者}"
SMOKE_PATIENT_FAMILY_NAME="${DEV_SMOKE_PATIENT_FAMILY_NAME:-スモーク}"
SMOKE_PATIENT_GIVEN_NAME="${DEV_SMOKE_PATIENT_GIVEN_NAME:-患者}"
SMOKE_PATIENT_KANA_NAME="${DEV_SMOKE_PATIENT_KANA_NAME:-スモーク カンジャ}"
SMOKE_PATIENT_KANA_FAMILY_NAME="${DEV_SMOKE_PATIENT_KANA_FAMILY_NAME:-スモーク}"
SMOKE_PATIENT_KANA_GIVEN_NAME="${DEV_SMOKE_PATIENT_KANA_GIVEN_NAME:-カンジャ}"

WEB_CLIENT_MODE="${WEB_CLIENT_MODE:-npm}"
WEB_CLIENT_CODEX_BROWSER_COMPAT="${WEB_CLIENT_CODEX_BROWSER_COMPAT:-${CODEX_BROWSER_COMPAT:-0}}"
if [[ -z "${WEB_CLIENT_DEV_HOST+x}" ]] && is_truthy "$WEB_CLIENT_CODEX_BROWSER_COMPAT"; then
  WEB_CLIENT_DEV_HOST="0.0.0.0"
else
  WEB_CLIENT_DEV_HOST="${WEB_CLIENT_DEV_HOST:-localhost}"
fi
WEB_CLIENT_DEV_PORT="${WEB_CLIENT_DEV_PORT:-5173}"
export WEB_CLIENT_DEV_PORT
WEB_CLIENT_DEV_LOG="${WEB_CLIENT_DEV_LOG:-tmp/web-client-dev.log}"
WEB_CLIENT_DEV_LOG_PATH="$WEB_CLIENT_DEV_LOG"
if [[ "${WEB_CLIENT_DEV_LOG_PATH}" != /* ]]; then
  WEB_CLIENT_DEV_LOG_PATH="$SCRIPT_DIR/$WEB_CLIENT_DEV_LOG_PATH"
fi
WEB_CLIENT_DEV_TMUX_SESSION="${WEB_CLIENT_DEV_TMUX_SESSION:-opendolphin-web-client-dev}"
SCHEMA_DUMP_PATH="$SCHEMA_DUMP_FILE"
if [[ "$SCHEMA_DUMP_PATH" != /* ]]; then
  SCHEMA_DUMP_PATH="$SCRIPT_DIR/$SCHEMA_DUMP_PATH"
fi
DB_INIT_REPAIR_SQL_PATH="$DB_INIT_REPAIR_SQL"
if [[ "$DB_INIT_REPAIR_SQL_PATH" != /* ]]; then
  DB_INIT_REPAIR_SQL_PATH="$SCRIPT_DIR/$DB_INIT_REPAIR_SQL_PATH"
fi
DB_INIT_LOG_DIR_PATH="$DB_INIT_LOG_DIR"
if [[ "$DB_INIT_LOG_DIR_PATH" != /* ]]; then
  DB_INIT_LOG_DIR_PATH="$SCRIPT_DIR/$DB_INIT_LOG_DIR_PATH"
fi
DB_INIT_LOG_FILE="$DB_INIT_LOG_DIR_PATH/db-init-${DB_INIT_RUN_ID}.log"
API_HEALTH_LOG_DIR_PATH="$API_HEALTH_LOG_DIR"
if [[ "$API_HEALTH_LOG_DIR_PATH" != /* ]]; then
  API_HEALTH_LOG_DIR_PATH="$SCRIPT_DIR/$API_HEALTH_LOG_DIR_PATH"
fi
API_HEALTH_LOG_FILE="$API_HEALTH_LOG_DIR_PATH/api-health-${DB_INIT_RUN_ID}.log"
FLYWAY_LOG_DIR_PATH="$FLYWAY_LOG_DIR"
if [[ "$FLYWAY_LOG_DIR_PATH" != /* ]]; then
  FLYWAY_LOG_DIR_PATH="$SCRIPT_DIR/$FLYWAY_LOG_DIR_PATH"
fi
FLYWAY_LOG_FILE="$FLYWAY_LOG_DIR_PATH/flyway-${DB_INIT_RUN_ID}.log"
WEB_CLIENT_DEV_PID_FILE="${WEB_CLIENT_DEV_PID_FILE:-tmp/web-client-dev.pid}"
WEB_CLIENT_DEV_PROXY_TARGET_RAW="${WEB_CLIENT_DEV_PROXY_TARGET:-}"
WEB_CLIENT_DEV_PROXY_TARGET_DEFAULT="http://localhost:${MODERNIZED_APP_HTTP_PORT}/openDolphin"
WEB_CLIENT_DOCKER_PROXY_TARGET_DEFAULT="http://host.docker.internal:${MODERNIZED_APP_HTTP_PORT}/openDolphin"
WEB_CLIENT_DEV_PROXY_TARGET="${WEB_CLIENT_DEV_PROXY_TARGET_RAW:-$WEB_CLIENT_DEV_PROXY_TARGET_DEFAULT}"
WEB_CLIENT_DEV_API_BASE="${WEB_CLIENT_DEV_API_BASE:-/api}"
# ENVs for npm dev server overrides
WEB_CLIENT_ENV_LOCAL="${WEB_CLIENT_ENV_LOCAL:-$SCRIPT_DIR/web-client/.env.local}"
# Normalize mode for bash versions without ${var,,}
WEB_CLIENT_MODE_LOWER="$(printf '%s' "$WEB_CLIENT_MODE" | tr '[:upper:]' '[:lower:]')"
VITE_BASE_PATH_NORMALIZED="$(normalize_base_path "${VITE_BASE_PATH:-/}")"
export VITE_BASE_PATH="$VITE_BASE_PATH_NORMALIZED"

if [[ -z "$WORKTREE_CONTAINER_SUFFIX" ]] && [[ "$SCRIPT_DIR" == *"/.worktrees/"* ]]; then
  WORKTREE_CONTAINER_SUFFIX="$(basename "$SCRIPT_DIR")"
fi
if [[ -n "$WORKTREE_CONTAINER_SUFFIX" ]]; then
  WORKTREE_CONTAINER_SUFFIX="$(printf '%s' "$WORKTREE_CONTAINER_SUFFIX" | tr -c '[:alnum:]-' '-')"
fi

container_name() {
  local base="$1"
  if [[ -n "$WORKTREE_CONTAINER_SUFFIX" ]]; then
    printf '%s-%s' "$base" "$WORKTREE_CONTAINER_SUFFIX"
    return
  fi
  printf '%s' "$base"
}

POSTGRES_CONTAINER_NAME="$(container_name opendolphin-postgres-modernized)"
SERVER_CONTAINER_NAME="$(container_name opendolphin-server-modernized-dev)"
MINIO_CONTAINER_NAME="$(container_name opendolphin-minio)"
ORCA_DB_CONTAINER_NAME="${ORCA_DB_CONTAINER_NAME:-jma-receipt-docker-db-1}"
ORCA_DB_HOST="${ORCA_DB_HOST:-$ORCA_DB_CONTAINER_NAME}"
ORCA_DB_PORT="${ORCA_DB_PORT:-5432}"
ORCA_DB_NAME="${ORCA_DB_NAME:-orca}"
ORCA_DB_USER="${ORCA_DB_USER:-orca}"
ORCA_DB_PASSWORD="${ORCA_DB_PASSWORD:-orca_password}"
ORCA_DB_SSLMODE="${ORCA_DB_SSLMODE:-disable&currentSchema=master,public}"
ORCA_DB_SSLROOTCERT="${ORCA_DB_SSLROOTCERT:-}"
DB_REPAIR_APPLIED=0
SEARCH_PATH_FIXED=0

log() {
  echo "[$(date +%H:%M:%S)] $*"
}

load_orca_env_file

is_truthy() {
  local value="${1:-}"
  case "$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

LEGACY_HEADER_AUTH_FALLBACK_DEFAULT=1
if [[ -n "${LOGFILTER_HEADER_AUTH_ENABLED:-}" ]] && ! is_truthy "${LOGFILTER_HEADER_AUTH_ENABLED}"; then
  # LogFilter のヘッダ認証を無効化している場合は、Legacy へのフォールバックを既定で抑止する。
  LEGACY_HEADER_AUTH_FALLBACK_DEFAULT=0
fi

is_local_orca_host() {
  local host="${1:-}"
  if [[ -z "$host" ]]; then
    return 1
  fi
  local normalized
  normalized="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    localhost|127.0.0.1|::1|host.docker.internal)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

mask_state() {
  local user="${1:-}"
  local pass="${2:-}"
  if [[ -n "$user" && -n "$pass" ]]; then
    printf 'set'
  else
    printf 'unset'
  fi
}

has_forbidden_object_storage_value() {
  local value="${1:-}"
  [[ -n "$value" ]]
}

resolve_object_storage_runtime_profile() {
  local profile_lc
  profile_lc="$(printf '%s' "${OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE:-}" | tr '[:upper:]' '[:lower:]')"
  local storage_mode_lc
  storage_mode_lc="$(printf '%s' "${ATTACHMENT_STORAGE_MODE_EFFECTIVE:-}" | tr '[:upper:]' '[:lower:]')"

  if [[ "$profile_lc" == "orca-trial-no-object-storage" ]]; then
    ATTACHMENT_STORAGE_MODE_EFFECTIVE="disabled"
    storage_mode_lc="disabled"
  fi

  if [[ "$storage_mode_lc" == "disabled" ]]; then
    OBJECT_STORAGE_FREE_RUNTIME=1
    OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE="${OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE:-orca-trial-no-object-storage}"
    if [[ -z "${OPENDOLPHIN_ENVIRONMENT:-}" ]]; then
      OPENDOLPHIN_ENVIRONMENT_EFFECTIVE="trial-local"
    fi

    local forbidden_keys=()
    for key in \
      ATTACHMENT_STORAGE_S3_BUCKET \
      ATTACHMENT_STORAGE_S3_REGION \
      ATTACHMENT_STORAGE_S3_ENDPOINT \
      ATTACHMENT_STORAGE_S3_BASE_PATH \
      ATTACHMENT_STORAGE_S3_FORCE_PATH_STYLE \
      ATTACHMENT_STORAGE_S3_SERVER_SIDE_ENCRYPTION \
      ATTACHMENT_STORAGE_S3_KMS_KEY_ID \
      ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB \
      ATTACHMENT_STORAGE_S3_ACCESS_KEY \
      ATTACHMENT_STORAGE_S3_SECRET_KEY \
      PHR_EXPORT_S3_BUCKET \
      PHR_EXPORT_S3_REGION \
      PHR_EXPORT_S3_PREFIX \
      PHR_EXPORT_S3_ENDPOINT \
      PHR_EXPORT_S3_FORCE_PATH_STYLE \
      PHR_EXPORT_S3_ACCESS_KEY \
      PHR_EXPORT_S3_SECRET_KEY \
      PHR_EXPORT_STORAGE_TYPE \
      PHR_EXPORT_STORAGE_FILESYSTEM_BASE_PATH \
      MINIO_ROOT_USER \
      MINIO_ROOT_PASSWORD; do
      if has_forbidden_object_storage_value "${!key:-}"; then
        forbidden_keys+=("$key")
      fi
    done
    if [[ "${#forbidden_keys[@]}" -gt 0 ]]; then
      echo "Object-storage-free runtime rejected: object-storage variables are configured (${forbidden_keys[*]}). Unset them or use ATTACHMENT_STORAGE_MODE=s3." >&2
      exit 1
    fi
    log "RUNTIME_PROFILE object_storage=disabled profile=${OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE} environment=${OPENDOLPHIN_ENVIRONMENT_EFFECTIVE}"
    return
  fi

  log "RUNTIME_PROFILE object_storage=s3 profile=${OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE:-default} environment=${OPENDOLPHIN_ENVIRONMENT_EFFECTIVE}"
}

generate_local_secret_b64() {
  openssl rand -base64 32 | tr -d '\n'
}

resolve_dev_object_storage_credentials() {
  if [[ "$OBJECT_STORAGE_FREE_RUNTIME" == "1" ]]; then
    return
  fi

  local minio_secret_source="env"
  if [[ -z "${MINIO_ROOT_PASSWORD:-}" ]]; then
    MINIO_ROOT_PASSWORD="$(generate_local_secret_b64)"
    minio_secret_source="generated-local-process"
  fi
  MINIO_ROOT_USER="${MINIO_ROOT_USER:-opendolphin}"
  ATTACHMENT_STORAGE_S3_ACCESS_KEY="${ATTACHMENT_STORAGE_S3_ACCESS_KEY:-$MINIO_ROOT_USER}"
  ATTACHMENT_STORAGE_S3_SECRET_KEY="${ATTACHMENT_STORAGE_S3_SECRET_KEY:-$MINIO_ROOT_PASSWORD}"
  PHR_EXPORT_S3_ACCESS_KEY="${PHR_EXPORT_S3_ACCESS_KEY:-$MINIO_ROOT_USER}"
  PHR_EXPORT_S3_SECRET_KEY="${PHR_EXPORT_S3_SECRET_KEY:-$MINIO_ROOT_PASSWORD}"

  export MINIO_ROOT_USER
  export MINIO_ROOT_PASSWORD
  export ATTACHMENT_STORAGE_S3_ACCESS_KEY
  export ATTACHMENT_STORAGE_S3_SECRET_KEY
  export PHR_EXPORT_S3_ACCESS_KEY
  export PHR_EXPORT_S3_SECRET_KEY

  log "Object storage credentials source=${minio_secret_source} minio_root=$(mask_state "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD") attachment_s3=$(mask_state "$ATTACHMENT_STORAGE_S3_ACCESS_KEY" "$ATTACHMENT_STORAGE_S3_SECRET_KEY") phr_s3=$(mask_state "$PHR_EXPORT_S3_ACCESS_KEY" "$PHR_EXPORT_S3_SECRET_KEY")"
}

resolve_proxy_auth_env() {
  ORCA_PROXY_CERT_PATH="${ORCA_CERT_PATH:-${ORCA_PROD_CERT_PATH:-${ORCA_PROD_CERT:-}}}"
  ORCA_PROXY_CERT_PASS="${ORCA_CERT_PASS:-${ORCA_PROD_CERT_PASS:-}}"
  ORCA_PROXY_BASIC_USER="${ORCA_BASIC_USER:-${ORCA_PROD_BASIC_USER:-${ORCA_API_USER:-}}}"
  ORCA_PROXY_BASIC_PASSWORD="${ORCA_BASIC_PASSWORD:-${ORCA_BASIC_KEY:-${ORCA_PROD_BASIC_KEY:-${ORCA_API_PASSWORD:-}}}}"
}

has_modernized_table() {
  local table_name="$1"
  docker exec "${POSTGRES_CONTAINER_NAME}" \
    psql -U opendolphin -d opendolphin_modern -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_name='${table_name}' AND table_schema IN ('opendolphin','public') LIMIT 1;" \
    | tr -d '[:space:]'
}

read_orca_info() {
  local file_scheme="" file_host="" file_port="" file_user="" file_pass=""
  local regex_auth='Basic auth:[[:space:]]*``([^`]*)``[[:space:]]*/[[:space:]]*``([^`]*)``'

  if [[ -f "$ORCA_INFO_FILE" ]]; then
    log "Reading ORCA connection info from $ORCA_INFO_FILE..."
    local base_url
    base_url="$(grep -Eo 'https?://[^` ]+' "$ORCA_INFO_FILE" | head -n 1 || true)"
    if [[ -n "$base_url" && "$base_url" =~ ^(https?)://([^/:]+)(:([0-9]+))? ]]; then
      file_scheme="${BASH_REMATCH[1]}"
      file_host="${BASH_REMATCH[2]}"
      file_port="${BASH_REMATCH[4]}"
      if [[ -z "$file_port" ]]; then
        if [[ "$file_scheme" == "https" ]]; then
          file_port="443"
        else
          file_port="80"
        fi
      fi
    fi

    if [[ -z "$file_user" || -z "$file_pass" ]]; then
      local info_content
      info_content="$(<"$ORCA_INFO_FILE")"
      if [[ $info_content =~ $regex_auth ]]; then
        file_user="${BASH_REMATCH[1]}"
        file_pass="${BASH_REMATCH[2]}"
      fi
    fi

    if [[ -z "$file_user" || -z "$file_pass" ]]; then
      local table_user="" table_pass=""
      table_user="$(awk -F'`' '/\|[[:space:]]*Basic ユーザー名[[:space:]]*\|/ {print $2; exit}' "$ORCA_INFO_FILE")"
      table_pass="$(awk -F'`' '/\|[[:space:]]*Basic パスワード[[:space:]]*\|/ {print $2; exit}' "$ORCA_INFO_FILE")"
      if [[ -z "$file_user" && -n "$table_user" ]]; then
        file_user="$table_user"
      fi
      if [[ -z "$file_pass" && -n "$table_pass" ]]; then
        file_pass="$table_pass"
      fi
    fi
  else
    log "Warning: ORCA info file not found ($ORCA_INFO_FILE)"
  fi

  if [[ -f "$ORCA_CREDENTIAL_FILE" ]]; then
    local content
    content="$(<"$ORCA_CREDENTIAL_FILE")"
    if [[ $content =~ $regex_auth ]]; then
      file_user="${BASH_REMATCH[1]}"
      file_pass="${BASH_REMATCH[2]}"
    fi
  else
    log "Warning: ORCA credential file not found ($ORCA_CREDENTIAL_FILE)"
  fi

  # Trial endpoint and credentials must come from env or the local certification-only secret file.
  local fallback_port="${ORCA_API_PORT_FALLBACK:-443}"
  local allow_port_8000="${ORCA_API_PORT_ALLOW_8000:-0}"
  local allow_port_8000_normalized="0"
  local port_replaced="false"
  local port_source_original=""
  local port_original=""

  ORCA_TARGET_ENV="${ORCA_TARGET_ENV:-${ORCA_ENV:-}}"
  if [[ -n "$ORCA_TARGET_ENV" ]]; then
    ORCA_TARGET_ENV="$(printf '%s' "$ORCA_TARGET_ENV" | tr '[:upper:]' '[:lower:]')"
  fi

  ORCA_API_SCHEME_SOURCE="default"
  if [[ -n "${ORCA_API_SCHEME:-}" ]]; then
    ORCA_API_SCHEME="${ORCA_API_SCHEME}"
    ORCA_API_SCHEME_SOURCE="env:ORCA_API_SCHEME"
  elif [[ -n "$file_scheme" ]]; then
    ORCA_API_SCHEME="$file_scheme"
    ORCA_API_SCHEME_SOURCE="file:ORCA_CERTIFICATION_ONLY"
  else
    ORCA_API_SCHEME="http"
  fi

  ORCA_API_HOST_SOURCE="default"
  if [[ -n "${ORCA_API_HOST:-}" ]]; then
    ORCA_API_HOST="${ORCA_API_HOST}"
    ORCA_API_HOST_SOURCE="env:ORCA_API_HOST"
  elif [[ -n "${ORCA_HOST:-}" ]]; then
    ORCA_API_HOST="${ORCA_HOST}"
    ORCA_API_HOST_SOURCE="env:ORCA_HOST"
  elif [[ -n "$file_host" ]]; then
    ORCA_API_HOST="$file_host"
    ORCA_API_HOST_SOURCE="file:ORCA_CERTIFICATION_ONLY"
  else
    ORCA_API_HOST="localhost"
    ORCA_API_HOST_SOURCE="default:localhost"
  fi

  ORCA_API_PORT_SOURCE="default"
  if [[ -n "${ORCA_API_PORT:-}" ]]; then
    ORCA_API_PORT="${ORCA_API_PORT}"
    ORCA_API_PORT_SOURCE="env:ORCA_API_PORT"
  elif [[ -n "${ORCA_PORT:-}" ]]; then
    ORCA_API_PORT="${ORCA_PORT}"
    ORCA_API_PORT_SOURCE="env:ORCA_PORT"
  elif [[ -n "$file_port" ]]; then
    ORCA_API_PORT="$file_port"
    ORCA_API_PORT_SOURCE="file:ORCA_CERTIFICATION_ONLY"
  else
    ORCA_API_PORT="$fallback_port"
    ORCA_API_PORT_SOURCE="default:fallback"
  fi

  if is_truthy "$allow_port_8000"; then
    allow_port_8000_normalized="1"
  fi

  port_original="$ORCA_API_PORT"
  port_source_original="$ORCA_API_PORT_SOURCE"
  if [[ "$ORCA_API_PORT" == "8000" && "$allow_port_8000_normalized" != "1" ]]; then
    ORCA_API_PORT="$fallback_port"
    ORCA_API_PORT_SOURCE="policy:block_8000"
    port_replaced="true"
  fi

  ORCA_API_USER_SOURCE="default"
  if [[ -n "${ORCA_API_USER:-}" ]]; then
    ORCA_API_USER="${ORCA_API_USER}"
    ORCA_API_USER_SOURCE="env:ORCA_API_USER"
  elif [[ -n "${ORCA_USER:-}" ]]; then
    ORCA_API_USER="${ORCA_USER}"
    ORCA_API_USER_SOURCE="env:ORCA_USER"
  elif [[ -n "$file_user" ]]; then
    ORCA_API_USER="$file_user"
    ORCA_API_USER_SOURCE="file:ORCA_CERTIFICATION_ONLY"
  else
    ORCA_API_USER=""
    ORCA_API_USER_SOURCE="unset"
  fi

  ORCA_API_PASSWORD_SOURCE="default"
  if [[ -n "${ORCA_API_PASSWORD:-}" ]]; then
    ORCA_API_PASSWORD="${ORCA_API_PASSWORD}"
    ORCA_API_PASSWORD_SOURCE="env:ORCA_API_PASSWORD"
  elif [[ -n "${ORCA_PASS:-}" ]]; then
    ORCA_API_PASSWORD="${ORCA_PASS}"
    ORCA_API_PASSWORD_SOURCE="env:ORCA_PASS"
  elif [[ -n "$file_pass" ]]; then
    ORCA_API_PASSWORD="$file_pass"
    ORCA_API_PASSWORD_SOURCE="file:ORCA_CERTIFICATION_ONLY"
  else
    ORCA_API_PASSWORD=""
    ORCA_API_PASSWORD_SOURCE="unset"
  fi

  if [[ ! "$ORCA_API_PORT" =~ ^[0-9]+$ ]]; then
    echo "Invalid ORCA API port: $ORCA_API_PORT" >&2
    exit 1
  fi

  ORCA_MODE_SOURCE="default"
  if [[ -n "${ORCA_MODE:-}" ]]; then
    ORCA_MODE_SOURCE="env:ORCA_MODE"
  elif is_truthy "${ORCA_API_WEBORCA:-}"; then
    ORCA_MODE="weborca"
    ORCA_MODE_SOURCE="env:ORCA_API_WEBORCA"
  else
    ORCA_MODE="onprem"
  fi

  if [[ "$ORCA_MODE_SOURCE" == "default" ]] && ! is_local_orca_host "$ORCA_API_HOST"; then
    local host_lc
    host_lc="$(printf '%s' "$ORCA_API_HOST" | tr '[:upper:]' '[:lower:]')"
    if [[ "$host_lc" == *weborca* ]]; then
      ORCA_MODE="weborca"
      ORCA_MODE_SOURCE="auto:weborca-host"
    else
      echo "ORCA_MODE is required when ORCA_API_HOST is not local. Set ORCA_MODE=weborca or ORCA_MODE=onprem (or ORCA_API_WEBORCA=1)." >&2
      exit 1
    fi
  fi

  if [[ "$ORCA_MODE" == "weborca" && "$ORCA_API_SCHEME_SOURCE" == "default" ]]; then
    ORCA_API_SCHEME="https"
    ORCA_API_SCHEME_SOURCE="computed:weborca"
  fi

  ORCA_BASE_URL_SOURCE="computed"
  if [[ -n "${ORCA_BASE_URL:-}" ]]; then
    ORCA_BASE_URL_SOURCE="env:ORCA_BASE_URL"
  else
    local base="${ORCA_API_SCHEME}://${ORCA_API_HOST}"
    if [[ "$ORCA_API_PORT" != "80" && "$ORCA_API_PORT" != "443" ]]; then
      base="${base}:${ORCA_API_PORT}"
    fi
    ORCA_BASE_URL="$base"
  fi

  if [[ -n "${ORCA_BASE_URL:-}" ]]; then
    local base_path=""
    if [[ "$ORCA_BASE_URL" =~ ^https?://[^/]+(/.*)$ ]]; then
      base_path="${BASH_REMATCH[1]}"
    fi
    if [[ -n "$base_path" && "$base_path" != "/" ]]; then
      base_path="${base_path%/}"
      if [[ "$base_path" == "/api" || "$base_path" == /api/* ]]; then
        local prefix_raw="${ORCA_API_PATH_PREFIX:-}"
        local prefix_norm="$prefix_raw"
        if [[ -n "$prefix_norm" ]]; then
          if [[ "$prefix_norm" != /* ]]; then
            prefix_norm="/$prefix_norm"
          fi
          prefix_norm="${prefix_norm%/}"
        fi
        if [[ -z "$prefix_raw" ]]; then
          ORCA_API_PATH_PREFIX="off"
          log "ORCA_CONFIG guard: base_url includes /api; ORCA_API_PATH_PREFIX=off to avoid double /api."
        elif [[ "$prefix_norm" == "/api" ]]; then
          ORCA_API_PATH_PREFIX="off"
          log "ORCA_CONFIG guard: base_url includes /api and path_prefix=/api; disabling path_prefix to avoid double /api."
        fi
      fi
    fi
  fi

  resolve_proxy_auth_env
  ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH="${ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH:-true}"

  log "ORCA_CONFIG target_env=${ORCA_TARGET_ENV:-unset} base_url=${ORCA_BASE_URL} mode=${ORCA_MODE} path_prefix=${ORCA_API_PATH_PREFIX:-auto}"
  log "ORCA_CONFIG source host=${ORCA_API_HOST_SOURCE} port=${ORCA_API_PORT_SOURCE} scheme=${ORCA_API_SCHEME_SOURCE} base_url=${ORCA_BASE_URL_SOURCE} mode=${ORCA_MODE_SOURCE}"
  log "ORCA_CONFIG port policy=block_8000 allow_8000=${allow_port_8000_normalized} fallback=${fallback_port} replaced=${port_replaced} original_port=${port_original} original_source=${port_source_original}"
  log "ORCA_CONFIG auth server_basic=$(mask_state "${ORCA_API_USER:-}" "${ORCA_API_PASSWORD:-}") web_proxy_basic=$(mask_state "${ORCA_PROXY_BASIC_USER:-}" "${ORCA_PROXY_BASIC_PASSWORD:-}") web_proxy_cert=$(mask_state "${ORCA_PROXY_CERT_PATH:-}" "${ORCA_PROXY_CERT_PASS:-}")"
  log "ORCA_CONFIG acceptmod_suppress_acceptance_push=${ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH}"
  log "ORCA_CONFIG note multi-facility: ORCA_* is startup default (_default); register per-facility ORCA settings after boot when using multiple facilities."

  if [[ "$ORCA_TARGET_ENV" =~ ^(preprod|prod)$ ]]; then
    if [[ "$ORCA_BASE_URL_SOURCE" != env:* && "$ORCA_API_HOST_SOURCE" != env:* ]]; then
      echo "ORCA_TARGET_ENV=${ORCA_TARGET_ENV} requires explicit ORCA_BASE_URL or ORCA_API_HOST env." >&2
      exit 1
    fi
  fi
}

resolve_dev_admin_credentials() {
  if [[ -n "${DEV_SMOKE_USER_PASSWORD_HASH:-}" ]]; then
    SMOKE_USER_PASS_SOURCE="env:DEV_SMOKE_USER_PASSWORD_HASH"
  elif [[ -n "${DEV_SMOKE_USER_PASS:-}" ]]; then
    if [[ "$SMOKE_USER_PASS" == "doctor2025" ]]; then
      SMOKE_USER_PASS_SOURCE="env:DEV_SMOKE_USER_PASS(default-dev-smoke-password)"
    else
      echo "DEV_SMOKE_USER_PASS is set to a non-default value, but setup-modernized-env.sh no longer generates legacy hashes." >&2
      echo "Provide DEV_SMOKE_USER_PASSWORD_HASH with pbkdf2_sha256_v1 format instead." >&2
      exit 1
    fi
  fi
  log "SMOKE_USER account=${SMOKE_USER_ID} facility=${FACILITY_ID} pass_source=${SMOKE_USER_PASS_SOURCE}"
}

generate_document_integrity_keyring() {
  if [[ -z "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH" ]]; then
    DOCUMENT_INTEGRITY_KEYRING_HOST_PATH="$SCRIPT_DIR/tmp/document-integrity-keyring.local.json"
    DOCUMENT_INTEGRITY_KEYRING_SOURCE="generated-local-ignored"
  fi
  if [[ "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH" != /* ]]; then
    DOCUMENT_INTEGRITY_KEYRING_HOST_PATH="$SCRIPT_DIR/$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH"
  fi
  if [[ ! -d "$(dirname "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH")" ]]; then
    if [[ "$DOCUMENT_INTEGRITY_KEYRING_SOURCE" == "generated-local-ignored" ]]; then
      mkdir -p "$(dirname "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH")"
    else
      echo "DOCUMENT_INTEGRITY_KEYRING_PATH parent directory is not readable." >&2
      exit 1
    fi
  fi
  DOCUMENT_INTEGRITY_KEYRING_HOST_PATH="$(cd "$(dirname "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH")" && pwd)/$(basename "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH")"

  if [[ -f "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH" ]]; then
    chmod 600 "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH" 2>/dev/null || true
    log "Document integrity keyring source=${DOCUMENT_INTEGRITY_KEYRING_SOURCE} path_class=local-file"
    return 0
  fi

  if [[ "$DOCUMENT_INTEGRITY_KEYRING_SOURCE" != "generated-local-ignored" ]]; then
    echo "DOCUMENT_INTEGRITY_KEYRING_PATH is set but does not point to a readable file." >&2
    exit 1
  fi

  local raw_key_b64
  if command -v openssl >/dev/null 2>&1; then
    raw_key_b64="$(openssl rand -base64 32)"
  else
    raw_key_b64="$(LC_ALL=C head -c 32 /dev/urandom | base64)"
  fi
  local old_umask
  old_umask="$(umask)"
  umask 077
  printf '{\n  "algorithm": "HMAC-SHA256",\n  "keys": [\n    {"keyId": "dev-local-%s", "status": "active", "hmacKeyB64": "%s"}\n  ]\n}\n' \
    "$DB_INIT_RUN_ID" "$raw_key_b64" > "$DOCUMENT_INTEGRITY_KEYRING_HOST_PATH"
  umask "$old_umask"
  unset raw_key_b64
  log "Document integrity keyring source=${DOCUMENT_INTEGRITY_KEYRING_SOURCE} path_class=local-ignored-file"
}

generate_custom_properties() {
  log "Generating $CUSTOM_PROP_OUTPUT from $CUSTOM_PROP_TEMPLATE..."
  if [[ ! -f "$CUSTOM_PROP_TEMPLATE" ]]; then
    echo "Template not found: $CUSTOM_PROP_TEMPLATE" >&2
    exit 1
  fi

  local sed_args=(
    -e "s/^orca\\.orcaapi\\.ip=.*/orca.orcaapi.ip=${ORCA_API_HOST}/"
    -e "s/^orca\\.orcaapi\\.port=.*/orca.orcaapi.port=${ORCA_API_PORT}/"
  )
  if [[ -n "${ORCA_API_USER:-}" ]]; then
    sed_args+=(-e "s/^orca\\.id=.*/orca.id=${ORCA_API_USER}/")
  fi
  if [[ -n "${ORCA_API_PASSWORD:-}" ]]; then
    sed_args+=(-e "s/^orca\\.password=.*/orca.password=${ORCA_API_PASSWORD}/")
  fi

  sed "${sed_args[@]}" "$CUSTOM_PROP_TEMPLATE" > "$CUSTOM_PROP_OUTPUT"
  log "custom.properties written to $CUSTOM_PROP_OUTPUT"
}

generate_compose_override() {
  log "Generating $COMPOSE_OVERRIDE_FILE..."
  log "ORCADS route host=${ORCA_DB_HOST} port=${ORCA_DB_PORT} db=${ORCA_DB_NAME} user=${ORCA_DB_USER} sslmode=${ORCA_DB_SSLMODE}"
  local storage_env_block=""
  local minio_env_block=""
  local minio_mc_env_block=""
  if [[ "$OBJECT_STORAGE_FREE_RUNTIME" == "1" ]]; then
    storage_env_block="      OPENDOLPHIN_RUNTIME_PROFILE: ${OPENDOLPHIN_RUNTIME_PROFILE_EFFECTIVE}
      ATTACHMENT_STORAGE_MODE: disabled
      ATTACHMENT_STORAGE_S3_BUCKET: ''
      ATTACHMENT_STORAGE_S3_REGION: ''
      ATTACHMENT_STORAGE_S3_ENDPOINT: ''
      ATTACHMENT_STORAGE_S3_BASE_PATH: ''
      ATTACHMENT_STORAGE_S3_FORCE_PATH_STYLE: ''
      ATTACHMENT_STORAGE_S3_SERVER_SIDE_ENCRYPTION: ''
      ATTACHMENT_STORAGE_S3_KMS_KEY_ID: ''
      ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB: ''
      ATTACHMENT_STORAGE_S3_ACCESS_KEY: ''
      ATTACHMENT_STORAGE_S3_SECRET_KEY: ''
      PHR_EXPORT_STORAGE_TYPE: disabled
      PHR_EXPORT_SIGNING_SECRET: ''
      PHR_EXPORT_S3_BUCKET: ''
      PHR_EXPORT_S3_REGION: ''
      PHR_EXPORT_S3_PREFIX: ''
      PHR_EXPORT_S3_ENDPOINT: ''
      PHR_EXPORT_S3_FORCE_PATH_STYLE: ''
      PHR_EXPORT_S3_ACCESS_KEY: ''
      PHR_EXPORT_S3_SECRET_KEY: ''"
  else
    storage_env_block="      ATTACHMENT_STORAGE_S3_ACCESS_KEY: ${ATTACHMENT_STORAGE_S3_ACCESS_KEY}
      ATTACHMENT_STORAGE_S3_SECRET_KEY: ${ATTACHMENT_STORAGE_S3_SECRET_KEY}
      PHR_EXPORT_S3_ACCESS_KEY: ${PHR_EXPORT_S3_ACCESS_KEY}
      PHR_EXPORT_S3_SECRET_KEY: ${PHR_EXPORT_S3_SECRET_KEY}"
    minio_env_block="    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}"
    minio_mc_env_block="  minio-mc:
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}"
  fi
  cat > "$COMPOSE_OVERRIDE_FILE" <<EOF
services:
  server-modernized-dev:
    container_name: ${SERVER_CONTAINER_NAME}
    environment:
      OPENDOLPHIN_ENVIRONMENT: ${OPENDOLPHIN_ENVIRONMENT_EFFECTIVE}
      OPENDOLPHIN_TIMEZONE: ${OPENDOLPHIN_TIMEZONE_EFFECTIVE}
      OPENDOLPHIN_CLOUD_ZERO: ${OPENDOLPHIN_CLOUD_ZERO_EFFECTIVE}
      SECURITY_TRUSTED_PROXIES: ${SECURITY_TRUSTED_PROXIES_EFFECTIVE}
      DB_SSLMODE: ${MODERNIZED_DB_SSLMODE_EFFECTIVE}
      DB_SSLROOTCERT: ${MODERNIZED_DB_SSLROOTCERT_EFFECTIVE}
      OPENDOLPHIN_FACILITY_ID: ${FACILITY_ID}
      OPENDOLPHIN_SINGLE_FACILITY_MODE: ${SINGLE_FACILITY_MODE}
      OPENDOLPHIN_STUB_ENDPOINTS_MODE: ${OPENDOLPHIN_STUB_ENDPOINTS_MODE:-block}
${storage_env_block}
      ORCA_API_HOST: ${ORCA_API_HOST}
      ORCA_API_PORT: ${ORCA_API_PORT}
      ORCA_API_SCHEME: ${ORCA_API_SCHEME}
      ORCA_API_USER: ${ORCA_API_USER:-}
      ORCA_API_PASSWORD: ${ORCA_API_PASSWORD:-}
      ORCA_BASE_URL: ''
      ORCA_MODE: ${ORCA_MODE}
      ORCA_CREDENTIALS_AES_KEY_B64: ${ORCA_CREDENTIALS_AES_KEY_B64:?ORCA_CREDENTIALS_AES_KEY_B64 is required}
      ORCA_API_PATH_PREFIX: ${ORCA_API_PATH_PREFIX:-}
      ORCA_API_WEBORCA: ${ORCA_API_WEBORCA:-}
      ORCA_API_RETRY_MAX: ${ORCA_API_RETRY_MAX:-}
      ORCA_API_RETRY_BACKOFF_MS: ${ORCA_API_RETRY_BACKOFF_MS:-}
      ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH: ${ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH:-true}
      ORCA_DB_HOST: ${ORCA_DB_HOST}
      ORCA_DB_PORT: ${ORCA_DB_PORT}
      ORCA_DB_NAME: ${ORCA_DB_NAME}
      ORCA_DB_USER: ${ORCA_DB_USER}
      ORCA_DB_PASSWORD: ${ORCA_DB_PASSWORD}
      ORCA_DB_SSLMODE: ${ORCA_DB_SSLMODE}
      ORCA_DB_SSLROOTCERT: ${ORCA_DB_SSLROOTCERT}
      DOCUMENT_INTEGRITY_MODE: enforce
      DOCUMENT_INTEGRITY_KEYRING_PATH: ${DOCUMENT_INTEGRITY_KEYRING_CONTAINER_PATH}
      OPENDOLPHIN_SCHEMA_ACTION: ${OPENDOLPHIN_SCHEMA_ACTION}
      JAVA_OPTS_APPEND: \${JAVA_OPTS_APPEND:-} -Dhibernate.hbm2ddl.auto=${OPENDOLPHIN_SCHEMA_ACTION} -Djakarta.persistence.schema-generation.database.action=${OPENDOLPHIN_SCHEMA_ACTION} -Dmicrometer.export.otlp.enabled=false -Dio.micrometer.export.otlp.enabled=false -Dotlp.enabled=false -Dotel.metrics.exporter=none -Dotel.sdk.disabled=true
    volumes:
      - ./$(basename "$CUSTOM_PROP_OUTPUT"):/opt/jboss/wildfly/custom.properties
      - ${DOCUMENT_INTEGRITY_KEYRING_HOST_PATH}:${DOCUMENT_INTEGRITY_KEYRING_CONTAINER_PATH}:ro
    healthcheck:
      test: ["CMD-SHELL", "/opt/jboss/healthcheck-session.sh"]
      interval: 30s
      timeout: 10s
      retries: 5
  db-modernized:
    container_name: ${POSTGRES_CONTAINER_NAME}
  minio:
    container_name: ${MINIO_CONTAINER_NAME}
${minio_env_block}
${minio_mc_env_block}
EOF
  log "docker-compose override written to $COMPOSE_OVERRIDE_FILE"
}

start_modernized_server() {
  log "Starting Modernized Server..."
  if [[ "$OBJECT_STORAGE_FREE_RUNTIME" != "1" ]]; then
    docker compose -f docker-compose.modernized.dev.yml -f "$COMPOSE_OVERRIDE_FILE" --profile object-storage up -d --build --force-recreate
    return
  fi
  docker compose -f docker-compose.modernized.dev.yml -f "$COMPOSE_OVERRIDE_FILE" up -d --build --force-recreate
}

ensure_orca_db_bridge() {
  if ! docker ps -a --format '{{.Names}}' | grep -Fx "$ORCA_DB_CONTAINER_NAME" >/dev/null 2>&1; then
    log "Warning: ORCA DB container not found (${ORCA_DB_CONTAINER_NAME}). ORCA master APIs may fail."
    return
  fi
  local server_network
  server_network="$(docker inspect "${SERVER_CONTAINER_NAME}" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{printf "%s\n" $name}}{{end}}' 2>/dev/null | head -n 1 | tr -d '\r')"
  if [[ -z "$server_network" ]]; then
    log "Warning: could not resolve server network for ORCA DB bridge."
    return
  fi
  if docker inspect "${ORCA_DB_CONTAINER_NAME}" --format '{{json .NetworkSettings.Networks}}' | grep -q "\"${server_network}\""; then
    log "ORCA DB container already attached to ${server_network}."
    return
  fi
  log "Connecting ORCA DB container ${ORCA_DB_CONTAINER_NAME} to ${server_network}..."
  if [[ "$ORCA_DB_HOST" != "$ORCA_DB_CONTAINER_NAME" ]]; then
    docker network connect --alias "${ORCA_DB_HOST}" "${server_network}" "${ORCA_DB_CONTAINER_NAME}" >/dev/null
  else
    docker network connect "${server_network}" "${ORCA_DB_CONTAINER_NAME}" >/dev/null
  fi
}

schema_table_exists() {
  local table_name="$1"
  docker exec "${POSTGRES_CONTAINER_NAME}" \
    psql -U opendolphin -d opendolphin_modern -tAc \
    "SELECT to_regclass('${table_name}') IS NOT NULL;" \
    | tr -d '[:space:]'
}

wait_for_postgres_ready() {
  local retries="${1:-30}"
  for _ in $(seq 1 "$retries"); do
    if docker exec "${POSTGRES_CONTAINER_NAME}" pg_isready -U opendolphin >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

init_db_log() {
  mkdir -p "$DB_INIT_LOG_DIR_PATH"
  if [[ ! -f "$DB_INIT_LOG_FILE" ]]; then
    printf '' > "$DB_INIT_LOG_FILE"
  fi
}

log_db_check() {
  printf '%s\n' "$*" | tee -a "$DB_INIT_LOG_FILE"
}

ensure_search_path() {
  local current_path
  current_path="$(docker exec "${POSTGRES_CONTAINER_NAME}" \
    psql -U opendolphin -d opendolphin_modern -tAc "SHOW search_path;" \
    | tr -d '[:space:]')"
  if [[ "$current_path" != *"opendolphin"* || "$current_path" != *"public"* ]]; then
    log "Fixing search_path (current=${current_path:-unknown})..."
    docker exec "${POSTGRES_CONTAINER_NAME}" \
      psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 \
      -c "ALTER ROLE opendolphin SET search_path TO opendolphin,public;"
    SEARCH_PATH_FIXED=1
  else
    log "search_path is already set: $current_path"
  fi
}

needs_db_repair() {
  local current_path
  current_path="$(docker exec "${POSTGRES_CONTAINER_NAME}" \
    psql -U opendolphin -d opendolphin_modern -tAc "SHOW search_path;" \
    | tr -d '[:space:]')"
  if [[ "$current_path" != *"opendolphin"* || "$current_path" != *"public"* ]]; then
    return 0
  fi
  local required_sequences=(
    "opendolphin.hibernate_sequence"
    "opendolphin.d_patient_seq"
    "opendolphin.d_karte_seq"
    "opendolphin.d_audit_event_id_seq"
  )
  for seq in "${required_sequences[@]}"; do
    if [[ "$(schema_table_exists "$seq")" != "t" ]]; then
      return 0
    fi
  done
  return 1
}

run_db_init_repair() {
  if [[ ! -f "$DB_INIT_REPAIR_SQL_PATH" ]]; then
    echo "DB init repair SQL not found: $DB_INIT_REPAIR_SQL_PATH" >&2
    exit 1
  fi
  init_db_log
  if ! needs_db_repair; then
    log "DB init repair skipped (baseline OK)."
    log_db_check "DB init repair skipped (baseline OK)."
    return
  fi
  docker cp "$DB_INIT_REPAIR_SQL_PATH" "${POSTGRES_CONTAINER_NAME}":/tmp/modernized_db_init_repair.sql
  log "Running DB init repair SQL... (log: $DB_INIT_LOG_FILE)"
  docker exec "${POSTGRES_CONTAINER_NAME}" \
    psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 \
    -f /tmp/modernized_db_init_repair.sql | tee "$DB_INIT_LOG_FILE"
  DB_REPAIR_APPLIED=1
}

check_db_baseline() {
  local missing=0
  local required_any_schema_tables=(
    "d_users"
    "d_facility"
    "d_roles"
    "d_audit_event"
  )
  local required_sequences=(
    "opendolphin.hibernate_sequence"
    "opendolphin.d_patient_seq"
    "opendolphin.d_karte_seq"
    "opendolphin.d_audit_event_id_seq"
  )

  init_db_log
  log_db_check "DB baseline check runId=${DB_INIT_RUN_ID}"
  log_db_check "Required tables: ${required_any_schema_tables[*]}"
  log_db_check "Required sequences: ${required_sequences[*]}"

  local current_path
  current_path="$(docker exec "${POSTGRES_CONTAINER_NAME}" \
    psql -U opendolphin -d opendolphin_modern -tAc "SHOW search_path;" \
    | tr -d '[:space:]')"
  if [[ "$current_path" != *"opendolphin"* || "$current_path" != *"public"* ]]; then
    log "search_path is missing required schemas: ${current_path:-unknown}"
    log_db_check "Missing search_path requirements: ${current_path:-unknown}"
    missing=1
  fi

  for table in "${required_any_schema_tables[@]}"; do
    if [[ "$(schema_table_exists "opendolphin.${table}")" != "t" && "$(schema_table_exists "public.${table}")" != "t" ]]; then
      log "Missing required table: ${table} (opendolphin/public)"
      log_db_check "Missing table: ${table} (opendolphin/public)"
      missing=1
    fi
  done

  for seq in "${required_sequences[@]}"; do
    if [[ "$(schema_table_exists "$seq")" != "t" ]]; then
      log "Missing required sequence: $seq"
      log_db_check "Missing sequence: $seq"
      missing=1
    fi
  done

  if [[ "$missing" -ne 0 ]]; then
    log_db_check "DB baseline check FAILED."
    echo "DB baseline check failed. Review $DB_INIT_LOG_FILE for details." >&2
    exit 1
  fi
  log_db_check "DB baseline check OK."
}

verify_api_health() {
  local health_script="$SCRIPT_DIR/ops/tools/api_health_check.sh"
  if [[ ! -x "$health_script" ]]; then
    echo "API health check script not found or not executable: $health_script" >&2
    exit 1
  fi
  mkdir -p "$API_HEALTH_LOG_DIR_PATH"
  log "Running API health check... (log: $API_HEALTH_LOG_FILE)"
  RUN_ID="$DB_INIT_RUN_ID" \
    API_HEALTH_BASE_URL="$API_HEALTH_BASE_URL" \
    API_HEALTH_LOG_FILE="$API_HEALTH_LOG_FILE" \
    "$health_script"
}

apply_flyway_migrations() {
  if [[ "$FLYWAY_MIGRATE_ON_BOOT" != "1" ]]; then
    log "Skipping Flyway migrate (FLYWAY_MIGRATE_ON_BOOT=$FLYWAY_MIGRATE_ON_BOOT)."
    return
  fi

  if ! wait_for_postgres_ready 30; then
    echo "Postgres did not become ready in time." >&2
    exit 1
  fi

  mkdir -p "$FLYWAY_LOG_DIR_PATH"
  log "Running Flyway migrate... (log: $FLYWAY_LOG_FILE)"

  local db_name="${MODERNIZED_POSTGRES_DB:-opendolphin_modern}"
  local db_user="${MODERNIZED_POSTGRES_USER:-opendolphin}"
  local db_pass="${MODERNIZED_POSTGRES_PASSWORD:-opendolphin}"
  local flyway_args=(
    -configFiles=server-modernized/tools/flyway/flyway.conf
  )
  if is_truthy "$FLYWAY_OUT_OF_ORDER"; then
    flyway_args+=(-outOfOrder=true)
  fi

  if docker run --rm \
      --network "container:${POSTGRES_CONTAINER_NAME}" \
      -v "$SCRIPT_DIR":/workspace -w /workspace \
      -e DB_HOST=localhost \
      -e DB_PORT=5432 \
      -e DB_NAME="$db_name" \
      -e DB_USER="$db_user" \
      -e DB_PASSWORD="$db_pass" \
      flyway/flyway:10.17 \
      "${flyway_args[@]}" \
      migrate \
      | tee "$FLYWAY_LOG_FILE"; then
    FLYWAY_APPLIED=1
    return
  fi

  if ! is_truthy "$FLYWAY_REPAIR_ON_VALIDATION"; then
    echo "Flyway migrate failed. Set FLYWAY_REPAIR_ON_VALIDATION=1 to auto-repair." >&2
    exit 1
  fi

  log "Flyway migrate failed. Running flyway repair..."
  docker run --rm \
    --network "container:${POSTGRES_CONTAINER_NAME}" \
    -v "$SCRIPT_DIR":/workspace -w /workspace \
    -e DB_HOST=localhost \
    -e DB_PORT=5432 \
    -e DB_NAME="$db_name" \
    -e DB_USER="$db_user" \
    -e DB_PASSWORD="$db_pass" \
    flyway/flyway:10.17 \
    "${flyway_args[@]}" \
    repair \
    | tee -a "$FLYWAY_LOG_FILE"

  log "Retrying Flyway migrate after repair..."
  docker run --rm \
    --network "container:${POSTGRES_CONTAINER_NAME}" \
    -v "$SCRIPT_DIR":/workspace -w /workspace \
    -e DB_HOST=localhost \
    -e DB_PORT=5432 \
    -e DB_NAME="$db_name" \
    -e DB_USER="$db_user" \
    -e DB_PASSWORD="$db_pass" \
    flyway/flyway:10.17 \
    "${flyway_args[@]}" \
    migrate \
    | tee -a "$FLYWAY_LOG_FILE"

  FLYWAY_APPLIED=1
}

initialize_schema_if_needed() {
  if ! wait_for_postgres_ready 30; then
    echo "Postgres did not become ready in time." >&2
    exit 1
  fi

  local has_users
  has_users="$(schema_table_exists public.d_users)"
  if [[ "$has_users" == "t" ]]; then
    log "DB schema already initialized."
    return
  fi

  if [[ ! -f "$SCHEMA_DUMP_PATH" ]]; then
    echo "Schema dump not found: $SCHEMA_DUMP_PATH" >&2
    echo "DB initialization requires legacy schema dump." >&2
    echo "Guide: docs/preprod/implementation-issue-inventory/data-migration.md (SCHEMA_DUMP_FILE の取得元・生成手順)" >&2
    exit 1
  fi

  log "Initializing DB schema from legacy schema dump..."
  sed 's/^CREATE SCHEMA opendolphin;/CREATE SCHEMA IF NOT EXISTS opendolphin;/' "$SCHEMA_DUMP_PATH" | \
    docker exec -i "${POSTGRES_CONTAINER_NAME}" psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1
  SCHEMA_INITIALIZED=1
  log "Schema initialization completed."
}

wait_for_server() {
  log "Waiting for server to be healthy..."
  local retries=60
  local success=0
  for _ in $(seq 1 "$retries"); do
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' "$SERVER_HEALTH_URL" || true)
    if [[ "$status" == "200" ]]; then
      success=1
      break
    fi
    printf "."
    sleep 5
  done
  echo ""

  if [[ "$success" -ne 1 ]]; then
    echo "Server failed to start within timeout." >&2
    exit 1
  fi
  log "Server is UP!"
}

apply_baseline_seed() {
  log "Applying local baseline seed ($LOCAL_SEED_FILE)..."
  if [[ ! -f "$LOCAL_SEED_FILE" ]]; then
    echo "Seed file not found: $LOCAL_SEED_FILE" >&2
    exit 1
  fi
  if [[ "$(has_modernized_table d_facility)" != "1" ]]; then
    log "Warning: d_facility table not found; skipping baseline seed. Initialize DB schema first."
    return
  fi
  docker cp "$LOCAL_SEED_FILE" "${POSTGRES_CONTAINER_NAME}":/tmp/modern_seed.sql
  docker exec "${POSTGRES_CONTAINER_NAME}" psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 -f /tmp/modern_seed.sql
  log "Baseline seed applied."
}

register_initial_user() {
  log "Registering smoke user ($SMOKE_USER_ID) via SQL..."
  if [[ "$(has_modernized_table d_users)" != "1" ]]; then
    log "Warning: d_users table not found; skipping initial user registration."
    return
  fi
  local seed_schema="public"
  if [[ "$(schema_table_exists opendolphin.d_users)" == "t" ]]; then
    seed_schema="opendolphin"
  fi
  # Use the same default search_path as the running server (opendolphin first).
  # When d_users only exists in public, inserts still resolve correctly via search_path,
  # while d_roles (which may exist in opendolphin) is seeded where the server will read it.
  local seed_search_path="opendolphin,public"
  if [[ "$seed_schema" != "public" ]]; then
    seed_search_path="${seed_schema},public"
  fi
  local tmp_sql
  tmp_sql=$(mktemp)
  cat > "$tmp_sql" <<EOF
-- Prefer opendolphin schema when available so the server can authenticate the seeded user.
SET search_path = ${seed_search_path};

-- Ensure hibernate_sequence exists and is aligned
DO \$\$
DECLARE
    max_id BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'hibernate_sequence' AND relkind = 'S'
    ) THEN
        CREATE SEQUENCE IF NOT EXISTS hibernate_sequence
            START WITH 1
            INCREMENT BY 1
            NO MINVALUE
            NO MAXVALUE
            CACHE 1;
    END IF;

    SELECT GREATEST(
        COALESCE((SELECT max(id) FROM d_facility), 0),
        COALESCE((SELECT max(id) FROM d_users), 0),
        COALESCE((SELECT max(id) FROM d_roles), 0),
        1
    ) INTO max_id;

    PERFORM setval('hibernate_sequence', max_id, true);
END\$\$;

-- Create facility if missing
INSERT INTO d_facility (id, facilityid, facilityname, membertype, registereddate, zipcode, address, telephone)
SELECT nextval('hibernate_sequence'), '$FACILITY_ID', 'OpenDolphin Clinic', 'PROCESS', now(), '000-0000', 'Tokyo', '03-0000-0000'
WHERE NOT EXISTS (SELECT 1 FROM d_facility WHERE facilityid = '$FACILITY_ID');

-- Create user if missing
INSERT INTO d_users (
    id, userid, password, commonname, facility_id, membertype, registereddate,
    sirname, givenname, email
)
SELECT
    nextval('hibernate_sequence'),
    '$FACILITY_ID:$SMOKE_USER_ID',
    '$SMOKE_USER_PASS_CURRENT_HASH',
    '$SMOKE_USER_NAME',
    (SELECT id FROM d_facility WHERE facilityid = '$FACILITY_ID'),
    'PROCESS',
    now(),
    '$SMOKE_USER_SIR_NAME', '$SMOKE_USER_GIVEN_NAME', '$SMOKE_USER_EMAIL'
WHERE NOT EXISTS (SELECT 1 FROM d_users WHERE userid = '$FACILITY_ID:$SMOKE_USER_ID');

-- Keep smoke user aligned with current auth contract (PBKDF2 only).
UPDATE d_users
SET
    password = '$SMOKE_USER_PASS_CURRENT_HASH',
    commonname = '$SMOKE_USER_NAME',
    sirname = '$SMOKE_USER_SIR_NAME',
    givenname = '$SMOKE_USER_GIVEN_NAME',
    email = '$SMOKE_USER_EMAIL',
    factor2auth = NULL,
    facility_id = (SELECT id FROM d_facility WHERE facilityid = '$FACILITY_ID')
WHERE userid = '$FACILITY_ID:$SMOKE_USER_ID';

-- Create roles if missing
INSERT INTO d_roles (id, c_role, user_id, c_user)
SELECT nextval('hibernate_sequence'), 'admin', '$FACILITY_ID:$SMOKE_USER_ID', id
FROM d_users WHERE userid = '$FACILITY_ID:$SMOKE_USER_ID'
AND NOT EXISTS (SELECT 1 FROM d_roles WHERE user_id = '$FACILITY_ID:$SMOKE_USER_ID' AND c_role = 'admin');

INSERT INTO d_roles (id, c_role, user_id, c_user)
SELECT nextval('hibernate_sequence'), 'user', '$FACILITY_ID:$SMOKE_USER_ID', id
FROM d_users WHERE userid = '$FACILITY_ID:$SMOKE_USER_ID'
AND NOT EXISTS (SELECT 1 FROM d_roles WHERE user_id = '$FACILITY_ID:$SMOKE_USER_ID' AND c_role = 'user');

INSERT INTO d_roles (id, c_role, user_id, c_user)
SELECT nextval('hibernate_sequence'), 'doctor', '$FACILITY_ID:$SMOKE_USER_ID', id
FROM d_users WHERE userid = '$FACILITY_ID:$SMOKE_USER_ID'
AND NOT EXISTS (SELECT 1 FROM d_roles WHERE user_id = '$FACILITY_ID:$SMOKE_USER_ID' AND c_role = 'doctor');
EOF

  docker cp "$tmp_sql" "${POSTGRES_CONTAINER_NAME}":/tmp/modern_user_seed.sql
  docker exec "${POSTGRES_CONTAINER_NAME}" psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 -f /tmp/modern_user_seed.sql
  rm -f "$tmp_sql"
  log "User registration SQL executed successfully."
}

seed_smoke_runtime_projection() {
  log "Seeding smoke runtime projection..."
  if [[ "$(has_modernized_table schedule_projection)" != "1" || "$(has_modernized_table encounter_projection)" != "1" ]]; then
    log "Warning: projection tables not found; skipping smoke runtime projection seed."
    return
  fi
  local tmp_sql
  tmp_sql=$(mktemp)
  cat > "$tmp_sql" <<EOF
SET search_path = opendolphin,public;

WITH runtime_clock AS (
    SELECT (date_trunc('day', timezone('Asia/Tokyo', now())) + interval '9 hours') AT TIME ZONE 'Asia/Tokyo' AS smoke_ts
),
patient_ctx AS (
    SELECT
        p.facilityid AS facility_id,
        p.patientid AS patient_id,
        (SELECT k.id FROM d_karte k WHERE k.patient_id = p.id ORDER BY k.id DESC LIMIT 1) AS karte_id
    FROM d_patient p
    WHERE p.facilityid = '$FACILITY_ID'
      AND p.patientid = '$SMOKE_PATIENT_ID'
)
INSERT INTO schedule_projection (
    schedule_key, facility_id, patient_id, karte_id, orca_appointment_id, scheduled_datetime,
    department_code, physician_code, state, linked_encounter_key, source_updated_at, projected_at
)
SELECT
    'SMOKE-SCHEDULE-20251129-0001',
    facility_id,
    patient_id,
    karte_id,
    'SMOKE-SCHEDULE-20251129-0001',
    smoke_ts,
    NULL,
    NULL,
    'scheduled',
    '$FACILITY_ID:SMOKE-20251129-0001',
    smoke_ts,
    smoke_ts
FROM patient_ctx
CROSS JOIN runtime_clock
WHERE karte_id IS NOT NULL
ON CONFLICT (schedule_key) DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    patient_id = EXCLUDED.patient_id,
    karte_id = EXCLUDED.karte_id,
    orca_appointment_id = EXCLUDED.orca_appointment_id,
    scheduled_datetime = EXCLUDED.scheduled_datetime,
    department_code = EXCLUDED.department_code,
    physician_code = EXCLUDED.physician_code,
    state = EXCLUDED.state,
    linked_encounter_key = EXCLUDED.linked_encounter_key,
    source_updated_at = EXCLUDED.source_updated_at,
    projected_at = EXCLUDED.projected_at;

WITH runtime_clock AS (
  SELECT (date_trunc('day', timezone('Asia/Tokyo', now())) + interval '9 hours') AT TIME ZONE 'Asia/Tokyo' AS smoke_ts
), patient_ctx AS (
  SELECT
    p.facilityid AS facility_id,
    p.patientid AS patient_id,
    (SELECT k.id FROM d_karte k WHERE k.patient_id = p.id ORDER BY k.id DESC LIMIT 1) AS karte_id
  FROM d_patient p
  WHERE p.facilityid = '${FACILITY_ID}'
    AND p.patientid = '${SMOKE_PATIENT_ID}'
)
INSERT INTO encounter_projection (
    encounter_key, facility_id, patient_id, karte_id, schedule_key, orca_acceptance_id,
    acceptance_datetime, business_state, chart_opened_at, billed_at, cancelled_at,
    owner_user_id, memo, worklist_flags, last_orca_sync_at, state_version, projected_at
)
SELECT
    '$FACILITY_ID:SMOKE-20251129-0001',
    facility_id,
    patient_id,
    karte_id,
    'SMOKE-SCHEDULE-20251129-0001',
    'SMOKE-ACCEPT-20251129-0001',
    smoke_ts,
    'checked_in',
    NULL,
    NULL,
    NULL,
    '$FACILITY_ID:$SMOKE_USER_ID',
    'dev smoke runtime encounter',
    '{}'::jsonb,
    smoke_ts,
    0,
    smoke_ts
FROM patient_ctx
CROSS JOIN runtime_clock
WHERE karte_id IS NOT NULL
ON CONFLICT (encounter_key) DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    patient_id = EXCLUDED.patient_id,
    karte_id = EXCLUDED.karte_id,
    schedule_key = EXCLUDED.schedule_key,
    orca_acceptance_id = EXCLUDED.orca_acceptance_id,
    acceptance_datetime = EXCLUDED.acceptance_datetime,
    business_state = EXCLUDED.business_state,
    chart_opened_at = EXCLUDED.chart_opened_at,
    billed_at = EXCLUDED.billed_at,
    cancelled_at = EXCLUDED.cancelled_at,
    owner_user_id = EXCLUDED.owner_user_id,
    memo = EXCLUDED.memo,
    worklist_flags = EXCLUDED.worklist_flags,
    last_orca_sync_at = EXCLUDED.last_orca_sync_at,
    state_version = EXCLUDED.state_version,
    projected_at = EXCLUDED.projected_at;
EOF

  docker cp "$tmp_sql" "${POSTGRES_CONTAINER_NAME}":/tmp/modern_smoke_runtime_projection.sql
  docker exec "${POSTGRES_CONTAINER_NAME}" psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 -f /tmp/modern_smoke_runtime_projection.sql
  rm -f "$tmp_sql"
  log "Smoke runtime projection seed executed successfully."
}

seed_smoke_patient_identity() {
  log "Seeding smoke patient identity..."
  if [[ "$(has_modernized_table d_patient)" != "1" ]]; then
    log "Warning: d_patient not found; skipping smoke patient identity seed."
    return
  fi
  local tmp_sql
  tmp_sql=$(mktemp)
  cat > "$tmp_sql" <<EOF
SET search_path = opendolphin,public;

UPDATE d_patient
   SET familyname = '$SMOKE_PATIENT_FAMILY_NAME',
       givenname = '$SMOKE_PATIENT_GIVEN_NAME',
       fullname = '$SMOKE_PATIENT_FULL_NAME',
       kanafamilyname = '$SMOKE_PATIENT_KANA_FAMILY_NAME',
       kanagivenname = '$SMOKE_PATIENT_KANA_GIVEN_NAME',
       kananame = '$SMOKE_PATIENT_KANA_NAME'
 WHERE facilityid = '$FACILITY_ID'
   AND patientid = '$SMOKE_PATIENT_ID';
EOF

  docker cp "$tmp_sql" "${POSTGRES_CONTAINER_NAME}":/tmp/modern_smoke_patient_identity.sql
  docker exec "${POSTGRES_CONTAINER_NAME}" psql -U opendolphin -d opendolphin_modern -v ON_ERROR_STOP=1 -f /tmp/modern_smoke_patient_identity.sql
  rm -f "$tmp_sql"
  log "Smoke patient identity seed executed successfully."
}

stop_existing_web_client_dev_server() {
  if [[ -f "$WEB_CLIENT_DEV_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(<"$WEB_CLIENT_DEV_PID_FILE" || true)"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
      log "Stopping existing Web Client dev server PID $existing_pid..."
      kill "$existing_pid"
      for _ in {1..5}; do
        if kill -0 "$existing_pid" >/dev/null 2>&1; then
          sleep 1
          continue
        fi
        break
      done
      if kill -0 "$existing_pid" >/dev/null 2>&1; then
        log "Forcing stop of Web Client dev server PID $existing_pid..."
        kill -9 "$existing_pid"
      fi
    fi
    rm -f "$WEB_CLIENT_DEV_PID_FILE"
  fi

  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$WEB_CLIENT_DEV_TMUX_SESSION" >/dev/null 2>&1; then
    log "Stopping existing Web Client dev tmux session $WEB_CLIENT_DEV_TMUX_SESSION..."
    tmux kill-session -t "$WEB_CLIENT_DEV_TMUX_SESSION" >/dev/null 2>&1 || true
  fi

  if command -v lsof >/dev/null 2>&1; then
    local port_pids
    port_pids=$(lsof -t -iTCP:"$WEB_CLIENT_DEV_PORT" -sTCP:LISTEN || true)
    for pid in $port_pids; do
      if [[ -n "$pid" ]]; then
        log "Clearing lingering listener on port $WEB_CLIENT_DEV_PORT (PID $pid)..."
        kill "$pid" >/dev/null 2>&1 || true
      fi
    done
  else
    local fallback_pid
    fallback_pid=$(pgrep -f "npm run dev -- --host .*${WEB_CLIENT_DEV_PORT}" || true)
    if [[ -n "$fallback_pid" ]]; then
      log "Killing fallback npm dev process PID $fallback_pid..."
      kill "$fallback_pid" >/dev/null 2>&1 || true
    fi
  fi
}

resolve_web_client_orca_path_prefix() {
  local explicit="${VITE_ORCA_API_PATH_PREFIX:-${ORCA_API_PATH_PREFIX:-}}"
  if [[ -n "$explicit" ]]; then
    printf "%s" "$explicit"
    return
  fi
  local proxy_target="${1:-}"
  if [[ "$proxy_target" == *"/openDolphin/resources"* ]]; then
    printf "off"
    return
  fi
  printf "%s" ""
}

start_web_client_docker() {
  log "Starting Web Client container via docker-compose..."
  local dev_proxy_target="${WEB_CLIENT_DEV_PROXY_TARGET_RAW:-$WEB_CLIENT_DOCKER_PROXY_TARGET_DEFAULT}"
  local dev_enable_facility_header="${VITE_ENABLE_FACILITY_HEADER:-1}"
  local dev_orca_mode="${ORCA_MODE:-}"
  local dev_orca_path_prefix
  dev_orca_path_prefix="$(resolve_web_client_orca_path_prefix "$dev_proxy_target")"
  local dev_orca_basic_user="${ORCA_PROXY_BASIC_USER:-${ORCA_BASIC_USER:-${ORCA_API_USER:-${ORCA_TRIAL_USER:-}}}}"
  local dev_orca_basic_password="${ORCA_PROXY_BASIC_PASSWORD:-${ORCA_BASIC_PASSWORD:-${ORCA_API_PASSWORD:-${ORCA_TRIAL_PASS:-}}}}"
  local base_path="$VITE_BASE_PATH_NORMALIZED"
  local dev_charts_revision_history="${VITE_CHARTS_REVISION_HISTORY:-1}"
  local dev_charts_revision_edit="${VITE_CHARTS_REVISION_EDIT:-1}"
  VITE_DEV_PROXY_TARGET="$dev_proxy_target" \
    VITE_ENABLE_FACILITY_HEADER="$dev_enable_facility_header" \
    VITE_SINGLE_FACILITY_LOGIN="$VITE_SINGLE_FACILITY_LOGIN_EFFECTIVE" \
    VITE_DEFAULT_FACILITY_ID="$VITE_DEFAULT_FACILITY_ID_EFFECTIVE" \
    VITE_ORCA_MODE="$dev_orca_mode" \
    VITE_ORCA_API_PATH_PREFIX="$dev_orca_path_prefix" \
    VITE_API_BASE_URL="$WEB_CLIENT_DEV_API_BASE" \
    VITE_BASE_PATH="$base_path" \
    VITE_CHARTS_REVISION_HISTORY="$dev_charts_revision_history" \
    VITE_CHARTS_REVISION_EDIT="$dev_charts_revision_edit" \
    ORCA_BASIC_USER="$dev_orca_basic_user" \
    ORCA_BASIC_PASSWORD="$dev_orca_basic_password" \
    docker compose -f docker-compose.web-client.yml up -d --build --force-recreate
}

start_web_client_npm() {
  log "Starting Web Client dev server via npm run dev..."
  mkdir -p "$(dirname "$WEB_CLIENT_DEV_LOG_PATH")"
  stop_existing_web_client_dev_server

  local dev_proxy_target="$WEB_CLIENT_DEV_PROXY_TARGET"
  local dev_use_https="${VITE_DEV_USE_HTTPS:-1}"
  local dev_disable_msw="${VITE_DISABLE_MSW:-1}"
  local dev_enable_telemetry="${VITE_ENABLE_TELEMETRY:-0}"
  local dev_disable_security="${VITE_DISABLE_SECURITY:-0}"
  local dev_disable_audit="${VITE_DISABLE_AUDIT:-0}"
  local dev_enable_facility_header="${VITE_ENABLE_FACILITY_HEADER:-1}"
  local dev_api_base_url="${WEB_CLIENT_DEV_API_BASE:-/api}"
  local dev_orca_mode="${ORCA_MODE:-}"
  local dev_orca_path_prefix
  dev_orca_path_prefix="$(resolve_web_client_orca_path_prefix "$dev_proxy_target")"
  local dev_orca_basic_user="${ORCA_PROXY_BASIC_USER:-${ORCA_BASIC_USER:-${ORCA_API_USER:-${ORCA_TRIAL_USER:-}}}}"
  local dev_orca_basic_password="${ORCA_PROXY_BASIC_PASSWORD:-${ORCA_BASIC_PASSWORD:-${ORCA_API_PASSWORD:-${ORCA_TRIAL_PASS:-}}}}"
  local base_path="$VITE_BASE_PATH_NORMALIZED"
  local dev_charts_revision_history="${VITE_CHARTS_REVISION_HISTORY:-1}"
  local dev_charts_revision_edit="${VITE_CHARTS_REVISION_EDIT:-1}"

  local npm_env_dir="tmp/web-client-vite-env"
  rm -rf "$npm_env_dir"
  mkdir -p "$npm_env_dir"
  cat > "$npm_env_dir/.env" <<EOF
VITE_API_BASE_URL=$dev_api_base_url
VITE_HTTP_TIMEOUT_MS=10000
VITE_HTTP_MAX_RETRIES=2
VITE_DEV_PROXY_TARGET=$dev_proxy_target
VITE_DEV_USE_HTTPS=$dev_use_https
VITE_DISABLE_MSW=$dev_disable_msw
VITE_ENABLE_TELEMETRY=$dev_enable_telemetry
VITE_DISABLE_SECURITY=$dev_disable_security
VITE_DISABLE_AUDIT=$dev_disable_audit
VITE_ENABLE_FACILITY_HEADER=$dev_enable_facility_header
VITE_SINGLE_FACILITY_LOGIN=$VITE_SINGLE_FACILITY_LOGIN_EFFECTIVE
VITE_DEFAULT_FACILITY_ID=$VITE_DEFAULT_FACILITY_ID_EFFECTIVE
VITE_ORCA_MODE=$dev_orca_mode
VITE_ORCA_API_PATH_PREFIX=$dev_orca_path_prefix
VITE_BASE_PATH=$base_path
VITE_CHARTS_REVISION_HISTORY=$dev_charts_revision_history
VITE_CHARTS_REVISION_EDIT=$dev_charts_revision_edit
EOF
  mkdir -p "$(dirname "$WEB_CLIENT_ENV_LOCAL")"
  cp "$npm_env_dir/.env" "$WEB_CLIENT_ENV_LOCAL"

  local npm_pid
  if command -v tmux >/dev/null 2>&1; then
    tmux new-session -d \
      -s "$WEB_CLIENT_DEV_TMUX_SESSION" \
      -c "$SCRIPT_DIR/web-client" \
      "exec npm run dev -- --host '$WEB_CLIENT_DEV_HOST' --port '$WEB_CLIENT_DEV_PORT' > '$WEB_CLIENT_DEV_LOG_PATH' 2>&1"
    sleep 0.2
    npm_pid="$(tmux list-panes -t "$WEB_CLIENT_DEV_TMUX_SESSION" -F '#{pane_pid}' | head -n 1)"
    log "Web Client dev tmux session $WEB_CLIENT_DEV_TMUX_SESSION started."
  else
    pushd web-client >/dev/null
    nohup npm run dev -- --host "$WEB_CLIENT_DEV_HOST" --port "$WEB_CLIENT_DEV_PORT" > "$WEB_CLIENT_DEV_LOG_PATH" 2>&1 < /dev/null &
    npm_pid="$!"
    popd >/dev/null
  fi
  printf "%s" "$npm_pid" > "$WEB_CLIENT_DEV_PID_FILE"

  log "Web Client dev server PID $npm_pid, logs at $WEB_CLIENT_DEV_LOG_PATH"
  log "Tail the log via 'tail -f $WEB_CLIENT_DEV_LOG' to watch the dev server output."
}

start_web_client() {
  case "$WEB_CLIENT_MODE_LOWER" in
    npm* | dev*)
      start_web_client_npm
      ;;
    *)
      start_web_client_docker
      ;;
  esac
}

wait_for_web_client_dev_server() {
  local scheme="http"
  if [[ "${VITE_DEV_USE_HTTPS:-1}" == "1" ]]; then
    scheme="https"
  fi
  local access_host
  access_host="$(web_client_local_access_host "$WEB_CLIENT_DEV_HOST")"
  local url="${scheme}://${access_host}:${WEB_CLIENT_DEV_PORT}/"
  local pid=""
  if [[ -f "$WEB_CLIENT_DEV_PID_FILE" ]]; then
    pid="$(<"$WEB_CLIENT_DEV_PID_FILE" || true)"
  fi

  log "Waiting for Web Client dev server response at ${url}..."
  local consecutive_successes=0
  for _ in {1..60}; do
    if [[ -n "$pid" ]] && ! kill -0 "$pid" >/dev/null 2>&1; then
      echo "Web Client dev server exited before it became available (PID $pid)." >&2
      echo "Log path: $WEB_CLIENT_DEV_LOG_PATH" >&2
      tail -n 80 "$WEB_CLIENT_DEV_LOG_PATH" >&2 || true
      return 1
    fi
    if curl -kfsS --max-time 2 "$url" >/dev/null 2>&1; then
      consecutive_successes=$((consecutive_successes + 1))
      if [[ "$consecutive_successes" -ge 5 ]]; then
        log "Web Client dev server responded at ${url} for ${consecutive_successes} consecutive checks"
        return 0
      fi
    else
      consecutive_successes=0
    fi
    sleep 1
  done

  echo "Web Client dev server did not respond within 60s: ${url}" >&2
  echo "Log path: $WEB_CLIENT_DEV_LOG_PATH" >&2
  tail -n 80 "$WEB_CLIENT_DEV_LOG_PATH" >&2 || true
  return 1
}

main() {
  read_orca_info
  resolve_object_storage_runtime_profile
  resolve_dev_object_storage_credentials
  resolve_dev_admin_credentials
  generate_document_integrity_keyring
  if [[ "${ORCA_CONFIG_ONLY:-0}" == "1" ]]; then
    log "ORCA_CONFIG_ONLY=1: skipping docker startup."
    return 0
  fi
  generate_custom_properties
  generate_compose_override
  start_modernized_server
  ensure_orca_db_bridge
  initialize_schema_if_needed
  ensure_search_path
  run_db_init_repair
  check_db_baseline
  apply_flyway_migrations
  if [[ "$SCHEMA_INITIALIZED" -eq 1 || "$DB_REPAIR_APPLIED" -eq 1 || "$SEARCH_PATH_FIXED" -eq 1 || "$FLYWAY_APPLIED" -eq 1 ]]; then
    log "Restarting Modernized Server to pick up initialized schema..."
    docker restart "${SERVER_CONTAINER_NAME}" >/dev/null
  fi
  wait_for_server
  verify_api_health
  apply_baseline_seed
  register_initial_user
  seed_smoke_patient_identity
  seed_smoke_runtime_projection
  start_web_client
  if [[ "$WEB_CLIENT_MODE_LOWER" == npm* || "$WEB_CLIENT_MODE_LOWER" == dev* ]]; then
    wait_for_web_client_dev_server
    local scheme="http"
    if [[ "${VITE_DEV_USE_HTTPS:-1}" == "1" ]]; then
      scheme="https"
    fi
    local access_host
    access_host="$(web_client_local_access_host "$WEB_CLIENT_DEV_HOST")"
    log "All set! Web Client dev server is listening on ${WEB_CLIENT_DEV_HOST}:${WEB_CLIENT_DEV_PORT}"
    log "Open Web Client at ${scheme}://${access_host}:${WEB_CLIENT_DEV_PORT}/"
    if is_truthy "$WEB_CLIENT_CODEX_BROWSER_COMPAT"; then
      log "Codex browser compatibility mode is enabled for npm dev server binding."
    fi
    log "Logs: $WEB_CLIENT_DEV_LOG_PATH"
  else
    log "All set! Web Client is running at http://localhost:${WEB_CLIENT_DEV_PORT}"
  fi
  log "Login with User: $SMOKE_USER_ID / Pass source: $SMOKE_USER_PASS_SOURCE"
}

# ---------------------------------------------------------
# ログイン情報 (開発用 smoke)
# 施設ID: 1.3.6.1.4.1.9414.72.103
# ユーザーID: doctor1
# パスワード: doctor2025
# d_users.userId は 1.3.6.1.4.1.9414.72.103:doctor1 として current PBKDF2 hash を使う
# ---------------------------------------------------------

main "$@"
