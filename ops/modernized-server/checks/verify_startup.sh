#!/usr/bin/env bash
# モダナイズ版 WildFly コンテナに必要なリソースが揃っているかを検証する。
# 例: ./verify_startup.sh opendolphin-server-modernized-dev

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"

log_info() {
  printf '[INFO] %s\n' "$*"
}

log_error() {
  printf '[ERROR] %s\n' "$*" >&2
}

log_success() {
  printf '[OK] %s\n' "$*"
}

usage() {
  cat <<'USAGE'
モダナイズ版サーバー起動後に、WildFly コンテナ内の必須リソースを検証するスクリプト。

使い方:
  ./verify_startup.sh <wildfly-container-name> [jboss-cli-path]

引数:
  wildfly-container-name : docker ps --format '{{.Names}}' で確認できる WildFly コンテナ名
  jboss-cli-path         : (任意) コンテナ内の jboss-cli.sh の絶対パス。既定値 /opt/jboss/wildfly/bin/jboss-cli.sh

前提:
  - docker CLI により WildFly コンテナへ docker exec が実行できること
  - WildFly 管理ポートにパスワードなしで接続できる (docker-compose.modernized.dev.yml の既定設定)
  - CLI の read-resource コマンドは成功時に exit code 0 を返すため、set -e により失敗が即座に検知される
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

readonly CONTAINER_NAME="$1"
readonly JBOSS_CLI_PATH="${2:-/opt/jboss/wildfly/bin/jboss-cli.sh}"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "'$cmd' コマンドが見つかりません。Docker / WildFly を操作できる環境で実行してください。"
    exit 1
  fi
}

run_in_container() {
  docker exec "$CONTAINER_NAME" "$@"
}

run_cli() {
  local command="$1"
  run_in_container "$JBOSS_CLI_PATH" --connect --commands="$command"
}

require_command docker

log_info "対象コンテナ: ${CONTAINER_NAME}"
log_info "jboss-cli パス: ${JBOSS_CLI_PATH}"

log_info "FACTOR2_AES_KEY_B64 が設定されているかを確認します"
run_in_container /bin/sh -c 'if [ -z "${FACTOR2_AES_KEY_B64:-}" ]; then echo "FACTOR2_AES_KEY_B64 が未設定です" >&2; exit 1; fi'
log_success "FACTOR2_AES_KEY_B64 が見つかりました"

log_info "JDBC データソース PostgresDS を read-resource で検証します"
run_cli "/subsystem=datasources/data-source=PostgresDS:read-resource(include-runtime=true)"
log_success "PostgresDS の read-resource が成功しました"

log_info "JMS キューと JmsXA の read-resource を実行します"
run_cli "/subsystem=messaging-activemq/server=default/jms-queue=dolphinQueue:read-resource"
run_cli "/subsystem=messaging-activemq/server=default/connection-factory=InVmConnectionFactory:read-resource"
run_cli "/subsystem=messaging-activemq/server=default/pooled-connection-factory=JmsXA:read-resource"
run_cli "/subsystem=messaging-activemq/server=default/jms-queue=dolphinQueue:read-resource(include-runtime=true)"
log_success "JMS リソースの read-resource が成功しました"

log_info "Managed Executor / Scheduler / ThreadFactory を read-resource します"
run_cli "/subsystem=ee/service=managed-executor-service=default:read-resource"
run_cli "/subsystem=ee/service=managed-scheduled-executor-service=default:read-resource"
run_cli "/subsystem=ee/service=managed-thread-factory=default:read-resource"
log_success "Concurrency リソースの read-resource が成功しました"

log_info "WildFly リソース検証が完了しました"
