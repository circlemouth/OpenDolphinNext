# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T13:36:00Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-post-insurance-field-fix-exact-retry-not-run
priority: high
supersedes:
- subjectivesv2-live-trial-post-root-fix-transport-rejected-502-contract-investigation

## Context

RUN_ID `20260424T130326Z` completed the prior investigation prompt without a live retry.

- Report: `docs/implementation/rwo06d-subjectivesv2-502-contract-investigation-20260424T130326Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-502-contract-investigation-20260424T130326Z/summary.sanitized.json`
- Dry-run evidence: `docs/implementation/rwo06d-subjectivesv2-502-contract-investigation-20260424T130326Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`

Investigation found and fixed a second repo-local `subjectivesv2` request XML contract defect:

- Previous emitted shape: `Insurance_Combination_Number` inside `HealthInsurance_Information`
- Fixed emitted shape: `Insurance_Combination_Number` directly under `subjectivesmodreq`
- Official contract reviewed: `https://www.orca.med.or.jp/receipt/tec/api/subjectives.html`
- Files changed:
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportResourceTest.java`

Verification before this handoff:

- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportResourceTest test`: pass / 13 tests
- `npm --prefix web-client test -- phase4SoapDiseaseSafeEvidence.test.ts`: pass / 11 tests
- wrapper dry-run: pass, no live ORCA

Current classification:

- The prior `subjectivesmodreq` root mismatch remains fixed.
- A second request-contract defect is fixed and verified no-live.
- No post-insurance-field-fix live Trial retry has been run.
- No `subjectivesv2` Trial business acceptance exists.

## Goal

Rebuild/recreate the current non-S3 `server-modernized` runtime with the insurance-field-location fix, prove status-only route readiness, then run exactly one sanitized live Trial retry for the same approved `subjectivesv2` checkpoint. Do not run multiple attempts.

## Exact Retry Identity

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
2. Confirm no already accepted checkpoint exists for the exact duplicate-live key.
3. Rebuild and recreate only the appropriate local non-S3 `server-modernized` runtime.
4. Record sanitized status-only health/readiness and authenticated empty-payload route preflight.
5. Run the safe wrapper dry-run for the exact payload.
6. Run exactly one live Trial retry through `web-client/scripts/qa-phase4-safe-soap-disease.mjs` using sanitized evidence mode.
7. Stop after the single attempt and classify the result using endpoint-specific parsed business criteria.

## Allowed Actions

- Use documented repo-local build/runtime commands for `server-modernized` under the object-storage-free dev/Trial profile.
- Generate or use approved local-only dev/Trial runtime values only under the automation policy; never print values.
- Run status-only health/readiness and authenticated empty-payload route checks.
- Run the exact safe SOAP/disease wrapper dry-run and one exact live Trial retry.
- Update sanitized evidence, summary, handoff state, and claim boundaries.
- If the live retry is still rejected, create a new investigation handoff; do not retry again.

## Forbidden Actions

- More than one live `subjectivesv2` retry for this prompt.
- Running live `diseasev3`.
- Any endpoint/request identity other than the `subjectivesv2` checkpoint above.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Unsanitized container logs if they could contain request/response bodies, credentials, patient details, or insurance details.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized duplicate-checkpoint decision.
- Sanitized current-runtime route/readiness status.
- Wrapper dry-run evidence.
- One live Trial wrapper summary with only allowlisted fields.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Claim boundary showing no SOAP business acceptance unless endpoint-specific parsed success criteria are met, and no diseasev3, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when exactly one post-insurance-field-fix live Trial retry is classified and documented, or a safety stop condition is reached before live execution.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
