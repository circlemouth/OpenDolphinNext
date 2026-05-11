#!/usr/bin/env bash
set -euo pipefail

ROOT=""
if [[ "${1:-}" == "--root" ]]; then
  ROOT="${2:-}"
fi
if [[ -z "$ROOT" ]]; then
  ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
fi

AUDIT_REPOSITORY="$ROOT/server-modernized/src/main/java/open/dolphin/security/audit/AuthoritativeAuditRepository.java"
AUDIT_VERIFIER="$ROOT/server-modernized/src/main/java/open/dolphin/security/audit/AuditChainVerifier.java"
AUDIT_CONTRACT="$ROOT/docs/contracts/audit-log.md"
AUDIT_INVENTORY="$ROOT/docs/contracts/audit-event-coverage-inventory.md"

if [[ ! -f "$AUDIT_REPOSITORY" ]]; then
  echo "authoritative audit repository missing: $AUDIT_REPOSITORY" >&2
  exit 1
fi

if [[ ! -f "$AUDIT_VERIFIER" ]]; then
  echo "audit hash-chain verifier missing: $AUDIT_VERIFIER" >&2
  exit 1
fi

if [[ ! -f "$AUDIT_CONTRACT" ]]; then
  echo "audit contract missing: $AUDIT_CONTRACT" >&2
  exit 1
fi

if [[ ! -f "$AUDIT_INVENTORY" ]]; then
  echo "audit event coverage inventory missing: $AUDIT_INVENTORY" >&2
  exit 1
fi

if ! rg -q "public AuditWriteResult append\\(" "$AUDIT_REPOSITORY"; then
  echo "authoritative audit repository must expose append(...) as the only write entrypoint" >&2
  exit 1
fi

if rg -n "public\\s+[^\\n]*(update|delete|remove|truncate)\\s*\\(" "$AUDIT_REPOSITORY"; then
  echo "authoritative audit repository exposes a public update/delete/remove/truncate method" >&2
  exit 1
fi

if ! rg -q "verifyAll\\(" "$AUDIT_VERIFIER"; then
  echo "audit hash-chain verifier must expose verifyAll()" >&2
  exit 1
fi

SCAN_ROOTS=(
  "$ROOT/server-modernized/src/main/java"
  "$ROOT/domain/src/main/java"
  "$ROOT/persistence/src/main/java"
  "$ROOT/api-contract/src/main/java"
  "$ROOT/reporting/src/main/java"
)

existing_roots=()
for scan_root in "${SCAN_ROOTS[@]}"; do
  if [[ -d "$scan_root" ]]; then
    existing_roots+=("$scan_root")
  fi
done

if [[ ${#existing_roots[@]} -eq 0 ]]; then
  echo "no production source roots found for audit append-only guard" >&2
  exit 1
fi

forbidden_pattern='(?i)\b(update|delete\s+from|truncate\s+table)\s+(opendolphin\.)?audit_event\b'
if rg -n --pcre2 "$forbidden_pattern" "${existing_roots[@]}"; then
  echo "audit_event must remain append-only; production code may not update/delete/truncate it" >&2
  exit 1
fi

required_event_labels=(
  "AUTH_LOGIN"
  "AUTH_LOGOUT"
  "AUTH_FAILURE"
  "AUTHZ_DENIED"
  "ADMIN_ROLE_CHANGE"
  "ADMIN_ACCOUNT_STATE_CHANGE"
  "PATIENT_READ"
  "CHART_SAVE"
  "CHART_FINALIZE"
  "CHART_REVISION"
  "PRESCRIPTION_FINALIZE"
  "PRESCRIPTION_CHANGE"
  "DOCUMENT_ATTACHMENT"
  "PROTECTED_EXPORT"
  "ORCA_PATIENT_READ"
  "ORCA_PATIENT_MUTATION"
  "ORCA_ACCEPTANCE_READ"
  "ORCA_INSURANCE_READ"
  "ORCA_DISEASE_MUTATION"
  "ORCA_MEDICAL_SEND"
  "ORCA_BILLING_READ"
  "ORCA_REPORT_CREATE"
  "ORCA_SEND_FAILURE"
  "AUDIT_CHAIN_VERIFY"
  "BACKUP_RESTORE_VERIFY"
)

if ! rg -q "Required Event Coverage" "$AUDIT_CONTRACT"; then
  echo "audit contract must define Required Event Coverage" >&2
  exit 1
fi

for label in "${required_event_labels[@]}"; do
  if ! rg -q "\\b${label}\\b" "$AUDIT_CONTRACT"; then
    echo "audit contract missing required event coverage label: $label" >&2
    exit 1
  fi
  if ! rg -q "\\b${label}\\b" "$AUDIT_INVENTORY"; then
    echo "audit event coverage inventory missing required label: $label" >&2
    exit 1
  fi
done

if ! rg -q "Coverage status" "$AUDIT_INVENTORY"; then
  echo "audit event coverage inventory must include Coverage status" >&2
  exit 1
fi

echo "audit append-only guard passed"
