# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-24T06:15:49Z
source_work_order: RWO-06B-next
blocker_id: soap-disease-safe-wrapper-business-scope-not-created
priority: high
supersedes:
- radiology-class-700-no-live-wrapper-not-created

## Context

RUN_ID `20260424T061549Z` completed RWO-06K:

- Report: `docs/implementation/rwo06k-radiology-medicalmodv2-20260424T061549Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06k-radiology-medicalmodv2-20260424T061549Z/summary.sanitized.json`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_radiology_trial_reachability_v1.json`
- SHA-256: `d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e`
- Duplicate checkpoint: `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e`
- No-live test and dry-run passed; readiness was health HTTP `200` / readiness HTTP `200`.
- One live Trial attempt executed. The live result was HTTP `200` but business classification `businessRejected`; business accepted is `false`.

Do not repeat these duplicate-live checkpoints:

- `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e`
- `rwo06g:medicalmodv2:rwo06g-base-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-d2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93`
- `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-c01169729cb86d1c68211e4b01f6c38bf3dde0ac948100c53855ec91f1b9010e`
- `rwo06i:medicalmodv2:rwo06i-surgery-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000`
- `rwo06j:medicalmodv2:rwo06j-test-order-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2`
- `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e`

RWO-06B still classifies SOAP and disease CRUD as local-only current product paths pending endpoint-specific safe wrappers, business scope, and success criteria.

## Goal

Create a no-live blocker-resolution package for SOAP/`subjectivesv2` and disease CRUD/`diseasev3` reachability prep. Do not run live SOAP or disease Trial mutations in this prompt unless a later prompt explicitly adds endpoint-specific safe wrappers, no-live parser/sanitizer tests, business success criteria, and live approval for the exact endpoint identity.

1. Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
2. Inspect current local SOAP and disease UI/API/server paths plus existing dummy native-intent payloads.
3. Define the trust boundary, required safe wrapper properties, endpoint-specific success criteria, and remaining business-scope decisions for `subjectivesv2` and `diseasev3`.
4. Add or update sanitized docs/tests only if they can be completed without raw ORCA bodies, credentials, browser artifacts, production ORCA, S3/object-storage, or legacy `client/` / `server/` changes.
5. Update roadmap docs, matrices, sanitized evidence, and handoff state.
6. Commit roadmap/handoff-scoped tracked changes before reporting.

## Allowed Actions

- Inspect existing payloads, local SOAP/disease tests, server endpoint mappings, safe wrapper utilities, and sanitized summaries.
- Add no-live wrapper design docs, blocker records, parser/sanitizer contract tests, and safe command guards.
- Run no-live tests, guard scripts, JSON validation, doc link checks, and secret/raw-artifact scans.

## Forbidden Actions

- Live `subjectivesv2` or `diseasev3` execution from this prompt.
- Request_Number `02` / `03` / `04`.
- Fullflow execution.
- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD.
- SOAP/disease endpoint-specific safe-wrapper gap analysis and success-criteria proposal.
- Tests/checks run, or sanitized skip records for environment-only blockers.
- Secret/raw-artifact scan over new tracked evidence docs.

## Completion Criteria

This prompt is complete when a no-live SOAP/disease safe-wrapper prep record is committed, with clear next steps for endpoint-specific wrappers and no live execution.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, Request_Number `02` / `03` / `04`, broad SOAP/disease claim, or final release readiness claim

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, SOAP/disease prep result, files changed, commit id, tests/checks, blockers, recommended next action, credentials captured, and raw artifacts captured.
