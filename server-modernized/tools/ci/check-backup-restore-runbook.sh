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

RUNBOOK="docs/runbooks/backup-restore-hash-verification.md"
RELEASE_VALIDATION="docs/runbooks/release-validation.md"
ORCA_OUTAGE="docs/runbooks/orca-outage-recovery.md"
AUDIT_CONTRACT="docs/contracts/audit-log.md"

required_files=("$RUNBOOK" "$RELEASE_VALIDATION" "$ORCA_OUTAGE" "$AUDIT_CONTRACT")
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'backup/restore guard missing required file: %s\n' "$file" >&2
    exit 1
  fi
done

require_pattern() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if ! rg -q --pcre2 "$pattern" "$file"; then
    printf 'backup/restore guard missing %s in %s\n' "$description" "$file" >&2
    exit 1
  fi
}

require_pattern "$RUNBOOK" 'AuditChainVerifier\.verifyAll\(\)' 'audit hash-chain verification gate'
require_pattern "$RUNBOOK" 'content hash verification' 'chart/prescription content hash verification gate'
require_pattern "$RUNBOOK" 'read-only mode' 'restore read-only mode boundary'
require_pattern "$RUNBOOK" 'ORCA re-alignment' 'ORCA re-alignment procedure'
require_pattern "$RUNBOOK" 'Do not auto-resend after restore' 'post-restore resend fail-closed rule'
require_pattern "$RUNBOOK" 'raw ORCA body|raw XML' 'raw ORCA evidence prohibition'
require_pattern "$RUNBOOK" 'HAR, trace, video, screenshot' 'browser artifact prohibition'
require_pattern "$RUNBOOK" 'patient name, address, phone number' 'PHI evidence prohibition'
require_pattern "$RUNBOOK" 'check-backup-restore-runbook\.sh' 'self-check verification command'

require_pattern "$RELEASE_VALIDATION" 'backup-restore-hash-verification\.md' 'release validation link to backup/restore runbook'
require_pattern "$RELEASE_VALIDATION" 'check-backup-restore-runbook\.sh' 'release validation backup/restore guard command'
require_pattern "$ORCA_OUTAGE" 'backup-restore-hash-verification\.md' 'outage recovery link to backup/restore runbook'
require_pattern "$AUDIT_CONTRACT" 'backup-restore-hash-verification\.md' 'audit contract link to backup/restore runbook'

printf 'backup/restore hash verification guard passed\n'
