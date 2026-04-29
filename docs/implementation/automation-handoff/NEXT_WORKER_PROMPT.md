# NEXT_WORKER_PROMPT

status: blocked_charts_order_panel_after_existing_acceptance_handoff
created_at: 2026-04-29T11:43:30Z
updated_at: 2026-04-29T11:43:30Z
source_work_order: RWO-08B
blocker_id: rwo08b-existing-acceptance-charts-order-panel-blocker
priority: high
supersedes:
- rwo08b-existing-acceptance-visible-entry-handoff-blocker

## Context

RUN_ID `20260429T113103Z` repaired the narrowed Web/QA existing ORCA acceptance handoff blocker.

Tracked sanitized evidence:

- `docs/implementation/rwo08b-existing-acceptance-handoff-20260429T113103Z/summary.sanitized.json`
- `docs/implementation/rwo08b-existing-acceptance-handoff-20260429T113103Z/FINAL_REPORT.md`

Local-only diagnostic artifact root, not reviewer evidence:

- `artifacts/diagnostic-fullflow/20260429T113103Z/fullflow/`

Do not commit, package, paste, or reviewer-submit screenshots, HAR, traces, videos, raw network artifacts, raw ORCA request/response bodies, raw patient details, raw insurance details, request XML, cookies, sessions, Authorization headers, CSRF values, credentials, or credential-bearing URLs.

## Current State

The patient-search existing-acceptance handoff candidate now resolves from a complete server-derived `visits` row for target patient `00002`, even when the rendered status is `予約`.

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

The diagnostic Fullflow attempt for target `00002` showed:

- `handoffMode=existing-acceptance`;
- Charts handoff ready with schedule key and encounter key present;
- accept mutation was not observed;
- medical information gate passed with 0 violations and 0 target mutation requests;
- `visitRowReadiness=ready`;
- Charts opened, but `treatmentOrder-edit-panel` did not become visible before timeout;
- order send did not reach a sanitized business-success classification.

## Remaining Blocker

The current blocker is Charts-side or harness-side after successful existing-acceptance navigation:

`blocked_before_order_send_charts_order_panel`

The diagnostic reached Charts through canonical handoff, but the order edit panel for `treatmentOrder` did not become visible before timeout. Do not rerun unchanged diagnostic Fullflow until a concrete repo-local fix or changed precondition exists.

## Required Boundary

Do not trust patient ID alone, browser UI state alone, local storage state, or client-provided identifiers as authority.

Do not treat Charts navigation, HTTP 200, wrapper exit 0, diagnostic completion, a visible send button, or local browser state as Fullflow L4 success. Fullflow success still requires endpoint-specific sanitized business evidence after the order-send path reaches the intended ORCA endpoint.

## Next Safe Work

Inspect the Charts-side order selection/edit-panel path used by `web-client/scripts/qa-fullflow-weborca.mjs` after existing-acceptance handoff. Likely areas:

- order entity selection for `treatmentOrder`;
- opening or rendering `[data-test-id="treatmentOrder-edit-panel"]`;
- existing-acceptance handoff tab initialization and active patient context;
- whether a selected bundle/master row prerequisite is missing;
- whether the diagnostic script needs a server-derived, non-secret precondition before opening the edit panel.

Implement the smallest repo-local fix in `web-client/` so the diagnostic can reach a sanitized order-send classification, or record a narrower repo-local blocker if another specific gate is found.

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

- diagnostic Fullflow reaches a sanitized order-send classification after existing-acceptance handoff; or
- a narrower repo-local blocker is recorded after a concrete code fix or changed precondition, with sanitized evidence explaining the next repair.
