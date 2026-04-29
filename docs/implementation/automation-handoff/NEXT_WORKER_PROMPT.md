# NEXT_WORKER_PROMPT

status: blocked_duplicate_acceptance_official_identifiers_after_medical_row_reconciliation
created_at: 2026-04-29T21:58:00Z
updated_at: 2026-04-29T21:58:00Z
source_work_order: RWO-08B
blocker_id: rwo08b-duplicate-acceptance-official-identifiers-still-missing-after-medical-row-reconciliation
priority: high
supersedes:
- rwo08b-duplicate-acceptance-after-fresh-readiness-before-order-panel-validation

## Context

RUN_ID `20260429T215140Z` continued RWO-08B after duplicate acceptmodv2 `Api_Result=16` blocked Fullflow before Charts order-send validation.

Tracked sanitized evidence:

- `docs/implementation/rwo08b-duplicate-acceptance-medical-row-20260429T215140Z/summary.sanitized.json`
- `docs/implementation/rwo08b-duplicate-acceptance-medical-row-20260429T215140Z/FINAL_REPORT.md`

Local-only diagnostic artifacts, not reviewer evidence:

- `artifacts/diagnostic-fullflow/20260429T212039Z/`
- `artifacts/diagnostic-fullflow/20260429T213555Z/`
- `artifacts/diagnostic-fullflow/20260429T215140Z/`

Do not commit, package, paste, or reviewer-submit screenshots, HAR, traces, videos, raw network artifacts, raw ORCA request/response bodies, raw patient details, raw insurance details, request XML, cookies, sessions, Authorization headers, CSRF values, credentials, or credential-bearing URLs.

## Current State

Repo-local fixes were implemented and tested:

- server-modernized duplicate acceptmodv2 `Api_Result=16` reconciliation reads server-derived acceptlstv2 inventory before handoff;
- server-modernized medicalgetv2 identifier preflight can carry server-only `Invoice_Number` for duplicate acceptance reconciliation;
- web-client reception handoff, navigation state, and Charts encounter context preserve official identifier fields only when complete;
- focused tests cover duplicate acceptance reconciliation, official identifier propagation, and fail-closed ambiguity.

Focused checks passed:

- web focused Vitest set: 112 passed, 1 skipped;
- `mvn -f api-contract/pom.xml install -DskipTests && mvn -pl server-modernized -Dtest=OrcaVisitResourceTest test`: 28 passed;
- `docker compose -f docker-compose.modernized.dev.yml build server-modernized-dev`: passed.

Latest read-only Trial gates in RUN_ID `20260429T215140Z` were ready:

- candidate discovery selected one target;
- exact selected-candidate preflight accepted;
- acceptlstv2 inventory classified `readonly_inventory_target_ready`;
- identifier preflight classified `readonly_identifier_preflight_target_ready`;
- `medicalReadyRowCount=1`;
- `visitReadyRowCount=0`.

Three fix-and-retry cycles were consumed by the worker:

- `20260429T212039Z`
- `20260429T213555Z`
- `20260429T215140Z`

The latest diagnostic Fullflow still blocked:

- acceptmodv2 mutation observed HTTP `2xx`;
- ORCA `Api_Result=16`;
- business classification `business_rejected_duplicate_acceptance`;
- mutation response had server-derived acceptance/encounter fields and insurance combination;
- mutation response still omitted `voucherNumber` and `sequentialNumber`;
- Charts ORCA send stayed disabled with `missing_encounter_context`;
- no request XML was created;
- medicalmodv2 was not executed.

## Required Boundary

Do not run another live Trial mutation under the current approval window. The current worker already consumed three fix-and-retry cycles for this task.

Do not trust patient ID alone, browser UI state alone, local storage state, or client-provided identifiers as authority.

Do not treat Charts navigation, HTTP 200, wrapper exit 0, diagnostic completion, a visible send button, or local browser state as Fullflow L4 success.

## Next Safe Work

Perform no-live/unit/contract investigation first:

1. Add focused unit or contract coverage around live-shaped `MedicalIdentifierPreflightResponse` rows to reproduce why duplicate acceptance reconciliation does not serialize `voucherNumber` and `sequentialNumber` in the runtime mutation response.
2. Inspect the server runtime reconciliation path from `acceptlstv2` selected row through `medicalgetv2` medical row fallback without using raw ORCA bodies in tracked evidence.
3. If a repo-local defect is found, fix it and verify with no-live tests only.
4. Obtain a new explicit owner-approved retry scope or a new handoff prompt before another live Trial Fullflow mutation attempt.

## Forbidden Actions

- Do not run another live Trial mutation from this handoff without new approval/scope.
- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not run production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not use patient ID alone, browser UI state, local storage state, or client-provided identifiers as authority.

## Completion Criteria

This prompt may be marked `completed` only when no-live tests prove the missing identifier serialization root cause is fixed and a new owner-approved live retry scope is available, or when an even narrower no-live blocker is recorded with sanitized evidence and no raw artifacts.
