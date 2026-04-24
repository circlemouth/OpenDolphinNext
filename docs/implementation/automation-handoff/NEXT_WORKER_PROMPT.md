# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T05:53:30Z
source_work_order: RWO-06E-next
blocker_id: test-class-600-no-live-wrapper-not-created
priority: high
supersedes:
- surgery-class-500-no-live-wrapper-not-created

## Context

RUN_ID `20260424T055036Z` completed RWO-06I:

- Report: `docs/implementation/rwo06i-surgery-medicalmodv2-20260424T055036Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06i-surgery-medicalmodv2-20260424T055036Z/summary.sanitized.json`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_surgery_trial_reachability_v1.json`
- SHA-256: `23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000`
- Duplicate checkpoint: `rwo06i:medicalmodv2:rwo06i-surgery-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000`
- No-live test and dry-run passed; readiness was health HTTP `200` / readiness HTTP `200`.
- One live Trial attempt executed. The live result was HTTP `200` but business classification `businessRejected`; business accepted is `false`.

Do not repeat these duplicate-live checkpoints:

- `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e`
- `rwo06g:medicalmodv2:rwo06g-base-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-d2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93`
- `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-c01169729cb86d1c68211e4b01f6c38bf3dde0ac948100c53855ec91f1b9010e`
- `rwo06i:medicalmodv2:rwo06i-surgery-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000`

The next independent non-S3 order family from the matrix is `testOrder` / Claim007 class `600`.

## Goal

Create and no-live verify a safe `testOrder/600` `medicalmodv2` payload identity, then run at most one live Trial attempt only if the candidate is justified by repo-local sanitized evidence and all prerequisites pass.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Inspect repo-local UI/server catalogs, tests, XML construction, and sanitized summaries for a representative `testOrder/600` candidate.
3. If justified, add payload manifest entry, safe wrapper workflow, no-live tests, dry-run evidence, and duplicate-live checkpoint.
4. Run at most one sanitized live Trial attempt for the new test-order identity after readiness HTTP `200` / `200` and duplicate checkpoint precheck.
5. If no candidate can be justified without raw ORCA bodies or a human business/Trial data decision, classify `testOrder/600` as blocked and move to the next independent non-S3 order family.
6. Update roadmap docs, matrices, sanitized evidence, and handoff state.
7. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Inspect existing payloads, wrapper tests, server XML construction tests, UI/server catalogs, and sanitized summaries.
- Add or update repo-local safe payload manifest entries, wrapper contract tests, sanitizer tests, and wrapper dry-runs for a justified `testOrder/600` candidate.
- Run no-live tests, guard scripts, wrapper dry-runs, parser/sanitizer tests, and status-only health/readiness probes.
- Run one sanitized live Trial attempt for a new test-order identity only when all prerequisites pass.
- Update roadmap docs, matrices, handoff state, and sanitized evidence.

## Forbidden Actions

- Repeating accepted or rejected duplicate checkpoints.
- Reopening RWO-06F2, RWO-06G, RWO-06H, or RWO-06I live Trial without a new justified candidate.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- `diseasev3` or `subjectivesv2` live execution.
- Treating one test class as all test variants or all order items.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD.
- Payload SHA-256, workflow, duplicate checkpoint, dry-run, tests, readiness, and live classification if executed.
- If blocked: precise sanitized blocker record and next independent non-S3 order family.
- Secret/raw-artifact scan over new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- The `testOrder/600` identity achieves sanitized live Trial business acceptance.
- The live attempt executes once and records a sanitized non-accepted business classification.
- A no-live candidate is created but live execution is skipped for a sanitized readiness/environment reason.
- `testOrder/600` is classified as pending business/Trial data decision and the next independent order family is queued.
- A stricter stop condition is reached and recorded.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, broad all-order claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, test-order result, files changed, commit id, tests/checks, Trial ORCA endpoint/target/request class if live was used, blockers, recommended next action, credentials captured, and raw artifacts captured.
