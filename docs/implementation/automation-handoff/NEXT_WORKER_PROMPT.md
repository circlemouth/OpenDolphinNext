# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T15:29:31Z
source_work_order: RWO-09/RWO-11
blocker_id: rwo09-non-s3-static-refresh-next
priority: normal
supersedes:
- fullflow-duplicate-acceptance-candidate-exhaustion-investigation

## Context

RUN_ID `20260425T152931Z` completed the previous RWO-08B blocker investigation.

Sanitized evidence:

- `docs/implementation/rwo08b-duplicate-candidate-exhaustion-20260425T152931Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-duplicate-candidate-exhaustion-20260425T152931Z/summary.sanitized.json`
- `docs/implementation/rwo08b-duplicate-candidate-exhaustion-20260425T152931Z/command-log.jsonl`

Current RWO-08B result:

- Candidate selection now supports `QA_EXCLUDED_CANDIDATES` / `QA_EXCLUDED_PATIENT_IDS`.
- Duplicate-blocked candidates `00001` and `00005` can be excluded from read-only candidate selection.
- Read-only discovery excluding `00001,00005` found no fresh selected candidate.
- Non-excluded candidates `00002` through `00011` were blocked by `local_exact_match_missing`.
- No mutation route was called during the read-only discovery; `targetMutationRequestCount=0`.
- No diagnostic fullflow retry, request XML, order send, L4 success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness is claimed.

Do not repeat diagnostic fullflow for `00001` or `00005` unchanged. Do not run a new fullflow unless a fresh read-only candidate or changed Trial/local-sync precondition is established first.

## Goal

Advance the next independent non-S3 release-readiness work while RWO-08B remains blocked by Trial candidate freshness/local-sync preconditions.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T152931Z` sanitized evidence.
3. Confirm no unrelated uncommitted changes would be overwritten.
4. Select the next safe RWO-09/RWO-11 action that does not require production ORCA, S3/MinIO/object-storage, raw diagnostic artifacts, or final owner GO.

## Allowed Actions

- RWO-09 non-S3 static/guard refresh.
- Reviewer packet metadata/static contract checks that do not package raw diagnostic artifacts.
- Rollback/runbook evidence-policy checks that use sanitized summaries only.
- Docs/matrix/claim-boundary updates.
- Sanitized skip/blocker evidence for runtime/browser/package tasks that cannot run safely in the current environment.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating diagnostic fullflow for candidates `00001` or `00005` unchanged.
- Running live Trial mutation as a substitute for RWO-09/RWO-11 static/package/rollback readiness.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record current branch/HEAD, checks run, package/static/rollback scope, skipped tasks and reasons, and claim boundaries.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when the selected RWO-09/RWO-11 non-S3 static/package/rollback-readiness step is completed or safely skipped with sanitized evidence, and `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and a final evidence directory are updated.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
