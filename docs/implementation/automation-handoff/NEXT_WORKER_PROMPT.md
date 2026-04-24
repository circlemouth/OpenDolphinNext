# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T12:31:00Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-post-root-fix-transport-rejected-502-contract-investigation
priority: high
supersedes:
- subjectivesv2-live-trial-post-rebuild-transport-rejected-502-investigation

## Context

RUN_ID `20260424T121609Z` completed the prior investigation prompt by investigating before retry.

- Report: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/summary.sanitized.json`
- Route preflight: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/route-preflight-post-fix.sanitized.json`
- Dry-run evidence: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Live post-fix evidence: `docs/implementation/rwo06d-subjectivesv2-502-investigation-20260424T121609Z/wrapper-live-post-fix-attempt-1/phase4-soap-disease-summary.sanitized.json`

Investigation found and fixed a repo-local request XML root mismatch:

- Previous emitted request root: `subjectivesreq`
- Fixed emitted request root: `subjectivesmodreq`
- Files changed:
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
  - `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportResourceTest.java`

Verification before live retry:

- `npm --prefix web-client test -- phase4SoapDiseaseSafeEvidence.test.ts`: pass / 11 tests
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportResourceTest test`: pass / 13 tests
- rebuilt and recreated `server-modernized-dev`
- health/readiness: `200/200`
- authenticated empty JSON `POST /api/orca/official/chart-support/subjectives-mod-v2`: expected `400`
- wrapper dry-run: pass, no live ORCA

Because this was a material changed precondition, exactly one post-fix live Trial retry was run:

- Workflow: `subjectivesv2`
- ORCA endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Target: `00001`
- Operation: `create`
- Request number/class: `01` equivalent / `01`
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

Post-fix live result:

- Attempt 1 after root fix: HTTP `502`, `transportRejected`, `businessAccepted=false`

Current classification:

- The previously found repo-local root mismatch is fixed but was not sufficient for Trial business acceptance.
- Runtime route/deployment is healthy and route validation is reachable.
- No `subjectivesv2` Trial business acceptance exists.
- Further identical live retries are not permitted under unchanged preconditions.
- The next safe step is a second investigation pass focused on remaining request-contract, query/class, payload semantic, and upstream Trial compatibility differences.

## Goal

Classify the remaining post-root-fix `subjectivesv2` HTTP `502` transport rejection using sanitized, allowlisted evidence. Do not retry first. Use static source review, official contract review, local request-shape tests, wrapper/parser contract tests, and status-only runtime checks to identify whether another repo-local non-secret defect exists.

The required workflow is:

1. Investigate the remaining `502` before any live retry.
2. Form a concrete sanitized hypothesis that is different from the fixed root-name defect.
3. Apply a repo-local fix or document the external/environment condition.
4. Run no-live verification.
5. Only then decide whether exactly one new live retry is justified.

## Allowed Actions

- Inspect `server-modernized/` and `web-client/scripts/` source for `subjectives-mod-v2` XML field names, query parameter/class handling, endpoint path, payload mapping, response mapping, sanitizer/classifier behavior, timeout/TLS policy, and ORCA endpoint selection.
- Inspect non-secret official ORCA documentation for request/response shape and compare it to the generated XML without storing raw request bodies.
- Add focused unit/contract tests that assert the allowlisted request shape using non-sensitive dummy values.
- Confirm health/readiness and authenticated empty-payload route status using sanitized status-only evidence if runtime-dependent checks are performed.
- Update wrapper/parser/sanitizer tests or docs if they prevent repeated blind retries.
- If another repo-local bug is clearly identified and can be fixed without changing legacy `client/` or `server/`, implement it and verify it.
- Create a new active handoff prompt only if the next step needs a newly scoped live retry or a human/environment decision.
- If a live retry becomes justified, scope it to one attempt unless a new owner prompt explicitly authorizes more attempts with a new diagnosis-backed reason.

## Forbidden Actions

- Running another live `subjectivesv2` Trial retry before this second investigation produces a new explicit retry decision.
- Running multiple identical live retries under unchanged preconditions.
- Treating retry count as a substitute for diagnosis.
- Reverting the `subjectivesmodreq` fix.
- Running live `diseasev3`.
- Any endpoint/request identity other than the `subjectivesv2` checkpoint listed above.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Unsanitized container logs if they could contain request/response bodies, credentials, patient details, or insurance details.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized current-runtime route/readiness status if runtime-dependent checks are performed.
- Source/test evidence identifying the remaining likely `502` root-cause class, or evidence that it remains unresolved.
- A retry decision record that explicitly states `retryPermitted=false` unless there is a new material changed precondition, a verified repo-local fix, or sanitized evidence of changed upstream/runtime state.
- Relevant focused tests/checks and their results.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no SOAP business acceptance, diseasev3, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when one of the following is true:

- A second repo-local defect explaining the remaining `502` is fixed, verified, documented, and a new precise one-attempt live retry handoff is created if live confirmation is still required.
- The remaining `502` is classified as an environment/upstream/credential/config issue without exposing secrets or raw bodies, and the next required action is recorded.
- A safety stop condition is reached and documented with sanitized evidence.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
