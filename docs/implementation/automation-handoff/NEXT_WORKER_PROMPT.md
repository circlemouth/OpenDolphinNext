# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T17:44:29Z
source_work_order: RWO-11/RWO-09
blocker_id: rollback-rehearsal-or-final-owner-go-pending
priority: normal
supersedes:
- current-head-reviewer-packet-or-owner-decision-pending

## Context

RUN_ID `20260425T174429Z` completed the current-head reviewer submission packet refresh.

Sanitized evidence:

- `docs/implementation/rwo11-current-head-reviewer-packet-20260425T174429Z/FINAL_REPORT.md`
- `docs/implementation/rwo11-current-head-reviewer-packet-20260425T174429Z/summary.sanitized.json`
- `artifacts/orca-remediation/closeout/20260425T174429Z/`

Current result:

- Accepted ref/head: `master` / `b103e49ee06d1c1043c066a097f7c62408c32263`
- Reviewer packet: `artifacts/reviewer-submission-packets/submission-packet-20260425T174429Z.zip`
- Packet sha256: `7f4f0c7335690a758f26cc2fdf5daadd703214fbca5dd15595e9558a795c245c`
- Packet size / entries: `3.3G` / `8702`
- Checks passed: reviewer packet contract tests (7), packet dry-run/create/validate, retained forbidden-artifact scan, focused forbidden-text scan, focused secret-pattern scan, and `git diff --check`.
- No live Trial mutation, production ORCA, S3/MinIO/object-storage setup, diagnostic fullflow retry, raw artifact packaging, rollback rehearsal, owner final GO, or final release readiness is claimed.

## Goal

Advance the next safe RWO-11 closeout step: record an operator rollback rehearsal with sanitized evidence if it can be performed safely, or record why rollback rehearsal / final owner GO remains pending and select the next independent safe task.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T174429Z` sanitized evidence.
3. Confirm no unrelated uncommitted changes would be overwritten.
4. Check whether rollback rehearsal can run without production ORCA, S3/MinIO/object-storage setup, credentials, raw artifacts, or operator-only external actions.

## Allowed Actions

- Run repo-local rollback/stop-policy dry-runs or static checks that emit sanitized evidence only.
- Update RWO-11 claim-boundary docs, matrices, and sanitized evidence.
- Record sanitized skip/blocker evidence if rollback rehearsal or final owner GO requires unavailable human/operator input.
- Continue to independent non-live static/package/security checks if rollback/final GO is blocked.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Running live Trial mutation as a substitute for rollback/owner-decision readiness.
- Repeating diagnostic fullflow for candidates `00001` or `00005` unchanged.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record branch/HEAD, rollback command/check scope or skip reason, current accepted reviewer packet identity, and claim boundaries.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when either:

- rollback rehearsal / stop-policy evidence is refreshed through a safe sanitized repo-local path and matrices/handoff are updated; or
- rollback rehearsal / final owner GO is safely classified as pending human/operator decision, with the next independent Work Order recorded.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
