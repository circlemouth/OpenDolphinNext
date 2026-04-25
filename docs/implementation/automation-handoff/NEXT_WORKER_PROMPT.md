# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T07:00:27Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-current-target-canonical-charts-handoff-missing
priority: high
supersedes:
- fullflow-accepted-encounter-official-visit-identifiers-missing

## Context

RUN_ID `20260425T070027Z` continued the RWO-08B visit-row hydration handoff.

Repo-local fix now exists and is verified:

- `web-client/src/features/charts/orcaQueueSelection.ts` adds `resolveReceptionEntryForEncounter`.
- `web-client/src/features/charts/pages/ChartsPage.tsx` uses that resolver for selected Reception entry resolution.
- `web-client/src/features/charts/__tests__/orcaQueueSelection.test.ts` covers exact-key preference, unique official row fallback, incomplete official identifiers, and ambiguous official rows.
- Focused resolver tests passed: `npm run --prefix web-client test -- src/features/charts/__tests__/orcaQueueSelection.test.ts` (8 tests).
- `npm run --prefix web-client verify:web-guard` passed.
- `npm run --prefix web-client typecheck` passed.
- `RUN_ID=20260425T070027Z node web-client/scripts/runtime-ready-smoke.mjs` passed.

Diagnostic fullflow was rerun under the Diagnostic Artifact Exception with the current Trial native default target class. Raw diagnostic output is local-only and gitignored under:

- `artifacts/diagnostic-fullflow/20260425T070027Z/fullflow-patient-00001`
- `artifacts/webclient/runtime-gate-ready/20260425T070027Z`

Do not commit or package those diagnostic artifacts.

Sanitized evidence:

- `docs/implementation/rwo08b-visit-row-hydration-20260425T070027Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-visit-row-hydration-20260425T070027Z/summary.sanitized.json`
- `docs/implementation/rwo08b-visit-row-hydration-20260425T070027Z/command-log.jsonl`

Current result:

- The Charts hydration resolver defect is repaired and covered by no-live tests.
- The current live diagnostic target did not reach Charts after accept.
- Medical-information gate passed.
- Charts handoff stayed unavailable because the patient-search open-charts button remained disabled with no active entry after accept.
- No selected visit row was available.
- No `medicalmodv2` request XML was created.
- No L4 fullflow success is claimed.

## Goal

Find or establish a current WebORCA Trial diagnostic precondition that creates a canonical Charts handoff after accept, then rerun one diagnostic fullflow to verify whether the repaired selected-entry resolver hydrates official visit identifiers and either reaches sanitized L4 success or a later endpoint-specific blocker.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and the RWO-08B sanitized evidence above.
3. Do not read, paste, commit, or package raw diagnostic artifact contents except as local-only debugging input. Any committed evidence must be sanitized summaries only.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Add focused no-live tests around Reception accepted handoff resolution if the current blocker proves to be repo-local and testable.
- Run read-only candidate/preflight wrappers if needed to identify a current Trial target/precondition that can safely reach canonical Charts handoff.
- Rerun at most one diagnostic fullflow after a concrete changed precondition or repo-local fix.
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
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A current Trial diagnostic precondition is found, one diagnostic fullflow reaches Charts, and selected visit row hydration reaches sanitized L4 success or a later endpoint-specific blocker.
- The current-target handoff blocker is proven to be a test-data/environment precondition, with sanitized evidence and a next executable target/precondition.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
