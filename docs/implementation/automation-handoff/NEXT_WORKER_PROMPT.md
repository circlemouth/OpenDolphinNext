# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T08:05:30Z
source_work_order: RWO-06B-next3
blocker_id: diseasev3-live-payload-identity-and-approval-not-created
priority: high
supersedes:
- subjectivesv2-diseasev3-live-payload-identity-and-approval-not-created

## Context

RUN_ID `20260424T080121Z` completed the first endpoint-specific SOAP/disease no-live live-readiness identity:

- Report: `docs/implementation/rwo06b-subjectivesv2-live-readiness-20260424T080121Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06b-subjectivesv2-live-readiness-20260424T080121Z/summary.sanitized.json`
- Endpoint selected: `subjectivesv2`
- Workflow ID: `rwo06b-subjectivesv2-live-readiness-v1`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Tests:
  - wrapper syntax checks passed
  - no-live SOAP/disease safe-evidence tests passed
  - `subjectivesv2` dry-run passed with stub classification `notVerified`

Current classification:

- `subjectivesv2` now has a no-live live-readiness identity and approval/business-scope record.
- Live `subjectivesv2` Trial mutation remains blocked until a future prompt explicitly authorizes the exact duplicate-live checkpoint and runtime readiness is rechecked.
- `diseasev3` still lacks its own no-live live-readiness identity and approval/business-scope record.

## Goal

Define the next smallest safe step for the `diseasev3` endpoint-specific no-live live-readiness identity, without executing live disease Trial mutations.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Review the current `diseasev3` payload, fixed official server route, parser completion-evidence expectations, and disease 3-layer/product boundary.
3. Create or update no-live `diseasev3` payload identity metadata, duplicate-live checkpoint key, parser completion-evidence expectations, and explicit live approval/business-scope record.
4. If the `diseasev3` identity cannot be justified because create/update/delete semantics, diagnosis persistence, or business scope remain ambiguous, record a precise blocker and next smallest safe no-live step instead.
5. Update roadmap docs, matrices, sanitized evidence, and handoff state.
6. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Source review in `server-modernized/`, `api-contract/`, `web-client/`, and docs.
- Add no-live metadata, tests, parser fixtures, wrapper dry-runs, or sanitized evidence for `diseasev3`.
- Add sanitized docs, command logs, summary JSON, and handoff updates.
- Run no-live unit/contract tests, JSON validation, `node --check`, doc link checks, secret/raw-artifact scans, and `git diff --check`.

## Forbidden Actions

- Live `subjectivesv2` or `diseasev3` execution.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD.
- No-live `diseasev3` endpoint-identity metadata/tests or a sanitized blocker record.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no SOAP/disease live Trial success claim.

## Completion Criteria

This prompt is complete when `diseasev3` has an explicit no-live live-readiness identity and approval/business-scope record, or when a precise repo-local blocker is recorded with the next smallest safe implementation step.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live SOAP/disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, blockers, recommended next action, credentials captured, and raw artifacts captured.
