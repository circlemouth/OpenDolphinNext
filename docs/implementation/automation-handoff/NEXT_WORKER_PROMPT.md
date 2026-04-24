# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T04:48:03Z
source_work_order: RWO-06F2
blocker_id: instruction-charge-class-130-v1-business-rejected
priority: high
supersedes:
- order-item-instruction-charge-live-gap

## Context

The owner clarified that order-item readiness must cover documents, `文書料`, `指導料`, tests, treatments, injections, and the rest of the current chart order surface.

RUN_ID `20260424T044007Z` created the exhaustive matrix:

- `docs/implementation/rwo06e-order-item-reachability-matrix-20260424T044007Z/ORDER_ITEM_TRIAL_REACHABILITY_MATRIX.md`
- `docs/implementation/rwo06e-order-item-reachability-matrix-20260424T044007Z/summary.sanitized.json`

RUN_ID `20260424T044803Z` completed the first `instractionChargeOrder` / `指導料` class `130` wrapper route:

- Payload: `web-client/qa/payloads/phase4/medicalmodv2_instruction_charge_trial_reachability_v1.json`
- Workflow: `instruction-charge`
- Duplicate checkpoint: `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e`
- No-live unit test and wrapper dry-run passed.
- Runtime readiness before live was health HTTP `200` and readiness HTTP `200`.
- One sanitized live Trial attempt executed and returned HTTP `200` / `businessRejected`; business accepted is `false`.
- Evidence: `docs/implementation/rwo06f-instruction-charge-medicalmodv2-20260424T044803Z/FINAL_REPORT.md`

Do not repeat this v1 live identity.

## Goal

Resolve the `instractionChargeOrder/130` blocker without raw artifacts:

1. Investigate, using repo-local contracts and sanitized allowlisted evidence only, whether a v2 class `130` candidate can be defined with a different Trial-valid billing item or encounter prerequisite.
2. If a v2 candidate is justified, add or update payload manifest, no-live tests, wrapper dry-run, and duplicate-live checkpoint.
3. Run at most one live Trial attempt for that new v2 identity only after focused no-live verification, dry-run, readiness HTTP `200` / `200`, and duplicate-live precheck pass.
4. If no v2 candidate can be justified without raw ORCA bodies or a human business/Trial data decision, classify `instractionChargeOrder/130` as blocked and move to the next independent non-S3 order family from the matrix.

## Allowed Actions

- Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
- Inspect existing payloads, wrapper tests, server XML construction tests, UI/server catalogs, and sanitized summaries.
- Add or update repo-local safe payload manifest entries, wrapper contract tests, sanitizer tests, and wrapper dry-runs for a new `instractionChargeOrder` class `130` v2 candidate only when the candidate is justified by sanitized evidence.
- Run no-live tests, guard scripts, wrapper dry-runs, parser/sanitizer tests, and status-only health/readiness probes.
- Run at most one sanitized live Trial attempt for a new v2 identity only when all live prerequisites pass.
- Update roadmap docs, matrices, sanitized evidence, and handoff state.
- Commit roadmap/handoff-scoped tracked changes before reporting.

## Forbidden Actions

- Repeating the v1 duplicate checkpoint or making blind live retries.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- `diseasev3` or `subjectivesv2` live execution.
- Treating any single `指導料` class acceptance as all `指導料` variants or all order items.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD.
- v1 rejection classification and explicit non-repeat statement.
- If a v2 payload is created: payload SHA-256, workflow, duplicate checkpoint, dry-run, tests, readiness, and live classification if executed.
- If blocked: precise sanitized blocker record and next independent non-S3 order family.
- Secret/raw-artifact scan over new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- A v2 `instractionChargeOrder/130` identity achieves sanitized live Trial business acceptance.
- A v2 candidate is created and no-live verified, but live execution is skipped for a sanitized readiness/environment reason.
- `instractionChargeOrder/130` is classified as pending business/Trial data decision, and the next independent order family is queued.
- A stricter stop condition is reached and recorded.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, blind live retry, broad all-order claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current/next Work Order, v1 blocker or v2 result, files changed, commit id, tests/checks, Trial ORCA endpoint/target/request class if live was used, blockers, recommended next action, credentials captured, and raw artifacts captured.
