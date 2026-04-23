# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-23T12:01:55Z
source_work_order: RWO-06
blocker_id: phase4-medicalmodv2-post-repair-transport-rejected-no-live-investigation
priority: high
supersedes:
- completed post-repair live attempt prompt from 2026-04-23T11:55:35Z

## Context

RUN_ID `20260423T120155Z` consumed the fresh owner-approved post-repair WebORCA Trial `medicalmodv2` action through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`.

Sanitized result:

- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target: `00001 / 00001`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- live Trial action: `executed_once`
- verdict: `live_trial_not_accepted`
- HTTP status: `500`
- response classification: `transportRejected`
- business accepted: `false`

Evidence:

- `docs/implementation/rwo06-phase4-medicalmodv2-post-repair-live-20260423T120155Z/FINAL_REPORT.md`
- `docs/implementation/rwo06-phase4-medicalmodv2-post-repair-live-20260423T120155Z/summary.sanitized.json`
- `docs/implementation/rwo06-phase4-medicalmodv2-post-repair-live-20260423T120155Z/live-wrapper/phase4-medicalmodv2-summary.sanitized.json`

The prior no-live repair RUN_ID `20260423T110051Z` remains valid for code-level repair evidence, but it did not produce live business acceptance.

RUN_ID `20260423T122650Z` records new owner direction that future workers may repeat the `medicalmodv2` fix-and-retry cycle as many times as needed. The owner also directs the `orca` automation to proceed as autonomously as possible without waiting for additional user permission until `medicalmodv2` is accepted or a non-skippable safety stop condition is reached. This supersedes the earlier "fresh owner approval for each additional `medicalmodv2` live retry" constraint for `medicalmodv2` only. Evidence:

- `docs/implementation/rwo06-medicalmodv2-iterative-retry-approval-20260423T122650Z/OWNER_DIRECTION.md`
- `docs/implementation/rwo06-medicalmodv2-iterative-retry-approval-20260423T122650Z/summary.sanitized.json`

## Goal

Investigate the remaining `transportRejected` outcome, implement a repo-local fix if the root cause is in scope, run focused no-live verification, and then retry the approved safe `medicalmodv2` Trial wrapper when preflight and non-S3 runtime prerequisites pass. If the retry is still not accepted, record sanitized evidence and keep advancing the same fix-and-retry loop as far as possible in the current run and later automation runs.

## Allowed Actions

- Confirm branch, HEAD, status, registered worktrees, and no unrelated unsafe repo state.
- Read sanitized evidence from:
  - `docs/implementation/rwo06-phase4-medicalmodv2-post-repair-live-20260423T120155Z/`
  - `docs/implementation/rwo06-phase4-medicalmodv2-no-live-repair-20260423T110051Z/`
  - `docs/implementation/rwo06-phase4-medicalmodv2-live-20260423T091324Z/`
- Inspect source, tests, configuration contracts, and sanitized readiness/health paths.
- Run no-live unit/component/contract tests, guard scripts, wrapper dry-runs, parser/sanitizer tests, and static checks.
- Use sanitized readiness/health probes that do not print secrets or raw ORCA bodies.
- Generate missing approved local-only dev/Trial runtime values only if needed for local no-live verification and only under the automation's local-only secret policy.
- Fix repo-local, testable defects that explain the sanitized `transportRejected` path.
- After a repo-local fix and focused no-live verification, run one sanitized live `medicalmodv2` Trial attempt for that cycle through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` when payload hash, wrapper dry-run, safe-evidence checks, target, and non-S3 runtime prerequisites pass.
- Repeat future `medicalmodv2` fix-and-retry cycles without asking for fresh owner approval, as long as each cycle has a new investigation/fix/verification record and stays within this prompt's safety boundaries.
- Continue within the same run after completed fixes, classified skips, or non-accepted retries when another safe repo-local step remains.
- Update `HANDOFF_STATE.json`, the release gate matrix, and run-specific sanitized evidence docs.
- Commit roadmap/handoff-scoped tracked changes before reporting.

## Forbidden Actions

- Blind or tight-loop live `medicalmodv2` retries without a preceding investigation/fix/focused no-live verification cycle.
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

- Sanitized investigation summary with branch/HEAD, relevant sanitized prior evidence, and root-cause hypothesis.
- Focused tests/checks run and results.
- If fixed: source/doc changes, focused verification, and remaining claim boundary.
- If not fixable in this run: sanitized blocker record with precise next independent task.
- Secret/raw-artifact scan over any new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- A repo-local root cause for the remaining `transportRejected` outcome is fixed, focused no-live verification passes, and a sanitized live retry is either accepted or classified.
- The outcome is classified as environment, Trial data, Trial service, or parser ambiguity with sanitized evidence and no unsafe overclaim.
- A stop condition is reached and a more specific blocker prompt is written.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, blind live retry, or final release readiness claim

## Stop Conditions

- Root-cause classification would require raw ORCA request/response bodies, raw patient or insurance details, credentials, HAR/trace/video/screenshot/raw network artifacts, or backend logs containing unredacted secrets.
- A live retry would be required before a repo-local fix and focused no-live verification are complete.
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
- blockers and recommended next action
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
