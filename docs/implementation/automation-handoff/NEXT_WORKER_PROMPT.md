# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T06:12:00Z
updated_at: 2026-04-25T06:30:24Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-accepted-encounter-official-visit-identifiers-missing
priority: high
supersedes:
- owner-expanded-fullflow-disease-request-number-order-v2-scope

## Context

RUN_ID `20260425T055659Z` repaired the diagnostic fullflow harness gate:

- `web-client/scripts/qa-fullflow-weborca.mjs` now evaluates the acceptmodv2 identity gate against the current `QA_PATIENT_ID` instead of a fixed Phase 3 target.
- The harness no longer classifies every identity-gate failure as `medical_information_omission_violation`.
- `web-client/scripts/__tests__/medicalInformationGate.test.ts` covers the non-default fullflow diagnostic target case.
- Focused test passed: `npm run --prefix web-client test -- scripts/__tests__/medicalInformationGate.test.ts` (27 tests).
- `npm run --prefix web-client verify:web-guard` passed.
- `RUN_ID=20260425T055659Z node web-client/scripts/runtime-ready-smoke.mjs` passed.

Diagnostic fullflow was run under the Diagnostic Artifact Exception. Raw diagnostic output is local-only and gitignored under:

- `artifacts/diagnostic-fullflow/20260425T055659Z/fullflow`
- a second redacted target-specific subdirectory under `artifacts/diagnostic-fullflow/20260425T055659Z/`

Do not commit or package those diagnostic artifacts.

Sanitized evidence:

- `docs/implementation/rwo08b-fullflow-gate-repair-20260425T055659Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-fullflow-gate-repair-20260425T055659Z/summary.sanitized.json`

Current blocker:

- Smoke-local patient diagnostic fullflow: medical-information gate passed, but accept did not produce a canonical Charts handoff; classified as `blocked_test_data`.
- ORCA-searchable Trial dummy target diagnostic fullflow: Charts handoff became ready with a canonical encounter key, but no selected visit row was present, Charts send stayed disabled with `missing_encounter_context`, and the blocker is `official-visit-row-blocker` / `visit_row_official_identifiers_missing`.
- No `medicalmodv2` request XML was created. No L4 fullflow success is claimed.

RUN_ID `20260425T063024Z` landed a repo-local fix for the likely Charts-side hydration defect:

- `web-client/src/features/charts/orcaQueueSelection.ts` now exports `resolveReceptionEntryForEncounter`.
- `web-client/src/features/charts/pages/ChartsPage.tsx` uses that resolver for selected Reception entry resolution.
- If an exact handoff key match is projection-only but a single server-fetched official visit row for the same patient/date has complete `Insurance_Combination_Number`, `Voucher_Number`, and `Sequential_Number`, Charts uses the official row.
- Missing official identifiers and multiple official rows still fail closed; no client synthesis from canonical keys is allowed.
- Focused resolver tests passed (8 tests), `npm run --prefix web-client typecheck` passed, `npm run --prefix web-client verify:web-guard` passed, and `RUN_ID=20260425T063024Z node web-client/scripts/runtime-ready-smoke.mjs` passed.
- A diagnostic fullflow was run with the default Trial-native target under the Diagnostic Artifact Exception, but it stopped before canonical Charts handoff as `test-data-blocker` / `fatal_before_send`. It did not verify the repaired hydration path live, no request XML was created, and no L4 success is claimed.

Sanitized evidence:

- `docs/implementation/rwo08b-visit-row-hydration-20260425T063024Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-visit-row-hydration-20260425T063024Z/summary.sanitized.json`

## Goal

Verify or precisely classify whether the RUN_ID `20260425T063024Z` selected-entry fix resolves the accepted-encounter official visit identifier hydration blocker when diagnostic fullflow uses a target/precondition that reaches Charts after accept.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and the RWO-08B sanitized evidence above.
3. Do not read, paste, commit, or package raw diagnostic artifact contents except as local-only debugging input. Any committed evidence must be sanitized summaries only.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Add focused no-live unit/component tests around Reception-to-Charts handoff, accepted encounter hydration, selected visit row resolution, and `ChartsActionBar` send-context readiness.
- Fix repo-local defects in `web-client/` or `server-modernized/` that prevent accepted encounter identifiers from being carried into Charts, as long as the fix preserves server-side authority and fail-closed behavior.
- Rerun `runtime-ready-smoke` and one diagnostic fullflow after a concrete fix or changed test-data precondition. The next diagnostic fullflow should use the same class of target that reaches Charts after accept; do not use a target known to stop before canonical Charts handoff unless the purpose is to record a test-data skip.
- Keep diagnostic screenshots/network JSON/request XML/HAR/traces/videos local-only under gitignored output directories.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating live diagnostic fullflow without a concrete fix or changed precondition.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For any rerun: endpoint/request-class identity, target classification, medical-information gate result, Charts handoff status, selected visit row status, official identifier readiness, request XML created/not-created, business-success classification, and blocker/result.
- Diagnostic artifact manifest may include local relative directories, artifact classes, counts, and gitignored status only.
- credentialsCaptured must remain `false`; rawArtifactsCommittedOrPackaged must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A repo-local fix lands, focused no-live tests pass, `runtime-ready-smoke` passes, and one diagnostic fullflow reaches either sanitized L4 success or a later endpoint-specific blocker.
- The official-visit-identifier hydration blocker is proven to be a test-data/environment precondition, with sanitized evidence and a next executable target/precondition.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
