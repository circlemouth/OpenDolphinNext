# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T14:44:28Z
source_work_order: RWO-08B/RWO-08
blocker_id: fullflow-duplicate-acceptance-candidate-exhaustion-investigation
priority: high
supersedes:
- fullflow-next-candidate-00005-diagnostic-fullflow-pending

## Context

RUN_ID `20260425T144428Z` completed the previous handoff by running the approved single diagnostic fullflow for candidate `00005`.

Sanitized evidence:

- `docs/implementation/rwo08b-candidate-00005-diagnostic-fullflow-20260425T144428Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-candidate-00005-diagnostic-fullflow-20260425T144428Z/summary.sanitized.json`
- `docs/implementation/rwo08b-candidate-00005-diagnostic-fullflow-20260425T144428Z/command-log.jsonl`

Current result:

- `orca-trial-no-object-storage` runtime path remained in use; no S3/MinIO/object-storage configuration was used or claimed.
- Runtime-ready smoke passed with JSON-only evidence.
- Candidate `00005` exact read-only preflight passed with no mutation and `targetMutationRequestCount=0`.
- The one diagnostic fullflow for `00005` returned accept mutation HTTP `200` with parsed `apiResult=16`, classified as `business_rejected_duplicate_acceptance`.
- No acceptance evidence, `acceptanceId`, `visitNumber`, `scheduleKey`, or `encounterKey` was present in sanitized classification.
- Reception diagnostics after accept showed one matching reservation-only row, zero active rows, and zero keyed active rows.
- Charts handoff did not resolve, order send was not reached, and request XML was not created.
- Candidates `00001` and `00005` are now both classified as duplicate-acceptance/no-active-entry blockers for this diagnostic path.

Do not read, paste, commit, or package raw diagnostic artifact contents from local-only diagnostic roots. Committed evidence must remain sanitized summaries only.

## Goal

Investigate the duplicate-acceptance/no-active-entry blocker without repeating unchanged diagnostic fullflow sends for `00001` or `00005`. Identify the next safe path: a no-live/read-only candidate freshness precondition, a repo-local defect with focused no-live tests, or a sanitized blocker that moves RWO-08B to the next independent Work Order.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T144428Z` sanitized evidence.
3. Confirm local runtime remains non-S3 if runtime checks are used.
4. Review source and sanitized summaries for acceptmodv2 duplicate-acceptance handling, reception active-entry refresh, and candidate selection.
5. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- No-live source investigation of acceptmodv2 duplicate handling, reception refresh, and canonical handoff wait logic.
- Read-only candidate discovery/preflight with `targetMutationRequestCount=0`.
- Status-only health/readiness and runtime-ready smoke.
- Add focused no-live/unit/component tests using synthetic fixtures if a repo-local defect is found.
- Write sanitized skip/blocker evidence and update matrices/handoff.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating diagnostic fullflow for candidates `00001` or `00005` without a concrete repo-local fix or changed precondition.
- Running live order-send mutation as a substitute for resolving the handoff blocker.
- Reintroducing DOM option injection or display-string selector synthesis.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record candidate/precondition identity, whether mutation routes were called, target mutation request count, duplicate checkpoint decision, active-entry status, and next safe candidate or blocker.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A new safe changed precondition is identified with read-only/no-live evidence and a follow-up diagnostic fullflow is explicitly queued under policy.
- A repo-local defect is fixed with focused no-live tests and a new post-fix diagnostic/fullflow handoff is queued.
- Duplicate-acceptance candidate exhaustion is classified as a current Trial business/test-data blocker and the next independent Work Order is recorded.
- Local runtime is unavailable for the run, with sanitized skip evidence and the next independent safe Work Order selected.
- A non-skippable safety blocker is recorded with sanitized evidence.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
