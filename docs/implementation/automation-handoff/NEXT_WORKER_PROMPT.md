# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T10:02:23Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-transport-rejected-404-runtime-route-check
priority: high
supersedes:
- subjectivesv2-live-trial-checkpoint-readiness-not-run

## Context

RUN_ID `20260424T100223Z` executed the exact approved `subjectivesv2` live Trial checkpoint through the safe wrapper/evidence mode.

- Report: `docs/implementation/rwo06d-subjectivesv2-live-checkpoint-20260424T100223Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-live-checkpoint-20260424T100223Z/summary.sanitized.json`
- Wrapper live evidence: `docs/implementation/rwo06d-subjectivesv2-live-checkpoint-20260424T100223Z/wrapper-live-attempt/phase4-soap-disease-summary.sanitized.json`
- Endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

Current classification:

- No accepted duplicate checkpoint existed before the attempt.
- Backend health/readiness were `200/200`.
- The sanitized authenticated live wrapper POST returned HTTP `404`.
- Business classification is `transportRejected`; `businessAccepted=false`.
- Focused source-level server tests passed for `OrcaChartSupportResourceTest` and `PublicRouteInventoryContractTest`, so the current source contains the route contract.

## Goal

Resolve the runtime route/deployment blocker without blind live retry. Verify that the active non-S3 local Trial runtime is running the current `server-modernized` build that exposes `POST /api/orca/official/chart-support/subjectives-mod-v2`. Only after that evidence exists, rerun the same exact `subjectivesv2` checkpoint once through the safe wrapper.

## Allowed Actions

- Inspect `setup-modernized-env.sh`, Docker compose config, server route deployment, and non-S3 runtime startup logs without printing secrets.
- Rebuild/restart only the current master worktree local dev/Trial runtime if needed.
- Run source-level server tests and wrapper dry-runs.
- Run one retry of the exact `subjectivesv2` checkpoint only after route deployment evidence shows the current route is available.
- Write sanitized evidence, route deployment blocker records, summaries, and handoff updates.

## Forbidden Actions

- Blindly rerunning the live checkpoint before route deployment/current-runtime evidence is recorded.
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

- Sanitized route deployment/current-runtime check showing whether the active backend contains `subjectives-mod-v2`.
- No-live wrapper syntax/tests and exact payload dry-run.
- Duplicate-live checkpoint decision.
- If retry runs: sanitized Trial result with endpoint, target, request class, parsed business-success classification, credentialsCaptured=false, rawArtifactsCaptured=false.
- If retry does not run: sanitized blocker record with reason and next smallest safe step.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no broad SOAP/disease, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when the route/deployment blocker is either resolved and the exact checkpoint is rerun/classified, or the blocker is narrowed with sanitized evidence and a precise next action.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
