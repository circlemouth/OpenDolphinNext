# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T16:14:26Z
source_work_order: RWO-11/RWO-09
blocker_id: current-head-reviewer-packet-or-owner-decision-pending
priority: normal
supersedes:
- rwo09-non-s3-static-refresh-next

## Context

RUN_ID `20260425T161426Z` completed the RWO-09 non-S3 static/package contract refresh.

Sanitized evidence:

- `docs/implementation/rwo09-non-s3-static-refresh-20260425T161426Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260425T161426Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260425T161426Z/command-log.jsonl`

Current result:

- RWO-08B remains blocked: `00001` and `00005` are duplicate-acceptance/no-active-entry blockers, and read-only discovery excluding them found no fresh local-selectable candidate.
- No diagnostic fullflow retry was run in RUN_ID `20260425T161426Z`.
- RWO-09 static/package contract checks passed:
  - focused `orcaTrialPreflight.test.ts`: 81 tests
  - `web-client` web guard
  - touched QA module syntax checks
  - `web-client` typecheck
  - reviewer submission packet contract tests: 7 tests
  - review package contract tests: 27 tests
  - server static guard scripts
- Status-only runtime check saw web `200` and direct server health/readiness `000` / `000`.
- Read-only candidate discovery diagnostic output for this run is local-only/untracked and must not be committed or packaged.
- No live Trial mutation, production ORCA, S3/MinIO/object-storage setup, raw artifact packaging, rollback rehearsal, owner final GO, or final release readiness is claimed.

## Goal

Advance the next safe RWO-11/RWO-09 closeout step: either refresh a current-head reviewer submission packet from a complete sanitized closeout packet, or record why packet refresh / rollback / final GO remains pending and select the next independent safe task.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T161426Z` sanitized evidence.
3. Confirm no unrelated uncommitted changes would be overwritten.
4. Check whether a complete sanitized closeout packet exists for the current accepted head and whether reviewer packet generation can run without raw diagnostic artifacts.

## Allowed Actions

- Generate and validate a reviewer submission packet only if the closeout source is complete, sanitized, and current-head aligned.
- Run reviewer packet/package contract checks and forbidden-artifact/secret scans.
- Update RWO-11 claim-boundary docs, matrices, and sanitized evidence.
- Record sanitized skip/blocker evidence if packet refresh, rollback rehearsal, or final owner GO requires unavailable human/operator input.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating diagnostic fullflow for candidates `00001` or `00005` unchanged.
- Running live Trial mutation as a substitute for package/rollback/owner-decision readiness.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record branch/HEAD, accepted-head decision, packet/scan commands or skip reason, and claim boundaries.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when either:

- a current-head reviewer submission packet is generated/validated from sanitized closeout evidence and matrices/handoff are updated; or
- packet refresh / rollback rehearsal / final owner GO is safely classified as pending human/operator decision or missing sanitized closeout source, with the next independent Work Order recorded.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
