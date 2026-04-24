# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T06:39:36Z
source_work_order: RWO-06B-next
blocker_id: subjectivesv2-diseasev3-live-integration-official-wrapper-not-created
priority: high
supersedes:
- subjectivesv2-diseasev3-no-live-wrapper-implementation-not-created

## Context

RUN_ID `20260424T063936Z` completed the no-live SOAP/disease wrapper implementation:

- Report: `docs/implementation/rwo06b-soap-disease-no-live-wrapper-20260424T063936Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06b-soap-disease-no-live-wrapper-20260424T063936Z/summary.sanitized.json`
- Module: `web-client/scripts/qa-lib/phase4-soap-disease-safe-evidence.mjs`
- CLI: `web-client/scripts/qa-phase4-safe-soap-disease.mjs`
- Tests: `web-client/scripts/__tests__/phase4SoapDiseaseSafeEvidence.test.ts`

Current classification:

- `subjectivesv2` no-live wrapper/parser contract exists and dry-run passes.
- `diseasev3` create no-live wrapper/parser contract exists and dry-run passes.
- Stub XML with zero-equivalent `Api_Result` classifies as `notVerified`, not business success, because endpoint-specific completion evidence is absent.
- Live SOAP/disease Trial mutation remains blocked.

## Goal

Define the next smallest safe implementation step for endpoint-specific server official wrapper integration and business success criteria for `subjectivesv2` / `diseasev3`, without executing live SOAP or disease Trial mutations unless a later prompt explicitly authorizes one endpoint identity.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Inspect current `server-modernized` ORCA endpoint inventory/resources for `OrcaEndpoint.SUBJECTIVES_MOD` and `OrcaEndpoint.DISEASE_MOD_V3`.
3. Determine whether repo-local server official wrapper resources can be implemented safely without raw body retention, arbitrary endpoint input, Request_Number `02` / `03` / `04`, or business-scope ambiguity.
4. If safe, implement the smallest no-live server-side integration scaffolding and tests needed for a future live wrapper. If not safe, record the concrete blocker and next smallest safe step.
5. Update roadmap docs, matrices, sanitized evidence, and handoff state.
6. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Source review in `server-modernized/` and `web-client/`.
- Add no-live server-side tests or wrapper scaffolding for fixed `subjectivesv2` / `diseasev3` endpoint identities.
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
- No-live server wrapper/scaffolding test results or a sanitized implementation blocker record.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no SOAP/disease live Trial success claim.

## Completion Criteria

This prompt is complete when a concrete no-live server official-wrapper integration step is committed, or when a precise repo-local blocker is recorded with the next smallest safe implementation step.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live SOAP/disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, blockers, recommended next action, credentials captured, and raw artifacts captured.
