# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T06:31:00Z
source_work_order: RWO-06B-next
blocker_id: subjectivesv2-diseasev3-no-live-wrapper-implementation-not-created
priority: high
supersedes:
- soap-disease-safe-wrapper-business-scope-not-created

## Context

RUN_ID `20260424T063100Z` completed the no-live SOAP/disease safe-wrapper prep record:

- Report: `docs/implementation/rwo06b-soap-disease-safe-wrapper-prep-20260424T063100Z/FINAL_REPORT.md`
- Prep: `docs/implementation/rwo06b-soap-disease-safe-wrapper-prep-20260424T063100Z/SAFE_WRAPPER_PREP.md`
- Summary: `docs/implementation/rwo06b-soap-disease-safe-wrapper-prep-20260424T063100Z/summary.sanitized.json`

Current classification:

- SOAP local product route: `/api/local/charts/subjectives`
- SOAP ORCA endpoint inventory: `OrcaEndpoint.SUBJECTIVES_MOD` / `/orca25/subjectivesv2`
- SOAP native-intent payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Disease local product route: `/api/local/diagnoses`
- Disease ORCA endpoint inventory: `OrcaEndpoint.DISEASE_MOD_V3` / `/orca22/diseasev3`
- Disease native-intent payload SHA-256: `da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df`

Both endpoints remain `blocked_no_live_wrapper_business_scope_missing`. Existing local route success and native-intent payloads are not ORCA Trial reachability evidence.

## Goal

Implement or define no-live safe wrapper scaffolding for `subjectivesv2` and `diseasev3`, including parser/sanitizer contract tests, without executing live SOAP or disease Trial mutations.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Create endpoint-specific safe-evidence modules and CLI wrapper entrypoints, or document a narrower implementation blocker if the current source structure prevents a safe no-live wrapper in this run.
3. The wrappers must support dry-run/mock only unless a later prompt adds endpoint-specific live approval.
4. Add no-live parser/sanitizer tests using checked-in stub responses only.
5. Guard against target drift, endpoint drift, Request_Number `02` / `03` / `04`, raw body retention, sensitive message retention, and duplicate-live ambiguity.
6. Update roadmap docs, matrices, sanitized evidence, and handoff state.
7. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Add `web-client/scripts` no-live safe wrapper modules and tests for parser/sanitizer/command guards.
- Use checked-in `server-modernized/src/test/resources/orca/stub/64_subjectivesv2_response.sample.xml` and `57_diseasev3_response.sample.xml` as local parser fixtures if no raw/sensitive detail is retained in generated evidence.
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
- No-live wrapper/parser/sanitizer test results or a sanitized implementation blocker record.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no SOAP/disease live Trial success claim.

## Completion Criteria

This prompt is complete when `subjectivesv2` and `diseasev3` have no-live safe wrapper/parser contracts committed, or when a concrete repo-local blocker is recorded with the next smallest safe implementation step.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live SOAP/disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, blockers, recommended next action, credentials captured, and raw artifacts captured.
