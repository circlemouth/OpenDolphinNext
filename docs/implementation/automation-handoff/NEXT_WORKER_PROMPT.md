# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-23T13:02:47Z
source_work_order: RWO-06
blocker_id: phase4-medicalmodv2-runtime-readiness-blocked-before-live
priority: high
supersedes:
- phase4-medicalmodv2-post-repair-transport-rejected-no-live-investigation

## Context

RWO-06 `medicalmodv2` remains the active roadmap task. Owner direction RUN_ID `20260423T122650Z` still allows repeated `medicalmodv2` fix-and-retry cycles without fresh owner approval, but only after sanitized investigation, repo-local fix when in scope, focused no-live verification, safe wrapper preflight, and sanitized evidence recording.

RUN_ID `20260423T130247Z` found and fixed a repo-local wrapper preflight defect: the Phase 4 safe wrapper recorded backend readiness but did not enforce it before live mutation. The wrapper now checks `/api/health` and `/api/health/readiness` status-only before session bootstrap or ORCA POST. With the current local runtime it blocked before live ORCA:

- health HTTP status: `200`
- readiness HTTP status: `503`
- verdict: `blocked_runtime_not_ready`
- live Trial action: `not_run`
- credentials captured: `false`
- raw artifacts captured: `false`

Evidence:

- `docs/implementation/rwo06-medicalmodv2-readiness-gate-20260423T130247Z/FINAL_REPORT.md`
- `docs/implementation/rwo06-medicalmodv2-readiness-gate-20260423T130247Z/summary.sanitized.json`
- `docs/implementation/rwo06-medicalmodv2-readiness-gate-20260423T130247Z/wrapper-readiness-blocked/phase4-medicalmodv2-summary.sanitized.json`

The previous live business result is still not accepted:

- RUN_ID `20260423T120155Z`
- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- target: `00001 / 00001`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- verdict: `live_trial_not_accepted`
- HTTP status: `500`
- response classification: `transportRejected`
- business accepted: `false`

## Goal

Investigate and repair the non-S3 Trial runtime readiness blocker without printing runtime secrets or raw ORCA data. Once readiness is 2xx and focused no-live verification passes, retry exactly one sanitized live `medicalmodv2` attempt for that cycle through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`.

## Allowed Actions

- Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
- Read sanitized evidence from the RWO-06 evidence directories listed above.
- Inspect source, tests, configuration contracts, and sanitized health/readiness paths.
- Run no-live unit/component/contract tests, guard scripts, wrapper dry-runs, parser/sanitizer tests, and status-only health/readiness probes.
- Generate only approved local-only dev/Trial runtime values when required and only under the automation local-only secret policy.
- Fix repo-local defects that cause the approved non-S3 Trial runtime readiness path to fail.
- After a repo-local fix and focused no-live verification, run one sanitized live `medicalmodv2` Trial attempt only if:
  - payload SHA-256 still matches `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`;
  - wrapper dry-run passes;
  - the wrapper readiness gate reports readiness `ok=true`;
  - no S3/object-storage or production ORCA requirement is introduced.
- Update `HANDOFF_STATE.json`, the release gate matrix, and run-specific sanitized evidence docs.
- Commit roadmap/handoff-scoped tracked changes before reporting.

## Forbidden Actions

- Live `medicalmodv2` retry while readiness is not 2xx.
- Blind or tight-loop live retries without a preceding investigation/fix/focused no-live verification cycle.
- Phase3 / `acceptmodv2` rerun.
- Fullflow execution.
- Request_Number `02` / `03` / `04`.
- `diseasev3` or `subjectivesv2` live execution.
- Production ORCA execution or production ORCA readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- Reading or printing generated runtime files that may contain credentials except through presence-only/sanitized classification.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD and status-only readiness evidence.
- Root-cause or blocker classification for readiness `503`.
- Focused tests/checks run and results.
- If fixed: source/doc changes, focused verification, wrapper dry-run, readiness `ok=true`, and single live retry classification.
- If not fixable in the run: sanitized blocker record with precise next independent task.
- Secret/raw-artifact scan over new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- The non-S3 Trial runtime readiness blocker is fixed, focused no-live verification passes, wrapper readiness is `ok=true`, and a sanitized live retry is either accepted or classified.
- The readiness blocker is classified as environment, Trial service, Trial account/config, parser ambiguity, or non-skippable safety blocker with sanitized evidence and no unsafe overclaim.
- A stricter stop condition is reached and a more specific blocker prompt is written.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, blind live retry, or final release readiness claim

## Stop Conditions

- Root-cause classification would require raw ORCA request/response bodies, raw patient or insurance details, credentials, HAR/trace/video/screenshot/raw network artifacts, or backend logs containing unredacted secrets.
- A live retry would be required before readiness is 2xx and focused no-live verification is complete.
- Production ORCA or S3/object-storage configuration would be required instead of being skippable.
- Target/scope ambiguity.
- Unsafe repo state or unrelated worktree changes make a safe commit impossible.

## Final Report Requirements

Use `【ワーカー報告】` and include:

- branch and HEAD
- active handoff prompt and source evidence path
- current Work Order and next Work Order
- root-cause classification or blocker classification
- files changed and commit id
- tests/checks run
- Trial ORCA endpoint/target/request class if any live step was used
- blockers and recommended next action
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
