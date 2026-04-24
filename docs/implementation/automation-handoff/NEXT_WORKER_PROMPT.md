# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T09:05:30Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-checkpoint-readiness-not-run
priority: high
supersedes:
- diseasev3-live-payload-identity-and-approval-not-created

## Context

RUN_ID `20260424T080121Z` prepared the endpoint-specific no-live live-readiness identity for `subjectivesv2`.

- Report: `docs/implementation/rwo06b-subjectivesv2-live-readiness-20260424T080121Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06b-subjectivesv2-live-readiness-20260424T080121Z/summary.sanitized.json`
- Workflow ID: `rwo06b-subjectivesv2-live-readiness-v1`
- Endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

RUN_ID `20260424T090051Z` prepared the endpoint-specific no-live live-readiness identity for `diseasev3`.

- Report: `docs/implementation/rwo06b-diseasev3-live-readiness-20260424T090051Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06b-diseasev3-live-readiness-20260424T090051Z/summary.sanitized.json`
- Workflow ID: `rwo06b-diseasev3-live-readiness-v1`
- Endpoint: `/orca22/diseasev3`
- Official server route: `/api/orca/official/chart-support/disease-mod-v3`
- Payload SHA-256: `da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df`

Current classification:

- Both SOAP/disease endpoints now have no-live identity and business-scope records.
- No live `subjectivesv2` or `diseasev3` Trial mutation has been executed.
- `subjectivesv2` is the next lower-risk live checkpoint because it avoids disease create/update/delete and diagnosis persistence ambiguity.

## Goal

Run only the exact `subjectivesv2` live Trial checkpoint if the approved runtime path is available and all preflight checks pass. If runtime readiness, credentials/config, non-S3 path, parser certainty, or sanitized evidence mode is unavailable, record a sanitized skip/blocker and continue to independent safe roadmap work.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Re-run no-live wrapper syntax/tests and dry-run for the exact `subjectivesv2` payload identity above.
3. Confirm the duplicate-live checkpoint has not already been accepted for this exact endpoint/target/request/class/payload identity.
4. Confirm local backend readiness through the repo-approved non-S3 runtime path without printing secrets or raw bodies.
5. If ready, execute one live WebORCA Trial mutation through the fixed official server route and the safe wrapper/evidence mode only.
6. Classify business success only from endpoint-specific parsed completion evidence. HTTP 200, wrapper exit 0, and zero `Api_Result` alone are not success.
7. Update roadmap docs, matrices, sanitized evidence, and handoff state.
8. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Source review in `server-modernized/`, `api-contract/`, `web-client/`, and docs.
- No-live unit/contract tests, wrapper dry-runs, readiness checks, and one live `subjectivesv2` Trial checkpoint for the exact identity above when preflight passes.
- Sanitized evidence docs, command logs, summaries, and handoff updates.
- Safe skip/blocker records if the runtime path is unavailable or unsafe.

## Forbidden Actions

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

- Sanitized investigation summary with branch/HEAD.
- No-live `subjectivesv2` preflight evidence for the exact payload SHA.
- Duplicate-live checkpoint decision.
- If live execution runs: sanitized Trial result with endpoint, target, request class, parsed business-success classification, credentialsCaptured=false, rawArtifactsCaptured=false.
- If live execution does not run: sanitized skip/blocker record with reason and next smallest safe step.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no broad SOAP/disease, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when the exact `subjectivesv2` checkpoint is either safely executed and classified from parsed business evidence, or skipped/blocked with a precise sanitized reason and next smallest safe step.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
