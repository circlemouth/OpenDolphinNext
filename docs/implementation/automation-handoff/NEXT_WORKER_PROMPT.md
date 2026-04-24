# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T12:08:00Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-post-rebuild-transport-rejected-502-investigation
priority: high
supersedes:
- subjectivesv2-live-trial-post-rebuild-exact-retry-not-run

## Context

RUN_ID `20260424T120148Z` completed the prior active handoff for the exact post-rebuild `subjectivesv2` Trial checkpoint.

- Report: `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/summary.sanitized.json`
- Route preflight: `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/route-preflight.sanitized.json`
- Dry-run evidence: `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Live attempt evidence:
  - `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/wrapper-live-attempt-1/phase4-soap-disease-summary.sanitized.json`
  - `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/wrapper-live-attempt-2/phase4-soap-disease-summary.sanitized.json`
  - `docs/implementation/rwo06d-subjectivesv2-post-rebuild-live-retry-20260424T120148Z/wrapper-live-attempt-3/phase4-soap-disease-summary.sanitized.json`

The route/deployment blocker stayed resolved:

- health/readiness: `200/200`
- authenticated empty JSON `POST /api/orca/official/chart-support/subjectives-mod-v2`: `400`
- classification: `route_deployed_validation_rejected_empty_payload`

The same exact approved identity was used:

- Workflow: `subjectivesv2`
- ORCA endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Target: `00001`
- Operation: `create`
- Request number/class: `01` equivalent / `01`
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

Live result:

- Attempt 1: HTTP `502`, `transportRejected`, `businessAccepted=false`
- Attempt 2: HTTP `502`, `transportRejected`, `businessAccepted=false`
- Attempt 3: HTTP `502`, `transportRejected`, `businessAccepted=false`

Current classification:

- Runtime route/deployment blocker remains resolved.
- No `subjectivesv2` Trial business acceptance exists.
- This worker exhausted the three-authorized-attempt live retry budget for the previous prompt.
- The next safe step is investigation before retry. Do not repeat identical live attempts under unchanged conditions.
- A future retry is allowed only after a documented hypothesis/fix/config correction changes at least one material precondition, or after sanitized evidence proves the previous `502` was transient and the route/upstream state has materially changed.

## Goal

Determine the root-cause class for the post-rebuild `subjectivesv2` HTTP `502` transport rejection using only sanitized, allowlisted evidence. Prefer repo-local static analysis, configuration/route contract review, wrapper/parser contract tests, and status-only probes. If a repo-local non-secret defect is found, fix it and verify it. If no safe fix is possible, write a precise next handoff with the minimum additional evidence needed.

The required workflow is:

1. Investigate first.
2. Form a concrete sanitized hypothesis for the `502`.
3. Apply a repo-local fix or document the external/environment condition.
4. Run no-live verification.
5. Only then decide whether exactly one new live retry is justified.

## Allowed Actions

- Inspect `server-modernized/` and `web-client/scripts/` source for the `subjectives-mod-v2` official route, ORCA client path selection, upstream response mapping, and sanitizer/classifier behavior.
- Run non-live wrapper syntax/tests and focused unit/contract tests.
- Confirm current health/readiness and authenticated empty-payload route status using sanitized status-only evidence.
- Use sanitized, body-free diagnostics to distinguish route mapping, server-side validation, ORCA upstream transport, timeout/TLS, auth/session bootstrap, and response-mapping failure classes.
- Add or update tests, guard scripts, sanitizers, or documentation if needed.
- If a repo-local bug is clearly identified and can be fixed without changing legacy `client/` or `server/`, implement the fix and run relevant verification.
- Create a new active handoff prompt only if the next step needs a newly scoped live retry or a human/environment decision.
- If a live retry becomes justified, scope it to one attempt unless a new owner prompt explicitly authorizes more attempts with a new diagnosis-backed reason.

## Forbidden Actions

- Running another live `subjectivesv2` Trial retry before this `502` investigation produces a new explicit retry decision.
- Running multiple identical live retries under unchanged preconditions.
- Treating retry count as a substitute for diagnosis.
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
- Source/test evidence identifying the likely `502` root-cause class, or evidence that it remains unresolved.
- A retry decision record that explicitly states `retryPermitted=false` unless there is a material changed precondition, a verified repo-local fix, or sanitized evidence of changed upstream/runtime state.
- Relevant focused tests/checks and their results.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no SOAP business acceptance, diseasev3, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when one of the following is true:

- A repo-local defect explaining the `502` is fixed, verified, documented, and a new precise one-attempt live retry handoff is created if live confirmation is still required.
- The `502` is classified as an environment/upstream/credential/config issue without exposing secrets or raw bodies, and the next required action is recorded.
- A safety stop condition is reached and documented with sanitized evidence.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
