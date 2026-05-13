# ORCA UNKNOWN Resolution Runbook

## Purpose

UNKNOWN means an ORCA operation cannot be proven successful or failed. UNKNOWN must not be displayed or operated as registered, reflected, finalized, completed, billed, or claim-ready.

This runbook is the operational counterpart of [../operations/orca-unknown-state-runbook.md](../operations/orca-unknown-state-runbook.md) and [../contracts/orca-ledger-and-unknown-state.md](../contracts/orca-ledger-and-unknown-state.md).

## Ownership And Deadlines

- Primary owner: on-duty clinic operations administrator or the delegated ORCA integration operator.
- Clinical reviewer: responsible physician or authorized clinical supervisor for chart/prescription/billing impact.
- Technical reviewer: server operations owner for transport, credential, certificate, DB, and audit-path failures.
- Initial triage deadline: same business day for clinical/billing impact, within 30 minutes for active consultation flow blockage.
- Resolution deadline: before end-of-day closeout when billing or prescription fulfillment may be affected; otherwise within the next operational review window.

## Required Context

Operators resolve UNKNOWN from server-side records only:

- `orca_operation`, `orca_transmission`, `orca_response_summary`, `orca_reconciliation_result`.
- Central audit trace id.
- Server-derived patient, encounter, chart revision, prescription order, acceptance, department, physician, insurance combination, and request hash labels.
- Immutable chart snapshot and prescription event hashes.

Do not accept client-provided patient, facility, voucher, sequential number, insurance combination, `Medical_Uid`, URL, raw XML, storage key, or digest as recovery authority.

## Resolution Steps

1. Confirm the target patient and encounter from server-derived context and patient mix-up prevention UI.
2. Confirm the source API, idempotency key, request hash, response hash if present, and UNKNOWN classification.
3. Confirm whether the operation affects chart finalization, prescription order state, ORCA disease, medical/billing send, income/accounting, or report retrieval.
4. Run read-only ORCA re-fetch for the endpoint-specific state:
   - `patientgetv2` for patient mutation uncertainty.
   - `acceptlstv2` / related acceptance read for reception uncertainty.
   - `diseasegetv2` for disease mutation uncertainty.
   - `tmedicalgetv2` for `medicalmodv2` / billing-send uncertainty.
   - income/accounting/report read API for billing/report uncertainty.
5. Compare ORCA re-fetch summary against the stored local snapshot, request hash, and expected target context.
6. Classify one outcome: `MATCHED`, `ORCA_ONLY`, `LOCAL_ONLY`, `UNMATCHED`, `CONFLICT`, `BLOCKED`, `NEEDS_REVIEW`, or still `UNKNOWN`.
7. Decide one explicit action: no resend, resend under same logical operation, create audited correction, manual ORCA-side review, or keep blocked.
8. Append audit event with operator, reviewer where applicable, fixed reason code, decision, and sanitized comparison summary.

## Resend / Manual Reconciliation Rules

- Resend is allowed only when the request hash and server-side snapshot are unchanged, ORCA re-fetch found no matching or conflicting registration, credentials/certificate/readiness are healthy, and duplicate registration risk has been reviewed.
- Resend appends a new `orca_transmission` under the same logical `orca_operation`.
- If the request content changed, create an audited correction or new candidate first. Do not mutate the prior request in place.
- If ORCA has matching or conflicting temporary medical rows, `Medical_Mode` / `Medical_Mode2` is non-open, or warning/unmatch needs review, set `resendBlocked=true`.
- Manual ORCA-side correction must be recorded as an external action summary with hashes/reason codes only; do not paste ORCA screens, raw patient detail, or credentials into evidence.

## UI And Communication

UI must show:

- UNKNOWN is not success.
- Target patient identifier allowed by clinical UI policy.
- Source API and last attempt time.
- `needsUserReview`, `resendBlocked`, and next required action.

UI must not show ORCA URL, Basic credential, certificate details, raw ORCA body, raw `Medical_Uid`, voucher, sequential number, patient address/phone, insurance detail, or stack trace.

## Verification

```bash
rg -n "UNKNOWN|resendBlocked|tmedicalgetv2|orca_reconciliation_result" docs/contracts docs/runbooks docs/operations server-modernized web-client
bash server-modernized/tools/ci/check-doc-links.sh
```

