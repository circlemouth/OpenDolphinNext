# NEXT_WORKER_PROMPT

status: completed
created_at: 2026-04-24T03:07:10Z
source_work_order: RWO-06D
blocker_id: rwo06b-endpoint-specific-medicalmodv2-wrapper-gap
priority: high
supersedes:
- phase4-medicalmodv2-business-rejected-api-result-14
- rwo06b-trial-reachability-inventory-20260424T030710Z

## Context

RUN_ID `20260424T031608Z` completed this prompt. Prescription and representative treatment/generic endpoint-specific `medicalmodv2` payload identities were defined, no-live wrapper tests and dry-runs passed, duplicate-live checkpoint keys were recorded, and one sanitized live Trial mutation for each active v2 identity returned `businessAccepted`.

Evidence:

- `docs/implementation/rwo06d-medicalmodv2-endpoint-wrapper-prep-20260424T031608Z/FINAL_REPORT.md`
- `docs/implementation/rwo06d-medicalmodv2-endpoint-wrapper-prep-20260424T031608Z/summary.sanitized.json`
- `docs/implementation/rwo06d-medicalmodv2-endpoint-wrapper-prep-20260424T031608Z/qa/prescription-v2-live/phase4-medicalmodv2-summary.sanitized.json`
- `docs/implementation/rwo06d-medicalmodv2-endpoint-wrapper-prep-20260424T031608Z/qa/treatment-generic-v2-live/phase4-medicalmodv2-summary.sanitized.json`

RUN_ID `20260424T030710Z` completed RWO-06B as a static, sanitized Trial reachability inventory:

- `docs/implementation/rwo06b-trial-reachability-inventory-20260424T030710Z/FINAL_REPORT.md`
- `docs/implementation/rwo06b-trial-reachability-inventory-20260424T030710Z/REACHABILITY_MATRIX.md`
- `docs/implementation/rwo06b-trial-reachability-inventory-20260424T030710Z/summary.sanitized.json`

The inventory found:

- Prescription and representative treatment/generic order send paths both use `POST /api/orca/official/chart-support/medical-mod-v2` to ORCA `medicalmodv2` (`/api21/medicalmodv2`, query `class=01`).
- Existing RUN_ID `20260423T150257Z` live Trial acceptance proves only one scoped `medicalmodv2` payload identity for target `00001`; it must not be treated as broad prescription or representative treatment/generic reachability.
- SOAP currently saves through local-only `/api/local/charts/subjectives`; `subjectivesv2` live work remains blocked until a separate safe wrapper/parser/success criteria and business scope exist.
- Disease CRUD currently saves through local-only `/api/local/diagnoses`; disease master candidate read is not `diseasev3` CRUD reachability.
- Request_Number `02` / `03` / `04`, diseasev3, subjectivesv2, fullflow, production ORCA, and S3/object-storage remain forbidden or separately gated.

## Goal

Close the RWO-06D wrapper-prep gap for the two medicalmodv2-backed workflows only:

1. Define prescription-specific `medicalmodv2` safe payload identity, no-live contract tests, sanitizer expectations, duplicate-live checkpoint key, and endpoint-specific business-success criteria.
2. Define representative treatment/generic `medicalmodv2` safe payload identity, no-live contract tests, sanitizer expectations, duplicate-live checkpoint key, and endpoint-specific business-success criteria.

After those are implemented and no-live verification passes, run live Trial mutation only if all safe-wrapper prerequisites and readiness gates pass and the action is non-duplicate.

## Allowed Actions

- Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
- Read the RWO-06B inventory and existing sanitized `medicalmodv2` wrapper/evidence.
- Inspect source, tests, request construction, DTO mapping, payload validators, and sanitized wrapper summaries.
- Add or update repo-local safe payload manifest entries, wrapper contract tests, sanitizer tests, and wrapper dry-runs for prescription/treatment `medicalmodv2` only.
- Run no-live unit/component/contract tests, guard scripts, wrapper dry-runs, parser/sanitizer tests, and status-only health/readiness probes.
- Run at most one sanitized live Trial attempt per newly defined endpoint-specific `medicalmodv2` payload identity only if:
  - the candidate request remains Request_Number `01` and class code `01`;
  - Request_Number `02` / `03` / `04` remain forbidden;
  - the endpoint-specific payload identity has not already been accepted in a prior run;
  - focused no-live verification passes;
  - wrapper dry-run passes;
  - wrapper readiness gate reports health/readiness 2xx;
  - no S3/object-storage or production ORCA requirement is introduced.
- Update `HANDOFF_STATE.json`, the release gate matrix, the RWO-06B matrix if needed, and run-specific sanitized evidence docs.
- Commit roadmap/handoff-scoped tracked changes before reporting.

## Forbidden Actions

- Blind or tight-loop live retries without a preceding investigation/fix/focused no-live verification cycle.
- Live retry while readiness is not 2xx.
- Phase3 / `acceptmodv2` rerun.
- Fullflow execution.
- Request_Number `02` / `03` / `04`.
- `diseasev3` or `subjectivesv2` live execution.
- Treating existing scoped `medicalmodv2` acceptance as prescription-specific or treatment/generic-specific acceptance without a new endpoint-specific payload identity.
- Production ORCA execution or production ORCA readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- Reading or printing generated runtime files that may contain credentials except through presence-only/sanitized classification.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD and status-only readiness evidence.
- Endpoint-specific payload/wrapper classification for prescription and treatment/generic `medicalmodv2`.
- Focused tests/checks run and results.
- If live Trial is executed: source/doc changes, focused verification, wrapper dry-run, readiness `ok=true`, duplicate-live checkpoint result, and single live classification.
- If not fixable in the run: sanitized blocker record with precise next independent task.
- Secret/raw-artifact scan over new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- Prescription-specific and representative treatment/generic `medicalmodv2` live Trial business acceptance is achieved through safe wrappers with endpoint-specific completion evidence.
- The no-live wrapper/payload work is complete but live execution is skipped for a sanitized environment/runtime readiness reason, with checkpoint keys recorded.
- A next narrower blocker prompt is written because the remaining work requires a human business decision, new Trial data setup decision, or information that cannot be obtained safely without raw ORCA bodies.
- A stricter stop condition is reached and recorded with sanitized evidence.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, blind live retry, or final release readiness claim

## Stop Conditions

- Root-cause classification would require raw ORCA request/response bodies, raw patient or insurance details, credentials, HAR/trace/video/screenshot/raw network artifacts, or backend logs containing unredacted secrets.
- A live retry would be required before endpoint-specific payload identity, duplicate-live checkpointing, and focused no-live verification are complete.
- Production ORCA or S3/object-storage configuration would be required instead of being skippable.
- Target/scope ambiguity.
- Unsafe repo state or unrelated worktree changes make a safe commit impossible.

## Final Report Requirements

Use `【ワーカー報告】` and include:

- branch and HEAD
- active handoff prompt and source evidence path
- current Work Order and next Work Order
- endpoint-specific wrapper/payload classification or blocker classification
- files changed and commit id
- tests/checks run
- Trial ORCA endpoint/target/request class if any live step was used
- blockers and recommended next action
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
