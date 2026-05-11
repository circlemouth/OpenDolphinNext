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

HARNESS="ops/tests/orca/live-trial-checklist.sh"
RELEASE_VALIDATION="docs/runbooks/release-validation.md"
ORCA_CERT="docs/operations/ORCA_CERTIFICATION_ONLY.md"

for file in "$HARNESS" "$RELEASE_VALIDATION" "$ORCA_CERT"; do
  if [[ ! -f "$file" ]]; then
    printf 'live ORCA trial guard missing required file: %s\n' "$file" >&2
    exit 1
  fi
done

require_pattern() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if ! rg -q --pcre2 "$pattern" "$file"; then
    printf 'live ORCA trial guard missing %s in %s\n' "$description" "$file" >&2
    exit 1
  fi
}

require_pattern "$HARNESS" 'QA_SANITIZED_EVIDENCE_ONLY=1' 'sanitized evidence execution flag'
require_pattern "$HARNESS" 'QA_DISABLE_BROWSER_ARTIFACTS=1' 'browser artifact disable flag'
require_pattern "$HARNESS" 'qa-weborca-candidate-discovery\.mjs' 'candidate discovery step'
require_pattern "$HARNESS" 'qa-weborca-readonly-preflight\.mjs' 'exact read-only preflight step'
require_pattern "$HARNESS" 'qa-acceptmodv2-weborca\.mjs' 'acceptmodv2 step'
require_pattern "$HARNESS" 'qa-fullflow-weborca\.mjs' 'fullflow step'
require_pattern "$HARNESS" 'qa-phase4-safe-medicalmodv2\.mjs' 'phase4 medicalmodv2 step'
require_pattern "$HARNESS" 'check-sensitive-evidence-redaction\.sh' 'sensitive evidence guard step'
require_pattern "$HARNESS" 'candidate discovery is only a proposal' 'candidate discovery non-authority warning'
require_pattern "$HARNESS" 'HTTP 200 or generic zero-like apiResult alone is not mutation success' 'business success warning'
require_pattern "$HARNESS" 'no raw ORCA body/XML' 'raw ORCA evidence prohibition'
require_pattern "$HARNESS" 'no ORCA credentials' 'credential evidence prohibition'
require_pattern "$HARNESS" 'patient name, address, phone number' 'PHI evidence prohibition'

require_pattern "$RELEASE_VALIDATION" 'live-trial-checklist\.sh --dry-run' 'release validation dry-run harness command'
require_pattern "$RELEASE_VALIDATION" 'QA_SANITIZED_EVIDENCE_ONLY=1' 'release validation sanitized evidence flag'
require_pattern "$RELEASE_VALIDATION" 'QA_DISABLE_BROWSER_ARTIFACTS=1' 'release validation browser artifact disable flag'
require_pattern "$ORCA_CERT" 'live-trial-checklist\.sh --dry-run' 'ORCA certification dry-run harness command'

printf 'live ORCA trial harness guard passed\n'
