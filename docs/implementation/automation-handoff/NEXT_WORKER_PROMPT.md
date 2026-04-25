# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T18:29:30Z
source_work_order: RWO-11/RWO-09
blocker_id: final-owner-go-or-operator-rollback-rehearsal-pending
priority: normal
supersedes:
- rollback-rehearsal-or-final-owner-go-pending

## Context

RUN_ID `20260425T182930Z` classified the active rollback/owner-decision handoff.

Sanitized evidence:

- `docs/implementation/rwo11-rollback-owner-pending-20260425T182930Z/FINAL_REPORT.md`
- `docs/implementation/rwo11-rollback-owner-pending-20260425T182930Z/summary.sanitized.json`
- `artifacts/orca-remediation/closeout/20260425T182930Z/`

Current result:

- Current branch/head: `master` / `0d80e19555ab1f45f138e0d2f641e02f6a42ce1a`
- Accepted reviewer packet source freeze: `master` / `b103e49ee06d1c1043c066a097f7c62408c32263`
- Reviewer packet: `artifacts/reviewer-submission-packets/submission-packet-20260425T174429Z.zip`
- Packet sha256: `415b1fb493632176b44d5d38cc02c8f95c6783de392e491082803542d201529a`
- Checks passed in the classifier run: reviewer packet contract tests (7), `check-doc-links`, and `web-client verify:web-guard`.
- Rollback rehearsal is classified as `pending_human_operator_decision`; repo-local dry-runs cannot prove release-candidate deployment stop, paired restore, restored-target smoke, or operator/owner acceptance.
- No live Trial mutation, production ORCA, S3/MinIO/object-storage setup, diagnostic artifact capture, raw artifact packaging, actual rollback rehearsal, owner final GO, or final release readiness is claimed.

## Goal

Advance only if new safe evidence exists: record an actual operator rollback rehearsal with sanitized evidence, or record final owner GO/NO-GO/PENDING if supplied. If neither exists, do not repeat the same classification; select the next independent non-live roadmap task that is safe under the Trial-only, non-S3 scope.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T182930Z` sanitized evidence.
3. Confirm no unrelated uncommitted changes would be overwritten.
4. Check whether new owner/operator input or a new release-candidate rollback environment exists. If absent, continue to independent non-live work rather than re-recording the same blocker.

## Allowed Actions

- Record a real operator rollback rehearsal only if the environment/action has already been safely performed or is available without production ORCA, S3/object-storage, credentials, raw artifacts, or out-of-scope operations.
- Update RWO-11 claim-boundary docs, matrices, and sanitized evidence.
- Record final GO/NO-GO/PENDING only if explicit owner decision evidence is supplied.
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
- final owner GO/NO-GO/PENDING is recorded from explicit owner evidence; or
- no new owner/operator input exists and the run advances another independent safe Work Order, leaving this blocker as pending without duplicate classification.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
