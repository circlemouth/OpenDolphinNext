#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT_DIR=$2
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$ROOT_DIR" ]]; then
  ROOT_DIR=$(git rev-parse --show-toplevel)
fi
cd "$ROOT_DIR"

if ! command -v rg >/dev/null 2>&1; then
  printf 'ripgrep is required for finalized write guard check\n' >&2
  exit 2
fi

karte_service="server-modernized/src/main/java/open/dolphin/session/KarteDocumentWriteService.java"
karte_test="server-modernized/src/test/java/open/dolphin/session/KarteServiceBeanDocPkTest.java"
prescription_resource="server-modernized/src/main/java/open/dolphin/rest/orca/LocalPrescriptionOrderResource.java"
prescription_test="server-modernized/src/test/java/open/dolphin/rest/orca/LocalPrescriptionOrderResourceTest.java"

missing=0

require_pattern() {
  local label=$1
  local file=$2
  local pattern=$3
  if ! rg -q "$pattern" "$file"; then
    printf 'missing finalized write guard evidence: %s (%s)\n' "$label" "$file" >&2
    missing=1
  fi
}

line_number() {
  local pattern=$1
  local file=$2
  rg -n "$pattern" "$file" | head -n 1 | cut -d: -f1
}

require_order() {
  local label=$1
  local file=$2
  local before_pattern=$3
  local after_pattern=$4
  local before_line after_line
  before_line=$(line_number "$before_pattern" "$file")
  after_line=$(line_number "$after_pattern" "$file")
  if [[ -z "$before_line" || -z "$after_line" || "$before_line" -ge "$after_line" ]]; then
    printf 'invalid finalized write guard order: %s (%s before=%s after=%s)\n' \
      "$label" "$file" "${before_line:-missing}" "${after_line:-missing}" >&2
    missing=1
  fi
}

require_pattern "finalized chart title updates are denied unless TMP" \
  "$karte_service" 'if \(!IInfoModel\.STATUS_TMP\.equals\(currentStatus\)\)'
require_pattern "finalized chart title direct update returns conflict code" \
  "$karte_service" 'finalizedUpdateDenied\(pk, currentStatus, currentStatus\)'
require_pattern "finalized chart title denial regression test exists" \
  "$karte_test" 'updateTitle_rejectsFinalizedDocumentWithConflictPayload'
require_pattern "finalized chart title denial preserves original title" \
  "$karte_test" 'getTitle\(\)\)\.isEqualTo\("before"\)'

require_pattern "prescription mutation uses server-side encounter projection" \
  "$prescription_resource" 'ensureEncounterAllowsPrescriptionMutation'
require_pattern "prescription closed encounter conflict code exists" \
  "$prescription_resource" 'prescription_order_finalized_update_denied'
require_pattern "prescription blocked states include accounting wait" \
  "$prescription_resource" '"accounting-wait", "billing-waiting", "closed", "cancelled"'
require_order "saveOrder checks encounter mutability before persistence" \
  "$prescription_resource" 'ensureEncounterAllowsPrescriptionMutation\(request, facilityId, patientId, normalized\.getEncounterId\(\),' \
  'prescriptionOrderRepository\.save'
require_order "doImport checks encounter mutability before persistence" \
  "$prescription_resource" 'validateDoImportRequest\(request, payload, runId, facilityId\)' \
  'saveDoImportOrder'
require_order "doImport validates encounter mutability before returning context" \
  "$prescription_resource" 'ensureEncounterAllowsPrescriptionMutation\(request, facilityId, patientId, targetEncounterId,' \
  'return new DoImportContext'
require_pattern "saveOrder closed encounter regression test exists" \
  "$prescription_test" 'saveOrderRejectsBillingClosedEncounterMutation'
require_pattern "doImport closed encounter regression test exists" \
  "$prescription_test" 'doImportRejectsBillingClosedEncounterMutation'
require_pattern "closed encounter prescription denial does not persist payload" \
  "$prescription_test" 'assertEquals\(0, fakeRepository\.saveCalls\)'

if [[ "$missing" -ne 0 ]]; then
  printf 'finalized write guard check failed\n' >&2
  exit 1
fi

printf 'finalized write guard check passed\n'
