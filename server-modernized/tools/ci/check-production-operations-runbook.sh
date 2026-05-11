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

RUNBOOK="docs/runbooks/production-operations-readiness.md"
RELEASE_VALIDATION="docs/runbooks/release-validation.md"
CUTOVER="docs/releases/orca-remediation-cutover.md"
ORCA_OUTAGE="docs/runbooks/orca-outage-recovery.md"
BACKUP_RESTORE="docs/runbooks/backup-restore-hash-verification.md"
REVIEWER_PACKET="docs/runbooks/reviewer-submission-packet.md"

required_files=(
  "$RUNBOOK"
  "$RELEASE_VALIDATION"
  "$CUTOVER"
  "$ORCA_OUTAGE"
  "$BACKUP_RESTORE"
  "$REVIEWER_PACKET"
)
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'production operations guard missing required file: %s\n' "$file" >&2
    exit 1
  fi
done

require_pattern() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if ! rg -q --pcre2 "$pattern" "$file"; then
    printf 'production operations guard missing %s in %s\n' "$description" "$file" >&2
    exit 1
  fi
}

require_pattern "$RUNBOOK" 'web-client and server-modernized pair release|deployed as a pair' 'pair release requirement'
require_pattern "$RUNBOOK" 'deployment secret store' 'secret-store-only credential boundary'
require_pattern "$RUNBOOK" '\/api\/health\/readiness' 'sanitized readiness pre-cutover check'
require_pattern "$RUNBOOK" 'auditLog\.status=UP|audit logging is unavailable' 'audit write path stop condition'
require_pattern "$RUNBOOK" 'object-storage-free Trial profile' 'production storage profile prohibition'
require_pattern "$RUNBOOK" 'AuditChainVerifier\.verifyAll\(\)' 'restore audit hash-chain verification'
require_pattern "$RUNBOOK" 'content hashes' 'chart/prescription content hash verification'
require_pattern "$RUNBOOK" 'ORCA_SENT.*ORCA_CONFIRMED.*ORCA_UNKNOWN.*ORCA_FAILED.*CORRECTION_REQUIRED' 'restored ORCA state non-authority rule'
require_pattern "$RUNBOOK" 'raw ORCA body.*raw XML|raw ORCA body/XML' 'raw ORCA evidence prohibition'
require_pattern "$RUNBOOK" 'Basic/Authorization/Cookie/JSESSIONID/CSRF' 'credential evidence prohibition'
require_pattern "$RUNBOOK" 'patient name.*address.*phone' 'PHI evidence prohibition'
require_pattern "$RUNBOOK" 'HAR, trace, video, screenshot' 'browser artifact prohibition'
require_pattern "$RUNBOOK" 'check-production-operations-runbook\.sh' 'self-check verification command'

require_pattern "$RELEASE_VALIDATION" 'production-operations-readiness\.md' 'release validation link to production operations runbook'
require_pattern "$RELEASE_VALIDATION" 'check-production-operations-runbook\.sh' 'release validation production operations guard command'
require_pattern "$CUTOVER" 'production-operations-readiness\.md|Production Operations Readiness' 'cutover link to production operations runbook'
require_pattern "$ORCA_OUTAGE" 'production-operations-readiness\.md|Production Operations Readiness' 'outage recovery link to production operations runbook'
require_pattern "$BACKUP_RESTORE" 'production-operations-readiness\.md|Production Operations Readiness' 'backup/restore link to production operations runbook'
require_pattern "$REVIEWER_PACKET" 'production-operations-readiness\.md|Production Operations Readiness' 'reviewer packet link to production operations runbook'

printf 'production operations runbook guard passed\n'
