#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command not found: $name" >&2
    exit 1
  fi
}

random_b64_32() {
  openssl rand -base64 32
}

load_orca_env_file() {
  local env_file="${ORCA_ENV_FILE:-}"
  local repo_local="$REPO_ROOT/orca.env.local"
  local home_local=""
  if [[ -n "${HOME:-}" ]]; then
    home_local="$HOME/.config/opendolphin/orca.env"
  fi

  if [[ -n "$env_file" ]]; then
    if [[ ! -r "$env_file" ]]; then
      echo "ORCA_ENV_FILE is set but not readable: $env_file" >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    return 0
  fi

  for candidate in "$repo_local" "$home_local"; do
    if [[ -r "$candidate" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$candidate"
      set +a
      return 0
    fi
  done
}

ensure_local_ext_lib_jars() {
  local ext_dir="$REPO_ROOT/ext_lib"
  local itext_target="$ext_dir/iTextAsian.jar"
  local apple_target="$ext_dir/AppleJavaExtensions.jar"
  local itext_source="${ITEXT_ASIAN_JAR_SOURCE:-$HOME/.m2/repository/opendolphin/itext-font/1.0/itext-font-1.0.jar}"
  local apple_source="${APPLE_JAVA_EXTENSIONS_JAR_SOURCE:-$HOME/.m2/repository/com/apple/AppleJavaExtensions/1.6/AppleJavaExtensions-1.6.jar}"

  mkdir -p "$ext_dir"

  if [[ ! -f "$itext_target" ]]; then
    if [[ ! -f "$itext_source" ]]; then
      cat >&2 <<EOF
Missing local Docker build prerequisite: $itext_target
Expected source was not found: $itext_source
Run the Maven reactor once or provide ITEXT_ASIAN_JAR_SOURCE=/path/to/iTextAsian.jar.
EOF
      exit 1
    fi
    cp "$itext_source" "$itext_target"
  fi

  if [[ ! -f "$apple_target" ]]; then
    if [[ ! -f "$apple_source" ]]; then
      cat >&2 <<EOF
Missing local Docker build prerequisite: $apple_target
Expected source was not found: $apple_source
Run the Maven reactor once or provide APPLE_JAVA_EXTENSIONS_JAR_SOURCE=/path/to/AppleJavaExtensions.jar.
EOF
      exit 1
    fi
    cp "$apple_source" "$apple_target"
  fi
}

maybe_prebuild() {
  if ! is_truthy "${START_MODERNIZED_PREBUILD:-0}"; then
    return 0
  fi

  npm --prefix "$REPO_ROOT/web-client" ci
  npm --prefix "$REPO_ROOT/web-client" run build
  mvn -f "$REPO_ROOT/pom.server-modernized.xml" -pl server-modernized -am package
}

require_command openssl
require_command docker
require_command npm
require_command mvn

if [[ ! -d "$REPO_ROOT/web-client/node_modules" ]]; then
  npm --prefix "$REPO_ROOT/web-client" ci
fi

ensure_local_ext_lib_jars
maybe_prebuild
load_orca_env_file

export ORCA_CREDENTIALS_AES_KEY_B64="${ORCA_CREDENTIALS_AES_KEY_B64:-$(random_b64_32)}"
export FACTOR2_AES_KEY_B64="${FACTOR2_AES_KEY_B64:-$(random_b64_32)}"
export MODERNIZED_POSTGRES_PASSWORD="${MODERNIZED_POSTGRES_PASSWORD:-opendolphin}"

# Default to the shared WebORCA Trial endpoint. Credentials must come from
# ORCA_ENV_FILE, ./orca.env.local, ~/.config/opendolphin/orca.env, or explicit env.
export ORCA_TARGET_ENV="${ORCA_TARGET_ENV:-trial}"
export ORCA_API_HOST="${ORCA_API_HOST:-weborca-trial.orca.med.or.jp}"
export ORCA_API_PORT="${ORCA_API_PORT:-443}"
export ORCA_API_SCHEME="${ORCA_API_SCHEME:-https}"
export ORCA_MODE="${ORCA_MODE:-weborca}"

if [[ -z "${ORCA_API_USER:-}" || -z "${ORCA_API_PASSWORD:-}" ]]; then
  cat >&2 <<'EOF'
WebORCA Trial credentials are required.
Provide them via ORCA_ENV_FILE, ./orca.env.local, ~/.config/opendolphin/orca.env,
or explicit ORCA_API_USER / ORCA_API_PASSWORD environment variables.
EOF
  exit 1
fi

export WEB_CLIENT_MODE="${WEB_CLIENT_MODE:-npm}"
export WEB_CLIENT_CODEX_BROWSER_COMPAT="${WEB_CLIENT_CODEX_BROWSER_COMPAT:-1}"
export VITE_DEV_USE_HTTPS="${VITE_DEV_USE_HTTPS:-0}"
export WEB_CLIENT_DEV_PORT="${WEB_CLIENT_DEV_PORT:-5173}"
export WEB_CLIENT_DEV_HOST="${WEB_CLIENT_DEV_HOST:-0.0.0.0}"

cd "$REPO_ROOT"
./setup-modernized-env.sh

echo
echo "Modernized server health:"
curl -fsS "http://localhost:${MODERNIZED_APP_HTTP_PORT:-9080}/openDolphin/api/health"
echo
echo "Web client:"
echo "  http://localhost:${WEB_CLIENT_DEV_PORT}/"
echo
echo "Readiness note:"
echo "  /api/health/readiness should be UP when WebORCA Trial credentials are valid."
