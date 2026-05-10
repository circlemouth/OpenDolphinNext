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

if [[ ! -f "$AUDIT_REPOSITORY" ]]; then
  echo "authoritative audit repository missing: $AUDIT_REPOSITORY" >&2
  exit 1
fi

if [[ ! -f "$AUDIT_VERIFIER" ]]; then
  echo "audit hash-chain verifier missing: $AUDIT_VERIFIER" >&2
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

echo "audit append-only guard passed"
