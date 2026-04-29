# NEXT_WORKER_PROMPT

status: blocked_web_existing_acceptance_visible_entry_handoff
created_at: 2026-04-29T11:04:10Z
updated_at: 2026-04-29T11:04:10Z
source_work_order: RWO-08B
blocker_id: rwo08b-existing-acceptance-visible-entry-handoff-blocker
priority: high
supersedes:
- rwo08b-existing-orca-acceptance-web-handoff-blocker

## Context

RUN_ID `20260429T104910Z` implemented a partial repo-local fix for the existing ORCA GUI-created acceptance handoff path:

- `web-client/src/features/reception/receptionHandoff.ts`
- `web-client/src/features/reception/__tests__/receptionHandoff.test.ts`
- `web-client/scripts/qa-fullflow-weborca.mjs`
- `web-client/scripts/qa-lib/medical-information-gate.mjs`

Sanitized tracked evidence:

- `docs/implementation/rwo08b-existing-acceptance-handoff-20260429T104910Z/summary.sanitized.json`
- `docs/implementation/rwo08b-existing-acceptance-handoff-20260429T104910Z/FINAL_REPORT.md`

Local-only diagnostic artifact roots, not reviewer evidence:

- `artifacts/diagnostic-fullflow/20260429T104910Z/fullflow/`
- `artifacts/diagnostic-fullflow/20260429T110100Z/fullflow/`

Do not commit, package, paste, or reviewer-submit screenshots, HAR, traces, videos, raw network artifacts, raw ORCA request/response bodies, raw patient details, raw insurance details, request XML, cookies, sessions, Authorization headers, CSRF values, credentials, or credential-bearing URLs.

## Current State

The previous ORCA-side identifier/readiness blocker remains cleared for target patient `00002` based on prior same-run sanitized read-only target-readiness evidence. The latest repair added fail-closed logic for choosing exactly one complete server-derived official visit row when multiple active keyed entries exist.

Focused checks passed:

- `node --check scripts/qa-fullflow-weborca.mjs`
- `node --check scripts/qa-lib/medical-information-gate.mjs`
- `cd web-client && npm test -- --run src/features/reception/__tests__/receptionHandoff.test.ts scripts/__tests__/medicalInformationGate.test.ts`
  - 38 tests passed, including web guard pretest.

Runtime was restarted with:

- `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`

## Remaining Blocker

Diagnostic Fullflow still blocks before order send. The newer retry RUN_ID `20260429T110100Z` showed:

- patient-search existing handoff candidate stayed disabled;
- sanitized title classification: `no_active_entry`;
- accept mutation was still observed with sanitized `apiResult=90`;
- order send did not run;
- request XML was not created.

However, sanitized `visits/list` shape from the same diagnostic run showed:

- `recordsReturned=3`;
- target patient rows for `00002`: `2`;
- complete target rows with server-derived official identifiers: `1`;
- the complete target row had patientId, visitDate, departmentCode, voucherNumber, sequentialNumber, insuranceCombinationNumber, scheduleKey, and encounterKey.

Therefore the narrowed repo-local blocker is: the complete server-derived `visits/list` target row exists, but the patient-search modal handoff candidate still receives no active entry and falls back to duplicate accept mutation.

## Required Boundary

Do not trust patientId alone. The next fix must use server-derived row fields from the reception/visits result or a server-derived hydration path. If multiple complete official target rows exist, fail closed.

Do not rerun unchanged diagnostic Fullflow. A changed repo-local precondition or code fix is required first.

Do not treat target-readiness, HTTP 200, wrapper exit 0, accept mutation transport success, dry-run, UI state, or local browser state as Fullflow L4 success. Fullflow success still requires endpoint-specific sanitized business evidence after the order-send path reaches the intended ORCA endpoint.

## Next Safe Work

Inspect why `resolvePatientChartsHandoff({ entries: displayedEntries })` is not seeing the complete target row even though `visits/list` contains one. Likely areas:

- `fetchAppointmentOutpatients` / `parseAppointmentEntries` to `visibleAppointmentEntries` propagation;
- `filterEntries` / payment/status/date filters before `displayedEntries`;
- patient-search modal result selection timing and state dependencies;
- any snapshot/live-entry replacement that drops visits rows before the modal candidate resolves.

Implement the smallest repo-local fix so the complete server-derived target row is bridged into the patient-search handoff candidate, or add a QA-only server-derived handoff hydration path that uses the same server-derived complete-row criteria and does not trust patientId alone.

After a concrete fix:

1. Run focused unit/script checks.
2. Restart the local Trial/no-object-storage runtime if browser code or dev server state may be stale.
3. Rerun exactly one diagnostic Fullflow attempt for target `00002` under local-only artifact containment.
4. Record sanitized summary only.

## Forbidden Actions

- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not run production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not repeat unchanged live or diagnostic Trial sends.
- Do not use patient ID alone, browser UI state, local storage state, or client-provided identifiers as authority.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- the complete server-derived existing ORCA acceptance row is safely handed off into active local reception/charts state, and diagnostic Fullflow reaches a sanitized order-send classification; or
- a narrower repo-local blocker is recorded after a concrete code fix or changed precondition, with sanitized evidence explaining the next repair.
