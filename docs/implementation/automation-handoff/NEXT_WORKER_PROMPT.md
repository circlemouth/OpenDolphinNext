# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T07:30:23Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-charts-reaching-target-official-visit-identifiers-missing
priority: high
supersedes:
- fullflow-current-target-canonical-charts-handoff-missing

## Context

RUN_ID `20260425T073023Z` completed the prior handoff goal of finding a current WebORCA Trial diagnostic precondition that reaches Charts after accept.

Sanitized evidence:

- `docs/implementation/rwo08b-current-target-precondition-20260425T073023Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-current-target-precondition-20260425T073023Z/summary.sanitized.json`
- `docs/implementation/rwo08b-current-target-precondition-20260425T073023Z/command-log.jsonl`

Current result:

- Read-only preflight was run first and did not call the mutation route.
- The default exact preflight is not mutation-ready because the current UI selector defaults do not match requested department/physician values.
- The same preflight showed more than one local-selectable Trial candidate.
- A different local-selectable candidate was used as a concrete changed precondition for one diagnostic fullflow.
- Diagnostic fullflow reached Charts with a canonical handoff.
- Medical-information gate passed.
- Reception row was found.
- The handoff had an encounter key but no schedule key.
- The selected Charts visit row was not present.
- ORCA send remained fail-closed because official visit identifiers were missing.
- No `medicalmodv2` request XML was created.
- No L4 fullflow success is claimed.

Raw diagnostic output is local-only and gitignored under:

- `artifacts/diagnostic-fullflow/20260425T073023Z/readonly-preflight`
- `artifacts/diagnostic-fullflow/20260425T073023Z/fullflow-alt-local-candidate`

Do not commit, package, paste, or summarize raw diagnostic contents beyond sanitized allowlisted fields.

## Goal

Investigate why the Charts-reaching diagnostic target still lacks server-fetched official visit identifiers in the selected Charts context. Prefer a repo-local no-live test or source fix before any further live diagnostic fullflow retry.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and the RWO-08B sanitized evidence above.
3. Do not read, paste, commit, or package raw diagnostic artifact contents except as local-only debugging input. Any committed evidence must be sanitized summaries only.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Add focused no-live tests around Charts selected Reception entry resolution, Charts patient row selection, or reception-to-Charts handoff state if the blocker is repo-local and testable.
- Add a narrowly scoped repo-local fix in `web-client/` if the issue is caused by client-side handoff/selection logic.
- Run read-only preflight wrappers if needed to classify a current candidate/precondition without mutation.
- Rerun at most one diagnostic fullflow only after a concrete repo-local fix or changed precondition plus focused no-live verification.
- Keep diagnostic screenshots/network JSON/request XML/HAR/traces/videos local-only under gitignored output directories.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating live diagnostic fullflow without a concrete fix or changed precondition.
- Treating `encounterKey` presence, HTTP 200, wrapper exit 0, or dry-run output as business success.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For any rerun: endpoint/request-class identity, target classification, medical-information gate result, Charts handoff status, selected visit row status, official identifier readiness, request XML created/not-created, business-success classification, and blocker/result.
- Diagnostic artifact manifest may include local relative directories, artifact classes, counts, and gitignored status only.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A repo-local defect causing missing selected visit row or missing official identifiers is fixed, focused no-live verification passes, and one diagnostic fullflow reaches sanitized L4 success or a later endpoint-specific blocker.
- The missing identifiers are proven to be a Trial data/server response precondition rather than a client defect, with sanitized evidence and the next executable target/precondition recorded.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
