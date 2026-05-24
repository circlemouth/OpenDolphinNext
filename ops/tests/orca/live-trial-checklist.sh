#!/usr/bin/env bash
set -euo pipefail

MODE="dry-run"
RUN_ID_VALUE="${RUN_ID:-}"
ROOT=""

usage() {
  cat <<'USAGE'
Usage: ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID> [--root <repo-root>]

Builds a sanitized WebORCA Trial execution checklist for release validation.
This harness does not print ORCA credential values, raw ORCA bodies, HAR, trace,
video, screenshots, or patient details.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --run-id)
      RUN_ID_VALUE="${2:-}"
      shift 2
      ;;
    --root)
      ROOT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel)"
fi
cd "$ROOT"

if [[ "$MODE" != "dry-run" ]]; then
  printf 'live trial checklist currently supports dry-run only; use the existing QA scripts for approved live execution\n' >&2
  exit 2
fi

if [[ -z "$RUN_ID_VALUE" ]]; then
  printf 'RUN_ID is required. Pass --run-id <YYYYMMDDThhmmssZ> or export RUN_ID.\n' >&2
  exit 2
fi

if [[ ! "$RUN_ID_VALUE" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
  printf 'RUN_ID must match YYYYMMDDThhmmssZ: %s\n' "$RUN_ID_VALUE" >&2
  exit 2
fi

required_paths=(
  "web-client/scripts/runtime-ready-smoke.mjs"
  "web-client/scripts/qa-weborca-candidate-discovery.mjs"
  "web-client/scripts/qa-weborca-readonly-preflight.mjs"
  "web-client/scripts/qa-acceptmodv2-weborca.mjs"
  "web-client/scripts/qa-fullflow-weborca.mjs"
  "web-client/scripts/qa-phase4-safe-medicalmodv2.mjs"
  "docs/setup-and-validation.md"
  "docs/security-and-orca.md"
  "server-modernized/tools/ci/check-sensitive-evidence-redaction.sh"
)

for path in "${required_paths[@]}"; do
  if [[ ! -e "$path" ]]; then
    printf 'missing required live trial checklist dependency: %s\n' "$path" >&2
    exit 1
  fi
done

status_of() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf 'set'
  else
    printf 'unset'
  fi
}

cat <<EOF
WebORCA Trial release checklist dry-run
RUN_ID=${RUN_ID_VALUE}
repo=<repo-root>
branch=$(git branch --show-current)
mode=${MODE}

Sanitized runtime input status:
- ORCA_ENV_FILE=$(status_of ORCA_ENV_FILE)
- ORCA_API_USER=$(status_of ORCA_API_USER)
- ORCA_API_PASSWORD=$(status_of ORCA_API_PASSWORD)
- ORCA_BASE_URL=$(status_of ORCA_BASE_URL)
- ORCA_API_HOST=$(status_of ORCA_API_HOST)
- ORCA_API_SCHEME=$(status_of ORCA_API_SCHEME)
- ORCA_API_PORT=$(status_of ORCA_API_PORT)
- QA_PATIENT_ID=$(status_of QA_PATIENT_ID)
- QA_READONLY_PREFLIGHT_SUMMARY=$(status_of QA_READONLY_PREFLIGHT_SUMMARY)
- QA_READONLY_PREFLIGHT_SHA256=$(status_of QA_READONLY_PREFLIGHT_SHA256)
- QA_EXPECTED_INPUT_IDENTITY_SHA256=$(status_of QA_EXPECTED_INPUT_IDENTITY_SHA256)

Required sanitized sequence:
1. OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
2. RUN_ID=${RUN_ID_VALUE} cd web-client && node scripts/runtime-ready-smoke.mjs
3. curl -sk https://127.0.0.1:8443/openDolphin/api/orca/official/appointments/medical-information
4. RUN_ID=${RUN_ID_VALUE} cd web-client && node scripts/qa-weborca-candidate-discovery.mjs
5. RUN_ID=${RUN_ID_VALUE} QA_PATIENT_ID=<selectedCandidatePatientId> cd web-client && node scripts/qa-weborca-readonly-preflight.mjs
6. RUN_ID=${RUN_ID_VALUE} QA_PHASE3_APPROVED_MODE=1 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_PATIENT_ID=<phase3AttemptPatientId> cd web-client && node scripts/qa-acceptmodv2-weborca.mjs
7. RUN_ID=${RUN_ID_VALUE} QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_PATIENT_ID=<phase3AttemptPatientId> cd web-client && node scripts/qa-fullflow-weborca.mjs
8. RUN_ID=${RUN_ID_VALUE} cd web-client && node scripts/qa-phase4-safe-medicalmodv2.mjs --execute-approved-phase4 --sanitized-evidence-only --disable-browser-artifacts --phase4-only --workflow <approved-workflow> --payload <approved-json> --payload-sha256 <approved-sha256>
9. bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "<repo-root>"

Evidence roots:
- artifacts/orca-remediation/closeout/${RUN_ID_VALUE}/qa/runtime-ready/
- artifacts/orca-remediation/closeout/${RUN_ID_VALUE}/qa/weborca-candidate-discovery/
- artifacts/orca-remediation/closeout/${RUN_ID_VALUE}/qa/weborca-readonly-preflight/
- artifacts/orca-remediation/closeout/${RUN_ID_VALUE}/qa/acceptmodv2/
- artifacts/orca-remediation/closeout/${RUN_ID_VALUE}/qa/fullflow/
- artifacts/orca-connectivity/${RUN_ID_VALUE}/

Hard stops:
- no raw ORCA body/XML, request XML, HAR, trace, video, screenshot, error-context.md, raw network JSON in tracked or reviewer evidence
- no ORCA credentials, Cookie, Authorization, JSESSIONID, CSRF, certificate material, patient name, address, phone number, insurance identifier in evidence
- candidate discovery is only a proposal; exact read-only preflight with matching hash/input identity is required before mutation
- HTTP 200 or generic zero-like apiResult alone is not mutation success
- live mutation success must have endpoint-specific completion evidence and sanitized summary
EOF
