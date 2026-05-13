#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --root)
      ROOT_DIR="${2:-}"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

cd "$ROOT_DIR"

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf 'release validation entrypoint missing file: %s\n' "$file" >&2
    exit 1
  fi
}

require_executable_or_file() {
  local file="$1"
  require_file "$file"
}

require_package_script() {
  local script="$1"
  if ! node -e "const p=require('./web-client/package.json'); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)" "$script"; then
    printf 'release validation entrypoint missing web-client npm script: %s\n' "$script" >&2
    exit 1
  fi
}

require_test_class() {
  local class="$1"
  if ! rg -q "class ${class}\\b" server-modernized/src/test/java; then
    printf 'release validation entrypoint missing server test class: %s\n' "$class" >&2
    exit 1
  fi
}

require_doc_pattern() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  require_file "$file"
  if ! rg -q --pcre2 "$pattern" "$file"; then
    printf 'release validation entrypoint missing %s in %s\n' "$description" "$file" >&2
    exit 1
  fi
}

required_files=(
  docs/runbooks/release-validation.md
  docs/testing/ehr-orca-required-test-matrix.md
  docs/validation/release-validation-report.md
  docs/contracts/orca-route-taxonomy.md
  docs/contracts/orca-ledger-and-unknown-state.md
  docs/contracts/protected-export-authorization-matrix.md
  docs/runbooks/backup-restore-hash-verification.md
  docs/operations/orca-unknown-state-runbook.md
  scripts/ci/verify-ehr-orca-round3-guards.sh
  server-modernized/tools/ci/check-doc-links.sh
  server-modernized/tools/ci/check-config-contract.sh
  server-modernized/tools/ci/check-no-direct-runtime-lookup.sh
  server-modernized/tools/ci/check-no-legacy-disease-authority.sh
  server-modernized/tools/ci/check-finalized-write-guards.sh
  server-modernized/tools/ci/check-orca-transport-boundary.sh
  server-modernized/tools/ci/check-orca-retry-recovery-contract.sh
  server-modernized/tools/ci/check-sensitive-evidence-redaction.sh
  server-modernized/tools/ci/check-backup-restore-runbook.sh
  server-modernized/tools/ci/check-live-orca-trial-harness.sh
  ops/tests/orca/live-trial-checklist.sh
  scripts/create-reviewer-submission-packet.sh
  scripts/validate-reviewer-submission-packet.sh
)

for file in "${required_files[@]}"; do
  require_executable_or_file "$file"
done

required_npm_scripts=(
  verify:web-guard
  verify:no-public-secrets
  verify:no-blocked-orca-route-strings
  verify:no-direct-orca-proxy-config
  verify:no-local-patient-mutation
  verify:medical-safety-ui-copy
  verify:prod-bundle-secrets
  typecheck
  test:ci
  ci
)

for script in "${required_npm_scripts[@]}"; do
  require_package_script "$script"
done

required_test_classes=(
  PublicRouteInventoryContractTest
  WebXmlEndpointExposureTest
  OrcaOperationLedgerSchemaTest
  OrcaOperationLedgerRepositoryTest
  OrcaHttpClientResilienceTest
  PatientModV2OutpatientResourceIdempotencyTest
  OrcaBillingCorrectionScenarioSupportTest
  ChartFinalizeSnapshotResolverTest
  KarteRevisionSnapshotContractTest
  KarteDocumentSnapshotContractTest
  LocalPrescriptionOrderResourceTest
  PrescriptionAuthorityResourceTest
  PrescriptionAuthoritySchemaTest
  OrcaDiseaseOperationStoreTest
  OrcaDiseaseCacheStoreTest
  OrcaDiseaseQuerySupportTest
  OrcaReportDocumentResourceTest
  OperationsHealthResourceTest
  AuditHashServiceTest
)

for class in "${required_test_classes[@]}"; do
  require_test_class "$class"
done

require_doc_pattern docs/runbooks/release-validation.md 'validation/release-validation-report\.md' 'release validation report template link'
require_doc_pattern docs/runbooks/release-validation.md 'check-sensitive-evidence-redaction\.sh' 'sensitive evidence gate'
require_doc_pattern docs/runbooks/release-validation.md 'check-live-orca-trial-harness\.sh' 'live ORCA harness gate'
require_doc_pattern docs/runbooks/release-validation.md 'verify-release-validation-entrypoints\.sh --dry-run' 'entrypoint dry-run command'
require_doc_pattern docs/testing/ehr-orca-required-test-matrix.md 'verify-release-validation-entrypoints\.sh --dry-run' 'Round 4 release entrypoint hook'
require_doc_pattern docs/validation/release-validation-report.md 'GO / NO-GO / PENDING' 'decision status field'
require_doc_pattern docs/validation/release-validation-report.md 'raw ORCA body' 'raw ORCA evidence prohibition'
require_doc_pattern docs/validation/release-validation-report.md 'Export security / readability' 'H merge export gate placeholder'
require_doc_pattern docs/validation/release-validation-report.md 'Live ORCA validation checklist' 'J live validation gate placeholder'

if [[ "$DRY_RUN" -eq 1 ]]; then
  cat <<'EOF'
release validation entrypoint dry-run passed

Standard final gate command order:
1. bash scripts/ci/verify-release-validation-entrypoints.sh --dry-run
2. bash server-modernized/tools/ci/check-doc-links.sh
3. bash server-modernized/tools/ci/check-config-contract.sh
4. bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
5. bash scripts/ci/verify-ehr-orca-round3-guards.sh
6. bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
7. cd web-client && npm run verify:web-guard
8. cd web-client && npm run typecheck
9. focused Maven tests for route inventory, ledger/UNKNOWN, snapshot, disease, prescription hash chain, export/report
10. H/J post-merge gates: export readability/security, backup/restore guard, live ORCA dry-run checklist
EOF
fi
