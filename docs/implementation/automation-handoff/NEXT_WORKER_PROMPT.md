# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T09:00:22Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-current-selector-precondition-missing
priority: high
supersedes:
- fullflow-post-visit-date-repair-current-target-before-charts-handoff

## Context

RUN_ID `20260425T090022Z` followed the active RWO-08B handoff after the Charts `visitDate` refetch repair.

Sanitized evidence:

- `docs/implementation/rwo08b-current-selector-precondition-20260425T090022Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-current-selector-precondition-20260425T090022Z/summary.sanitized.json`
- `docs/implementation/rwo08b-current-selector-precondition-20260425T090022Z/command-log.jsonl`

Current result:

- No diagnostic fullflow and no live mutation were run.
- Two read-only preflights were run:
  - default preferred candidate selection
  - exact local-selectable candidate `00005`
- Both preflights found official patient evidence, insurance readiness, local selectable readiness, and direct-acceptance appointment handling.
- Both preflights rejected before mutation as `selector_option_missing` / `selector_missing`.
- The missing selector dimensions are `department` and `physician`; the failed medical-information readiness subdimensions are `department_ready` and `physician_ready`.
- `mutationPolicy.prohibited=true`, `blockedRequestCount=0`, and `targetMutationRequestCount=0`.
- The current exact selector precondition is therefore not ready for a new diagnostic fullflow retry.
- No `medicalmodv2` request XML was created and no L4 success is claimed.

Raw diagnostic output is local-only and gitignored under:

- `artifacts/diagnostic-fullflow/20260425T090022Z/readonly-preflight`
- `artifacts/diagnostic-fullflow/20260425T090022Z/readonly-preflight-00005`

Do not commit, package, paste, or summarize raw diagnostic contents beyond sanitized allowlisted fields.

## Goal

Establish a current WebORCA Trial fullflow precondition whose department and physician identity is actually selectable in the current runtime, without injecting selector options or trusting client-side hidden values.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and the RUN_ID `20260425T090022Z` sanitized evidence above.
3. Do not read, paste, commit, or package raw diagnostic artifact contents except as local-only debugging input. Any committed evidence must be sanitized summaries only.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Investigate why current selector options omit the prior fullflow identity `departmentCode=01` / `physicianCode=10001`.
- Add focused no-live tests if a repo-local selector/preflight defect is found.
- Add a narrowly scoped repo-local fix in `web-client/` if the issue is caused by client-side selector or handoff logic.
- Prefer a safe no-live method to discover a runtime-selectable department/physician identity and rerun exact read-only preflight with that identity.
- Run read-only preflight wrappers to classify current candidate/precondition readiness without mutation.
- Rerun at most one diagnostic fullflow only after a concrete repo-local fix or changed selector precondition plus focused no-live verification.
- Keep diagnostic screenshots/network JSON/request XML/HAR/traces/videos local-only under gitignored output directories.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Injecting missing selector options and treating that as current runtime readiness.
- Repeating diagnostic fullflow without a concrete fix or changed precondition.
- Treating `encounterKey` presence, HTTP 200, wrapper exit 0, dry-run output, or a read-only preflight as business success.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For read-only selector/preflight work: endpoint/request-class identity, selected candidate class, official/insurance/local selectable status, selector readiness, appointment dependency, mutation policy counts, and blocker/result.
- For any rerun: endpoint/request-class identity, target classification, medical-information gate result, Charts handoff status, selected visit row status, official identifier readiness, request XML created/not-created, business-success classification, and blocker/result.
- Diagnostic artifact manifest may include local relative directories, artifact classes, counts, and gitignored status only.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A current runtime-selectable department/physician identity is established and exact read-only preflight passes, enabling a later or same-run diagnostic fullflow retry under the stated limits.
- A repo-local selector/preflight defect is fixed, focused no-live verification passes, and exact read-only preflight is reclassified.
- The remaining selector-precondition failure is proven to be Trial data/server response precondition rather than a client defect, with sanitized evidence and the next executable target/precondition recorded.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
