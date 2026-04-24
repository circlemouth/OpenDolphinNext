# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T07:02:17Z
source_work_order: RWO-06B-next2
blocker_id: subjectivesv2-diseasev3-live-payload-identity-and-approval-not-created
priority: high
supersedes:
- subjectivesv2-diseasev3-live-integration-official-wrapper-not-created

## Context

RUN_ID `20260424T070217Z` completed the no-live server official-wrapper scaffolding step:

- Report: `docs/implementation/rwo06b-soap-disease-server-wrapper-20260424T070217Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06b-soap-disease-server-wrapper-20260424T070217Z/summary.sanitized.json`
- Routes:
  - `POST /api/orca/official/chart-support/subjectives-mod-v2`
  - `POST /api/orca/official/chart-support/disease-mod-v3`
- Fixed server endpoints:
  - `OrcaEndpoint.SUBJECTIVES_MOD`
  - `OrcaEndpoint.DISEASE_MOD_V3`
- Tests:
  - focused server wrapper/resource/inventory tests passed
  - no-live web SOAP/disease wrapper tests passed
  - wrapper scripts passed `node --check`

Current classification:

- `subjectivesv2` and `diseasev3` now have fixed server official-wrapper scaffolding.
- The parser still classifies stub HTTP 200 + zero-equivalent `Api_Result` as `notVerified`, not business success, when completion evidence is absent.
- Live SOAP/disease Trial mutation remains blocked.

## Goal

Define the next smallest safe step for exactly one endpoint-specific SOAP/disease live-readiness identity, without executing live SOAP or disease Trial mutations unless this prompt is later replaced by a prompt that explicitly authorizes one endpoint identity and duplicate-live checkpoint.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Choose the safer first endpoint identity to prepare next (`subjectivesv2` or `diseasev3`) based on current product scope, current no-live payloads, and data-minimization risk.
3. Create or update no-live payload identity metadata, duplicate-live checkpoint key, parser completion-evidence expectations, and explicit live approval/business-scope record for that one endpoint.
4. If the payload identity cannot be justified without raw patient/insurance detail or business ambiguity, record the concrete blocker and the next smallest safe no-live step instead.
5. Update roadmap docs, matrices, sanitized evidence, and handoff state.
6. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Source review in `server-modernized/`, `api-contract/`, and `web-client/`.
- Add no-live metadata, tests, parser fixtures, or wrapper dry-runs for one fixed `subjectivesv2` or `diseasev3` endpoint identity.
- Add sanitized docs, command logs, summary JSON, and handoff updates.
- Run no-live unit/contract tests, JSON validation, `node --check`, doc link checks, secret/raw-artifact scans, and `git diff --check`.

## Forbidden Actions

- Live `subjectivesv2` or `diseasev3` execution.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD.
- No-live endpoint-identity metadata/tests or a sanitized blocker record.
- Secret/raw-artifact scan over new tracked evidence docs and wrapper outputs.
- Updated claim boundary showing no SOAP/disease live Trial success claim.

## Completion Criteria

This prompt is complete when one endpoint has an explicit no-live live-readiness identity and approval/business-scope record, or when a precise repo-local blocker is recorded with the next smallest safe implementation step.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, live SOAP/disease mutation, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, blockers, recommended next action, credentials captured, and raw artifacts captured.
