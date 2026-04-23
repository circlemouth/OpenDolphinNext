# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-23T11:55:35Z
source_work_order: RWO-06
blocker_id: phase4-medicalmodv2-post-repair-live-owner-approved
priority: high
supersedes:
- completed no-live investigation prompt from 2026-04-23T10:02:16Z

## Context

RUN_ID `20260423T091324Z` executed the prior one-shot Phase4 `medicalmodv2` WebORCA Trial action through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`. It was sanitized but not accepted:

- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target: `00001 / 00001`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- verdict: `live_trial_not_accepted`
- response classification: `transportRejected`
- business accepted: `false`

RUN_ID `20260423T110051Z` completed the required no-live repair:

- disabled attachment storage is no longer overall-readiness-blocking in the non-S3 profile when storage-dependent features are disabled
- patient image readiness still fails closed when enabled without attachment storage
- ORCA connection policy and gateway failures map to sanitized gateway envelopes
- gateway 5xx logging avoids raw exception stack material
- 23 focused server tests passed

RUN_ID `20260423T115535Z` records fresh explicit owner approval for exactly one additional post-repair WebORCA Trial `medicalmodv2` live attempt. Approval evidence:

- `docs/implementation/rwo06-phase4-medicalmodv2-live-approval-20260423T115535Z/OWNER_APPROVAL.md`
- `docs/implementation/rwo06-phase4-medicalmodv2-live-approval-20260423T115535Z/summary.sanitized.json`

## Goal

Execute or classify the approved post-repair Phase4 `medicalmodv2` WebORCA Trial action exactly once, using only the safe wrapper and sanitized evidence path. If the local environment cannot safely execute it, record a sanitized skip and continue to independent safe roadmap work according to the automation policy.

## Approved Live Action

The next worker may send exactly one post-repair live Trial request only with all of the following:

- wrapper: `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`
- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target: `00001 / 00001`
- payload: `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_current_wrapper_v1.json`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- runtime profile: `orca-trial-no-object-storage`
- required command flags: `--execute-approved-phase4 --sanitized-evidence-only --disable-browser-artifacts --phase4-only`

## Allowed Actions

- Confirm branch, HEAD, status, registered worktrees, and no unrelated unsafe repo state.
- Read sanitized evidence from:
  - `docs/implementation/rwo06-phase4-medicalmodv2-no-live-repair-20260423T110051Z/`
  - `docs/implementation/rwo06-phase4-medicalmodv2-live-approval-20260423T115535Z/`
  - `docs/implementation/rwo06-phase4-medicalmodv2-live-20260423T091324Z/`
- Verify payload SHA-256 without printing payload body.
- Run wrapper dry-run and safe-evidence contract checks before any live attempt.
- Use existing repo scripts, documented wrappers, or narrowly reviewed repo-local commands only.
- Generate missing approved local-only dev/Trial runtime values only if allowed by the automation prompt and store them only in an approved gitignored local runtime file without printing values.
- Run the approved wrapper live action once if all safe prerequisites are available.
- Record sanitized live result or sanitized skip evidence.
- Update `HANDOFF_STATE.json`, this prompt, the release gate matrix, and any run-specific sanitized evidence docs.
- Commit roadmap/handoff-scoped tracked changes before reporting.

## Forbidden Actions

- More than one post-repair `medicalmodv2` live Trial action under this approval.
- Any live action if wrapper dry-run, payload hash, command contract, target, or evidence-sanitization checks fail.
- Production ORCA execution or production ORCA readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Fullflow execution.
- Phase3 / `acceptmodv2` rerun.
- Request_Number `02` / `03` / `04`.
- `diseasev3` or `subjectivesv2` live execution.
- Patients/candidates other than `00001 / 00001`.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- Reading or printing generated runtime files that may contain credentials except through presence-only/sanitized classification.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized preflight summary: branch/HEAD, payload hash, wrapper dry-run, and safe-evidence checks.
- Sanitized live wrapper summary if executed.
- Sanitized skip record if execution is blocked by environment, missing allowed runtime inputs, S3/object-storage requirement, target drift, parser ambiguity, or raw-artifact risk.
- Secret/raw-artifact scan over any new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- The approved post-repair live action is executed exactly once and classified from sanitized endpoint-specific business evidence.
- The action is skipped with a sanitized, machine-readable reason and a precise next independent task.
- A stop condition is reached and a new blocker prompt is written.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, repeated mutation, or final release readiness claim

## Stop Conditions

- Target is not WebORCA / ORCA Trial, or target cannot be verified without printing secrets.
- Payload SHA-256, wrapper command contract, endpoint, target, or request class drifts from this prompt.
- Success cannot be classified without raw ORCA bodies or forbidden browser/network artifacts.
- Parser ambiguity or sanitizer/redaction uncertainty.
- A second live `medicalmodv2` action would be required.
- Production ORCA or S3/object-storage configuration would be required instead of being skippable.
- Unsafe repo state or unrelated worktree changes make a safe commit impossible.

## Final Report Requirements

Use `【ワーカー報告】` and include:

- branch and HEAD
- active handoff prompt and approval evidence path
- current Work Order and next Work Order
- whether the live action was executed, skipped, or blocked
- endpoint/target/request class if executed
- sanitized result and business-success classification
- files changed and commit id
- tests/checks run
- blockers and recommended next action
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
