# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T08:00:24Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-post-visit-date-repair-current-target-before-charts-handoff
priority: high
supersedes:
- fullflow-charts-reaching-target-official-visit-identifiers-missing

## Context

RUN_ID `20260425T080024Z` investigated the prior blocker where a Charts-reaching diagnostic target did not have server-fetched official visit identifiers in the selected Charts context.

Sanitized evidence:

- `docs/implementation/rwo08b-charts-visit-date-repair-20260425T080024Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-charts-visit-date-repair-20260425T080024Z/summary.sanitized.json`
- `docs/implementation/rwo08b-charts-visit-date-repair-20260425T080024Z/command-log.jsonl`
- `docs/implementation/rwo08b-charts-query-date-fix-20260425T083023Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-charts-query-date-fix-20260425T083023Z/summary.sanitized.json`
- `docs/implementation/rwo08b-charts-query-date-fix-20260425T083023Z/command-log.jsonl`

Current result:

- A repo-local defect was fixed: Charts appointment/visit refetch used the page-load date instead of handoff `visitDate`.
- Charts now uses handoff `visitDate` first and falls back to `today` only when no handoff date exists.
- This does not trust client-provided official identifiers; `Insurance_Combination_Number`, `Voucher_Number`, and `Sequential_Number` still must come from server-fetched visit rows.
- Focused no-live tests passed: `orcaQueueSelection.test.ts` now has 10 passing tests.
- Web guard, typecheck, and JSON-only runtime smoke passed.
- A read-only preflight found multiple local-selectable Trial candidates and did not call the mutation route.
- One post-fix diagnostic fullflow was run under the Diagnostic Artifact Exception.
- That diagnostic fullflow passed the medical-information gate but stopped before Charts handoff as `test-data-blocker` / `fatal_before_send`.
- No selected visit row readiness could be re-evaluated in that post-fix run.
- No `medicalmodv2` request XML was created.
- No L4 fullflow success is claimed.
- RUN_ID `20260425T083023Z` revalidated the same committed fix (`576f56f40`) with focused no-live tests, web guard, typecheck, JSON-only runtime smoke, and one diagnostic fullflow using the prior local-only selected candidate. The medical-information gate passed, but the target again stopped before canonical Charts handoff as `test-data-blocker` / `fatal_before_send`; no request XML was created.

Raw diagnostic output is local-only and gitignored under:

- `artifacts/diagnostic-fullflow/20260425T080024Z/readonly-preflight`
- `artifacts/diagnostic-fullflow/20260425T080024Z/fullflow-post-date-fix`
- `artifacts/diagnostic-fullflow/20260425T083023Z/fullflow-post-query-date-fix`

Do not commit, package, paste, or summarize raw diagnostic contents beyond sanitized allowlisted fields.

## Goal

Find or establish a current WebORCA Trial diagnostic precondition that reaches Charts after the handoff visit-date repair, then verify whether the selected visit row is populated with server-fetched official identifiers.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and the RUN_ID `20260425T080024Z` sanitized evidence above.
3. Do not read, paste, commit, or package raw diagnostic artifact contents except as local-only debugging input. Any committed evidence must be sanitized summaries only.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Add focused no-live tests if another repo-local handoff/selection defect is found.
- Add a narrowly scoped repo-local fix in `web-client/` if the issue is caused by client-side handoff/selection logic.
- Run read-only preflight wrappers to classify current candidate/precondition readiness without mutation.
- Rerun at most one diagnostic fullflow only after a concrete repo-local fix or changed precondition plus focused no-live verification.
- Keep diagnostic screenshots/network JSON/request XML/HAR/traces/videos local-only under gitignored output directories.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating live diagnostic fullflow without a concrete fix or changed precondition.
- Treating `encounterKey` presence, HTTP 200, wrapper exit 0, dry-run output, or a read-only preflight as business success.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For any rerun: endpoint/request-class identity, target classification, medical-information gate result, Charts handoff status, selected visit row status, official identifier readiness, request XML created/not-created, business-success classification, and blocker/result.
- Diagnostic artifact manifest may include local relative directories, artifact classes, counts, and gitignored status only.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A current post-fix diagnostic precondition reaches Charts and proves selected visit row official identifier readiness, leading to L4 success or a later endpoint-specific blocker.
- The remaining inability to reach Charts is proven to be a Trial data/server response precondition rather than a client defect, with sanitized evidence and the next executable target/precondition recorded.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
