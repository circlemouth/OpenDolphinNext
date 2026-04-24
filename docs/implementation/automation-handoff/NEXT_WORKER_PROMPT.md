# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T14:37:30Z
source_work_order: RWO-06D-soap-next
blocker_id: subjectivesv2-live-trial-post-request-number-fix-transport-rejected-502-investigation
priority: high
supersedes:
- subjectivesv2-live-trial-post-request-number-fix-exact-retry-not-run

## Context

RUN_ID `20260424T142513Z` rebuilt/recreated the current non-S3 Trial runtime after the `subjectivesv2` request-number omission fix and executed the exact approved live wrapper scope.

- Report: `docs/implementation/rwo06d-subjectivesv2-post-request-number-live-retry-20260424T142513Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06d-subjectivesv2-post-request-number-live-retry-20260424T142513Z/summary.sanitized.json`
- Live wrapper attempts:
  - attempt 1: HTTP `502`, `transportRejected`, `businessAccepted=false`
  - attempt 2: HTTP `502`, `transportRejected`, `businessAccepted=false`
  - attempt 3: HTTP `502`, `transportRejected`, `businessAccepted=false`

The owner permitted live wrapper operation up to 3 attempts during that run. All allowed attempts were consumed. Do not run another live `subjectivesv2` retry from this prompt.

Previously fixed repo-local defects remain fixed:

- `subjectivesmodreq` root name.
- `Insurance_Combination_Number` field location.
- extra body `Request_Number` field; create now uses query `class=01` only.

Current classification:

- Runtime route deployment is present: authenticated empty JSON `POST /api/orca/official/chart-support/subjectives-mod-v2` returned HTTP `400` validation rejection before each live attempt.
- Status-only health/readiness returned `200` / `200` before each live attempt.
- Exact payload SHA-256 remained `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`.
- No `subjectivesv2` Trial business acceptance exists.

## Goal

Investigate the repeated post-request-number-fix `subjectivesv2` HTTP `502` with no-live contract/runtime checks only. Identify a concrete repo-local defect if one exists, fix it, and run focused no-live verification. If no concrete repo-local defect can be established without raw ORCA artifacts, record the blocker as inconclusive/Trial-side or parser/sanitizer-limited and continue to the next independent safe Work Order.

## Exact Identity Under Investigation

- Workflow: `subjectivesv2`
- ORCA endpoint: `/orca25/subjectivesv2`
- Official server route: `/api/orca/official/chart-support/subjectives-mod-v2`
- Target: `00001`
- Operation: `create`
- Request/class: query `class=01` only
- Payload: `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json`
- Payload SHA-256: `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`
- Duplicate-live checkpoint key: `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308`

## Allowed Actions

- Review current source, tests, sanitized summaries, and official ORCA `subjectivesv2` contract material.
- Add or update no-live unit tests, parser/sanitizer contract tests, and XML-shape assertions.
- Fix repo-local `server-modernized` / `web-client` wrapper defects if concrete evidence supports the fix.
- Run focused no-live verification and wrapper dry-runs.
- Update sanitized evidence, summary, handoff state, roadmap claim boundaries, and next prompt.

## Forbidden Actions

- Live `subjectivesv2` retry from this prompt.
- Live `diseasev3`.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Unsanitized container logs if they could contain request/response bodies, credentials, patient details, or insurance details.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized review of the 3 HTTP `502` attempts from RUN_ID `20260424T142513Z`.
- No-live contract/runtime finding or explicit inconclusive classification.
- Focused tests for any fix.
- Wrapper dry-run evidence for the exact payload if a fix is made.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Claim boundary showing no SOAP business acceptance unless endpoint-specific parsed success criteria are met, and no diseasev3, fullflow, production ORCA, or S3/object-storage claim.

## Completion Criteria

This prompt is complete when one of the following is true:

- A concrete repo-local defect is fixed and no-live verification passes, with a new handoff explicitly stating whether and how a future exact live retry is permitted.
- No concrete repo-local defect can be established safely, and the blocker is recorded as inconclusive/Trial-side/parser-limited with no live retry authorization.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, live Trial endpoint/target/request class if reviewed, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts captured.
