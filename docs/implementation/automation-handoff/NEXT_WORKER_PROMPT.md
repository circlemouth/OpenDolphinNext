# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T10:13:08Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-authoritative-selector-source-missing
priority: high
supersedes:
- fullflow-current-selector-precondition-missing

## Context

RUN_ID `20260425T101308Z` followed the active RWO-08B handoff for current selector precondition readiness.

Sanitized evidence:

- `docs/implementation/rwo08b-selector-gate-failclosed-20260425T101308Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-selector-gate-failclosed-20260425T101308Z/summary.sanitized.json`
- `docs/implementation/rwo08b-selector-gate-failclosed-20260425T101308Z/command-log.jsonl`

Current result:

- `qa-fullflow-weborca.mjs` was repaired so it no longer injects missing selector options.
- The fullflow diagnostic harness now reuses the fail-closed selector gate and stops before reception mutation when department/physician options are missing.
- Candidate discovery checked 11 default Trial candidates read-only and found `acceptedCandidateCount=0`.
- Current candidate `00001` remains official/insurance/local selectable, but direct-acceptance department and physician selectors contain only the empty placeholder in the current runtime.
- Exact read-only preflight for `00001` remains rejected as `selector_option_missing` / `selector_missing`.
- The post-fix diagnostic fullflow stopped before mutation with `missingFields=departmentCode,physicianCode`, `targetMutationRequestCount=0`, and `requestXmlCreated=false`.
- No L4 fullflow success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner GO, or final release readiness is claimed.

Raw diagnostic output is local-only and gitignored under:

- `artifacts/diagnostic-fullflow/20260425T101308Z/candidate-discovery`
- `artifacts/diagnostic-fullflow/20260425T101308Z/readonly-preflight-postfix-00001`
- `artifacts/diagnostic-fullflow/20260425T101308Z/fullflow-selector-gate-postfix-v2`

Do not commit, package, paste, or summarize raw diagnostic contents beyond sanitized allowlisted fields.

## Goal

Establish an authoritative runtime source for direct-acceptance department and physician options, or identify a current Trial precondition that carries appointment/visit-derived department and physician options, without injecting selector options or trusting client-side hidden values.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and the RUN_ID `20260425T101308Z` sanitized evidence above.
3. Do not read, paste, commit, or package raw diagnostic artifact contents except as local-only debugging input. Any committed evidence must be sanitized summaries only.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Investigate current reception selector sources for direct patient acceptance.
- Add focused no-live tests for department/physician option construction.
- Add a narrowly scoped repo-local fix in `web-client/` and/or `server-modernized/` if an authoritative server-backed selector source exists or can be safely exposed.
- Prefer server-authoritative option sources; do not make client constants or hidden values authoritative.
- Run read-only preflight wrappers to classify current candidate/precondition readiness without mutation.
- Rerun at most one diagnostic fullflow only after a concrete repo-local fix or a changed selector precondition plus focused no-live verification.
- Keep diagnostic screenshots/network JSON/request XML/HAR/traces/videos local-only under gitignored output directories.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Injecting missing selector options and treating that as current runtime readiness.
- Reintroducing DOM option injection in the diagnostic fullflow harness.
- Repeating diagnostic fullflow without a concrete fix or changed precondition.
- Treating HTTP 200, wrapper exit 0, dry-run output, read-only discovery/preflight, or target mutation request absence as business success.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For selector-source work: authoritative source, trust boundary, option construction rules, missing/ambiguous behavior, and fail-closed behavior.
- For read-only selector/preflight work: endpoint/request-class identity, selected candidate class, official/insurance/local selectable status, selector readiness, appointment dependency, mutation policy counts, and blocker/result.
- For any rerun: endpoint/request-class identity, target classification, medical-information gate result, Charts handoff status, selected visit row status, official identifier readiness, request XML created/not-created, business-success classification, and blocker/result.
- Diagnostic artifact manifest may include local relative directories, artifact classes, counts, and gitignored status only.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A server-authoritative department/physician option source is implemented or identified, focused no-live tests pass, and exact read-only preflight is reclassified.
- A current appointment/visit-derived Trial precondition with real department/physician selector options is established and exact read-only preflight passes.
- The remaining selector-source failure is proven to require a server/Trial capability not safely available in this automation, with sanitized evidence and the next independent Work Order recorded.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
