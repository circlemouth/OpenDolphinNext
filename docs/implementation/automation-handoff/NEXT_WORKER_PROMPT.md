# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T11:10:30Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-post-rebuild-exact-retry-not-run
priority: high
supersedes:
- subjectivesv2-live-trial-transport-rejected-404-runtime-route-check

## Context

RUN_ID `20260424T110223Z` investigated the prior `subjectivesv2` HTTP `404` transport rejection without raw artifact capture.

- Report: `docs/implementation/rwo06d-subjectivesv2-runtime-route-check-20260424T110223Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-runtime-route-check-20260424T110223Z/summary.sanitized.json`
- Route evidence: `docs/implementation/rwo06d-subjectivesv2-runtime-route-check-20260424T110223Z/route-deployment.sanitized.json`
- Wrapper dry-run evidence: `docs/implementation/rwo06d-subjectivesv2-runtime-route-check-20260424T110223Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Live retry evidence: `docs/implementation/rwo06d-subjectivesv2-runtime-route-check-20260424T110223Z/wrapper-live-retry/phase4-soap-disease-summary.sanitized.json`

Findings:

- Pre-rebuild authenticated route probe showed `medical-mod-v2=400`, `subjectives-mod-v2=404`, `disease-mod-v3=404`, narrowing the blocker to a stale running WAR.
- `server-modernized-dev` was rebuilt from current `master` and recreated using local gitignored runtime config without printing secret values.
- Post-rebuild health/readiness were `200/200`.
- Post-rebuild authenticated empty-payload route probe showed `medical-mod-v2=400`, `subjectives-mod-v2=400`, `disease-mod-v3=400`, proving the current runtime contains the SOAP/disease routes.
- One exact live retry was executed before the rebuild evidence existed and was again `transportRejected` / HTTP `404`; it is not post-fix business evidence.

Earlier RUN_ID `20260424T100223Z` executed the exact approved `subjectivesv2` live Trial checkpoint through the safe wrapper/evidence mode.

- Report: `docs/implementation/rwo06d-subjectivesv2-live-checkpoint-20260424T100223Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-live-checkpoint-20260424T100223Z/summary.sanitized.json`
- Wrapper live evidence: `docs/implementation/rwo06d-subjectivesv2-live-checkpoint-20260424T100223Z/wrapper-live-attempt/phase4-soap-disease-summary.sanitized.json`
- Endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

Current classification:

- Runtime route/deployment blocker is resolved for current local Trial runtime.
- No post-rebuild live Trial business evidence exists yet.
- The owner/responsible approver has explicitly authorized every subsequent worker to run up to three post-rebuild live retry attempts for the same exact `subjectivesv2` checkpoint key below, through the safe wrapper only.

## Goal

Run the same exact `subjectivesv2` checkpoint through the safe wrapper against the rebuilt current local Trial runtime. Each subsequent worker may perform up to three live attempts for this active handoff. Classify business success only from allowlisted parsed fields. Stop immediately after business acceptance, a non-skippable safety stop, target drift, parser ambiguity, credential/raw-artifact risk, or after that worker's third non-accepted attempt. Do not run any other SOAP/disease endpoint or request class.

## Allowed Actions

- Confirm the current runtime still has health/readiness `200/200`.
- Confirm authenticated empty-payload `POST /api/orca/official/chart-support/subjectives-mod-v2` still returns `400` rather than `404`.
- Run wrapper syntax/tests and the exact payload dry-run if needed.
- Run up to three live retry attempts per subsequent worker of the exact `subjectivesv2` checkpoint through `web-client/scripts/qa-phase4-safe-soap-disease.mjs`.
- Before each live attempt, record sanitized preflight evidence: current route status, runtime readiness, duplicate checkpoint decision, exact payload SHA, and attempt number `1` / `2` / `3`.
- After each live attempt, record sanitized result evidence and decide whether another attempt is justified by new evidence or the same still-valid post-rebuild preflight state.
- Write sanitized evidence, route deployment blocker records, summaries, and handoff updates.

## Forbidden Actions

- Running live before confirming post-rebuild route status is still not `404`.
- A single worker running a fourth live retry for this prompt without a new explicit owner approval or updated handoff scope.
- Live `diseasev3` execution.
- Any `subjectivesv2` identity other than the exact checkpoint key above.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized post-rebuild route deployment/current-runtime check showing `subjectives-mod-v2` is available.
- No-live wrapper syntax/tests and exact payload dry-run.
- Duplicate-live checkpoint decision.
- Sanitized Trial result for every live attempt with attempt number, endpoint, target, request class, parsed business-success classification, credentialsCaptured=false, rawArtifactsCaptured=false.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no broad SOAP/disease, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when the exact post-rebuild `subjectivesv2` checkpoint is classified as business accepted, a worker exhausts its three allowed live retries without acceptance and records the next precise handoff decision, or a safety stop condition is reached with sanitized evidence.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
