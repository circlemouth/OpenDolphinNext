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

require_literal() {
  local path="$1"
  local literal="$2"
  if ! rg -F --quiet -- "$literal" "$path"; then
    printf 'ORCA retry/recovery contract guard failed: %s is missing %s\n' "$path" "$literal" >&2
    exit 1
  fi
}

require_literal docs/runbooks/release-validation.md "check-orca-retry-recovery-contract.sh"
require_literal docs/runbooks/release-validation.md "OrcaHttpClientResilienceTest"
require_literal docs/runbooks/release-validation.md "PatientModV2OutpatientResourceIdempotencyTest"
require_literal docs/runbooks/release-validation.md "OrcaBillingCorrectionScenarioSupportTest"
require_literal docs/runbooks/release-validation.md "OrcaOperationLedgerSchemaTest"
require_literal docs/runbooks/release-validation.md 'timeout 後の `UNKNOWN`'
require_literal docs/runbooks/release-validation.md "二重クリック"
require_literal docs/runbooks/release-validation.md "サーバー再起動後"

require_literal docs/contracts/orca-connection.md "idempotency_key"
require_literal docs/contracts/orca-connection.md "request_hash"
require_literal docs/contracts/orca-connection.md "ORCA_UNKNOWN"
require_literal docs/contracts/orca-connection.md "tmedicalgetv2"
require_literal docs/contracts/orca-connection.md "resendBlocked"
require_literal docs/contracts/orca-connection.md "server-derived encounter context"

require_literal docs/runbooks/orca-outage-recovery.md "ORCA_UNKNOWN"
require_literal docs/runbooks/orca-outage-recovery.md "tmedicalgetv2"
require_literal docs/runbooks/orca-outage-recovery.md "resendBlocked"
require_literal docs/runbooks/orca-outage-recovery.md "backup restore"
require_literal docs/runbooks/orca-outage-recovery.md "自動再送しない"

require_literal server-modernized/src/test/java/open/dolphin/orca/transport/OrcaHttpClientResilienceTest.java "KEY_ORCA_API_RETRY_NETWORK_MAX"
require_literal server-modernized/src/test/java/open/dolphin/rest/PatientModV2OutpatientResourceIdempotencyTest.java "Idempotent"
require_literal server-modernized/src/test/java/open/dolphin/rest/orca/OrcaBillingCorrectionScenarioSupportTest.java "ORCA_UNKNOWN"
require_literal server-modernized/src/test/java/open/dolphin/rest/orca/OrcaBillingCorrectionScenarioSupportTest.java "tmedicalgetv2"
require_literal server-modernized/src/test/java/open/dolphin/db/OrcaOperationLedgerSchemaTest.java "request_hash"
require_literal server-modernized/src/test/java/open/dolphin/db/OrcaOperationLedgerSchemaTest.java "idempotency_key"

printf 'ORCA retry/recovery contract guard passed\n'
