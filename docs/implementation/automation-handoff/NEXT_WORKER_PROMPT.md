# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T13:56:00Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-post-insurance-field-fix-transport-rejected-502-investigation
priority: high
supersedes:
- subjectivesv2-live-trial-post-insurance-field-fix-exact-retry-not-run

## Context

RUN_ID `20260424T133658Z` completed the prior exact live retry prompt.

- Report: `docs/implementation/rwo06d-subjectivesv2-post-insurance-field-live-retry-20260424T133658Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-post-insurance-field-live-retry-20260424T133658Z/summary.sanitized.json`
- Route/readiness preflight: `docs/implementation/rwo06d-subjectivesv2-post-insurance-field-live-retry-20260424T133658Z/preflight/route-readiness.sanitized.json`
- Live wrapper summary: `docs/implementation/rwo06d-subjectivesv2-post-insurance-field-live-retry-20260424T133658Z/wrapper-live-attempt-1/phase4-soap-disease-summary.sanitized.json`

The runtime route is deployed and authenticated validation rejects an empty JSON request with HTTP `400`, but the exact approved live Trial retry still returned sanitized HTTP `502`, classified as `transportRejected`, with `businessAccepted=false`.

Current classification:

- The prior `subjectivesmodreq` root-name defect remains fixed.
- The prior `Insurance_Combination_Number` top-level field-location defect remains fixed.
- A post-insurance-field-fix live retry has now been consumed exactly once.
- No `subjectivesv2` Trial business acceptance exists.

## Goal

Investigate the post-insurance-field-fix HTTP `502` using no-live, repo-local, sanitized checks first. Do not run another live `subjectivesv2` retry in this prompt.

## Exact Identity Already Consumed

- Workflow: `subjectivesv2`
- ORCA endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Target: `00001`
- Operation: `create`
- Request number/class: `01` equivalent / `01`
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

## Required Workflow

1. Confirm branch, HEAD, git status, and worktrees.
2. Review the sanitized evidence from RUN_ID `20260424T133658Z`.
3. Inspect server-side `subjectivesv2` request mapping, request XML shape tests, and safe wrapper payload contract against the official ORCA `subjectivesv2` contract.
4. Add or update no-live focused tests only if a concrete repo-local defect is found.
5. Run relevant no-live verification.
6. If and only if a concrete repo-local defect is fixed, update this handoff for a future worker with a new exact one-attempt retry scope. Do not execute that live retry in the same investigation prompt.
7. If no repo-local defect can be established from sanitized/no-live evidence, record the blocker as `blocked_trial_transport_502_no_repo_local_fix_identified` and continue to independent non-live roadmap work.

## Allowed Actions

- Read and update `web-client/` and `server-modernized/` only.
- Use official `subjectivesv2` contract documentation for field placement and request/response semantics.
- Run no-live unit/component/contract tests and wrapper dry-runs.
- Update sanitized evidence, summary, handoff state, matrices, and claim boundaries.

## Forbidden Actions

- Any live `subjectivesv2` retry in this investigation prompt.
- Running live `diseasev3`.
- Any endpoint/request identity other than no-live checks for the `subjectivesv2` checkpoint above.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Unsanitized container logs if they could contain request/response bodies, credentials, patient details, or insurance details.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized review of the RUN_ID `20260424T133658Z` live retry.
- No-live test/dry-run evidence for any contract hypothesis.
- If code changes are made, focused tests proving the fix.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Claim boundary showing no SOAP business acceptance and no diseasev3, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when a concrete no-live repo-local fix is implemented and verified, or when the investigation is classified as blocked/inconclusive without another live retry.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
