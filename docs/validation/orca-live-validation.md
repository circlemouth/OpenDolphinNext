# ORCA Live Validation Plan

## Purpose

This plan defines the sanitized live ORCA / WebORCA validation flow for pre-production readiness. It does not grant permission to expose raw ORCA credentials, patient data, request/response bodies, screenshots, HAR, traces, videos, or raw network dumps.

Connection information is supplied from deployment secret store, `ORCA_ENV_FILE`, `./orca.env.local`, or `~/.config/opendolphin/orca.env`. Tracked evidence records only set/unset, fixed classification, hashes, counts, and blocker reason codes.

## Preconditions

1. Capture `RUN_ID`.
2. Confirm branch/commit and that `web-client` and `server-modernized` are tested as a pair.
3. Run the dry-run checklist:

```bash
ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>
```

4. Confirm `QA_SANITIZED_EVIDENCE_ONLY=1` and `QA_DISABLE_BROWSER_ARTIFACTS=1` are used for live QA scripts that support them.
5. Confirm live validation evidence root is under `artifacts/orca-remediation/closeout/<RUN_ID>/qa/` and remains untracked unless explicitly sanitized for reviewer packet.

## Endpoint Coverage Plan

| Area | ORCA API / route family | Validation intent | Evidence allowed |
| --- | --- | --- | --- |
| Patient read | `patientgetv2` | Exact patient existence, parsed API result, selected candidate identity. | status class, exact match boolean, response hash, raw sensitive excluded flag. |
| Patient mutation | `patientmodv2` create/update | Class-specific create/update with canonical re-fetch before local sync success. | operation id/hash, canonical re-fetch status, no raw patient detail. |
| Acceptance read | `acceptlstv2` / acceptance list | Server-derived acceptance inventory and cancellation/diff handling. | row count, target hash, status/warning class. |
| Acceptance mutation | `acceptmodv2` | Endpoint-specific business acceptance, not generic HTTP 200 success. | acceptance evidence presence flags, schedule/encounter key hashes. |
| Disease read | `diseasegetv2 class=01` | ORCA disease source-of-truth read and local candidate separation. | count, status class, response hash. |
| Disease mutation | `diseasev3` add/update/delete/outcome | ORCA warning/unmatch/error classification and audit linkage. | operation id, warning/unmatch class, request/response hashes. |
| Medical send | `medicalmodv2` | Server-derived encounter context, idempotency, duplicate prevention, no client voucher authority. | operation/transmission id, request hash, accepted/warning/rejected/UNKNOWN class. |
| Medical reconciliation | `tmedicalgetv2` | UNKNOWN resolution and temporary medical row comparison. | match/conflict classification, `resendBlocked`, no raw `Medical_Uid`. |
| Income/accounting | `incomeinfv2` and accounting/report reads | ORCA billing/report cache as ORCA-derived snapshot, not local truth. | row count, invoice/data id hash, storage upload status, no raw invoice/report body. |

## Failure Injection / Negative Validation

Validate these without leaving raw secrets or PHI:

- Communication断 / timeout: expect `NETWORK_FAILED` or `UNKNOWN`, no success display, no auto resend.
- Authentication failure: expect `AUTH_FAILED`, sanitized readiness failure, no Basic/Authorization in logs or evidence.
- Certificate abnormality / expiry: expect `CERT_FAILED`, no TLS bypass in production profile.
- Other terminal in use / ORCA busy: expect warning/conflict/UNKNOWN classification and review queue.
- UNKNOWN resolution: read-only re-fetch first, then explicit operator decision; no automatic resend while reconciliation is pending, blocked, unknown, conflict, unmatched, or needs review.

## Sanitization Rules

Allowed evidence:

- `RUN_ID`, command name, branch/commit hash, script version.
- set/unset secret classification.
- endpoint family, route template, HTTP status class, ORCA Api_Result class, fixed reason code.
- request hash, response hash, payload/content hash, row count, object count, sanitized operation id.
- blocker classification and `rawSensitiveFieldsExcluded=true`.

Forbidden evidence:

- ORCA URL, host, port with credential-bearing context, username/password, Basic header, Authorization, Cookie, JSESSIONID, CSRF.
- Certificate private key, certificate password, secret file content, sensitive secret path value.
- Raw ORCA body/XML/JSON, raw request XML, raw response body, raw report body.
- Patient name, address, phone number, insurance symbol/number/detail, raw invoice number, raw `Data_Id`, raw `Medical_Uid`, voucher, sequential number, insurance combination.
- Screenshot, HAR, trace, video, `error-context.md`, raw network JSON.

## Execution Order

Use the release validation order unless a current blocker stops the flow:

```bash
ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>
OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
cd web-client && node scripts/runtime-ready-smoke.mjs
cd web-client && node scripts/qa-weborca-candidate-discovery.mjs
cd web-client && QA_PATIENT_ID=<acceptedCandidatePatientId> node scripts/qa-weborca-readonly-preflight.mjs
cd web-client && QA_PHASE3_APPROVED_MODE=1 QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_PATIENT_ID=<phase3AttemptPatientId> node scripts/qa-acceptmodv2-weborca.mjs
cd web-client && QA_SANITIZED_EVIDENCE_ONLY=1 QA_DISABLE_BROWSER_ARTIFACTS=1 QA_PATIENT_ID=<phase3AttemptPatientId> node scripts/qa-fullflow-weborca.mjs
```

Run Phase 4 medicalmod or billing/report profiles only after the current release validation preconditions are satisfied and the exact script-specific approval gate is documented.

## Acceptance Criteria

- Live validation never treats HTTP 200, generic zero-like result, candidate discovery, local cache, or UI display alone as mutation success.
- Each mutation has endpoint-specific business acceptance evidence, ORCA ledger correlation, and sanitized request/response hashes.
- UNKNOWN, warning, unmatch, auth failure, certificate failure, communication failure, and busy/conflict flows remain reviewable and are not success.
- Evidence redaction guard passes before any reviewer packet or production readiness sign-off.

## Verification Commands

```bash
bash server-modernized/tools/ci/check-live-orca-trial-harness.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-doc-links.sh
```

