# NEXT_WORKER_PROMPT

status: blocked_existing_acceptance_target_drift_before_order_panel_validation
created_at: 2026-04-29T11:43:30Z
updated_at: 2026-04-29T20:05:00Z
source_work_order: RWO-08B
blocker_id: rwo08b-existing-acceptance-target-drift-before-order-panel-validation
priority: high
supersedes:
- rwo08b-existing-acceptance-visible-entry-handoff-blocker
- rwo08b-existing-acceptance-charts-order-panel-blocker

## Context

RUN_ID `20260429T113103Z` repaired the narrowed Web/QA existing ORCA acceptance handoff blocker.
RUN_ID `20260429T194551Z` repaired the diagnostic harness order-editor opening path for the current Charts UI, but the required existing-acceptance target had drifted before the fix could be validated by Fullflow.

Tracked sanitized evidence:

- `docs/implementation/rwo08b-existing-acceptance-handoff-20260429T113103Z/summary.sanitized.json`
- `docs/implementation/rwo08b-existing-acceptance-handoff-20260429T113103Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-charts-order-panel-20260429T194551Z/summary.sanitized.json`
- `docs/implementation/rwo08b-charts-order-panel-20260429T194551Z/FINAL_REPORT.md`

Local-only diagnostic artifact root, not reviewer evidence:

- `artifacts/diagnostic-fullflow/20260429T113103Z/fullflow/`
- `artifacts/diagnostic-fullflow/20260429T194551Z/fullflow/`

Do not commit, package, paste, or reviewer-submit screenshots, HAR, traces, videos, raw network artifacts, raw ORCA request/response bodies, raw patient details, raw insurance details, request XML, cookies, sessions, Authorization headers, CSRF values, credentials, or credential-bearing URLs.

## Current State

The patient-search existing-acceptance handoff candidate can resolve from a complete server-derived `visits` row for target patient `00002`, even when the rendered status is `予約`, when a current ready existing-acceptance row is present.

The fix preserves fail-closed authority boundaries:

- patient ID alone is not authority;
- client-provided identifiers are not authority;
- `source=visits` and complete official visit identifiers are required;
- multiple complete official visit rows fail closed;
- reservation/snapshot rows are not promoted to official visit authority.

Focused checks passed:

- `node --check scripts/qa-fullflow-weborca.mjs`
- `node --check scripts/qa-lib/medical-information-gate.mjs`
- `cd web-client && npm test -- --run src/features/reception/__tests__/receptionHandoff.test.ts src/features/reception/__tests__/ReceptionPage.test.tsx scripts/__tests__/medicalInformationGate.test.ts`
  - 89 tests passed, including web guard pretest.

Runtime was restarted with:

- `OPENDOLPHIN_RUNTIME_PROFILE=orca-trial-no-object-storage WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`

The diagnostic Fullflow attempt for target `00002` in RUN_ID `20260429T113103Z` showed:

- `handoffMode=existing-acceptance`;
- Charts handoff ready with schedule key and encounter key present;
- accept mutation was not observed;
- medical information gate passed with 0 violations and 0 target mutation requests;
- `visitRowReadiness=ready`;
- Charts opened, but `treatmentOrder-edit-panel` did not become visible before timeout;
- order send did not reach a sanitized business-success classification.

## Remaining Blocker

RUN_ID `20260429T194551Z` then repaired the Charts-side harness path:

- legacy `order-dock-group-add-*` is still supported;
- the current SoapNote right utility dock/drawer `新規作成を開く` path is now supported;
- the old keyboard shortcut path remains only as a fallback.

The post-fix diagnostic attempt could not validate the order panel repair because the existing-acceptance precondition drifted:

- intended mode: `existing-acceptance`;
- actual mode: accept mutation after existing-acceptance unavailable;
- charts handoff ready but schedule key absent;
- `visitRowReadiness=missing_official_visit_identifiers`;
- send button disabled by `missing_encounter_context`;
- order-send business success not reached.

The current blocker is target/precondition drift before order-panel validation:

`blocked_target_drift_before_order_panel_validation`

Do not rerun unchanged diagnostic Fullflow until a fresh read-only target-readiness pass proves a non-duplicate existing-acceptance target with both schedule key and encounter key and `visitRowReadiness=ready`.

## Required Boundary

Do not trust patient ID alone, browser UI state alone, local storage state, or client-provided identifiers as authority.

Do not treat Charts navigation, HTTP 200, wrapper exit 0, diagnostic completion, a visible send button, or local browser state as Fullflow L4 success. Fullflow success still requires endpoint-specific sanitized business evidence after the order-send path reaches the intended ORCA endpoint.

## Next Safe Work

Refresh the RWO-08B existing-acceptance target readiness before any further diagnostic Fullflow attempt.

Required next steps:

1. Run a safe read-only target-readiness/candidate discovery path for a non-duplicate WebORCA Trial target.
2. Proceed to diagnostic Fullflow only if the selected target has current existing-acceptance handoff readiness with schedule key and encounter key present and `visitRowReadiness=ready`.
3. If readiness is proven, rerun exactly one diagnostic Fullflow attempt under local-only artifact containment to validate the repaired current right-utility drawer order editor path.
4. If readiness is not proven, record a sanitized target-drift/test-data blocker and continue to independent no-live work.

## Forbidden Actions

- Do not print or commit secret values, ORCA credentials, encrypted credential material, cookies, sessions, Authorization headers, CSRF values, raw ORCA bodies, raw patient details, raw insurance details, HAR, traces, videos, screenshots, request XML, raw network dumps, or credential-bearing URLs.
- Do not run production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, dummy object storage, or object-storage readiness claims.
- Do not change legacy `client/` or `server/`.
- Do not repeat unchanged live or diagnostic Trial sends, especially while the existing-acceptance target readiness is unproven.
- Do not use patient ID alone, browser UI state, local storage state, or client-provided identifiers as authority.

## Completion Criteria

This prompt may be marked `completed` only when one of these is true:

- diagnostic Fullflow reaches a sanitized order-send classification after a fresh proven existing-acceptance handoff; or
- a narrower target-readiness/test-data blocker is recorded with sanitized evidence and no raw artifacts.
