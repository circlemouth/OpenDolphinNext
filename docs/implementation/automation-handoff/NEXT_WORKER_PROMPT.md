# NEXT_WORKER_PROMPT

status: completed
created_at: 2026-04-23T10:02:16Z
last_checked_at: 2026-04-23T11:00:51Z
source_work_order: RWO-06
blocker_id: phase4-medicalmodv2-live-transport-rejected-investigation
priority: high
supersedes:
- RWO-06 Phase4 medicalmodv2 live Trial ready handoff from 2026-04-23T06:01:15Z

## Context

RUN_ID `20260423T091324Z` executed the single approved Phase4 `medicalmodv2` WebORCA Trial action through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`.

The action was sanitized and classified, but it was not business accepted:

- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- request class: `medicalmodv2`
- target: `00001 / 00001`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- live Trial action: `executed_once`
- verdict: `live_trial_not_accepted`
- response classification: `transportRejected`
- business accepted: `false`

RUN_ID `20260423T100216Z` investigated without sending another live mutation. Sanitized readiness showed database `UP`, ORCA `DOWN` with `orca_probe_failed`, and attachment storage `DISABLED` under the non-S3 profile. The server container was running but Docker health was unhealthy. A safety incident occurred during investigation: one command printed ORCA Trial Basic values from ignored generated runtime config to terminal output. The values were not written to tracked evidence.

## Goal

Perform no-live root-cause investigation and repair for the Phase4 `medicalmodv2` `transportRejected` result. Prevent accidental repeat live mutation until the no-live readiness/transport path is understood and fixed or reclassified.

## Allowed Actions

- Confirm branch, HEAD, status, worktrees, and no unrelated unsafe repo state.
- Read only sanitized evidence under `docs/implementation/rwo06-phase4-medicalmodv2-live-20260423T091324Z/`.
- Run static checks, unit tests, mapper tests, wrapper dry-runs, and status-only health/readiness probes that do not send a live mutation and do not print credentials.
- Investigate and, if repo-local, fix non-S3 readiness aggregation for `attachment.storage.mode=disabled`.
- Investigate and, if repo-local, fix ORCA gateway exception mapping for `OrcaChartSupportResource.medicalModV2` so transport failures produce sanitized `502` or `503`, not ambiguous `500`.
- Update HANDOFF_STATE.json, release gate matrix, and sanitized evidence after changes.

## Forbidden Actions

- Any additional live `medicalmodv2` mutation under the completed one-shot handoff.
- Production ORCA execution.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, or object-storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, or raw ORCA bodies.
- Reading or printing generated runtime files that may contain credentials except through presence-only/sanitized classification.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Completion Criteria

- No additional live Trial mutation is sent.
- Root cause is either fixed with focused no-live tests or classified with sanitized evidence and a precise next action.
- Credentials printed/captured in the new run: `false`.
- Raw artifacts captured: `false`.
- No production ORCA, S3/MinIO/object-storage, or final release readiness claim.

## Completion Result

RUN_ID `20260423T110051Z` completed this no-live handoff.

- live Trial mutation: `not_run`
- repair result: `RWO06_PHASE4_MEDICALMODV2_NO_LIVE_REPAIR_COMPLETE`
- readiness fix: `attachmentStorage=DISABLED` remains a sanitized non-claim but is no longer readiness-blocking when storage-dependent features are disabled
- fail-closed guard: patient image readiness remains `DOWN` if patient images are enabled while attachment storage is disabled
- transport mapping fix: ORCA connection policy failures and wrapped ORCA gateway failures map to sanitized gateway envelopes instead of ambiguous internal errors
- focused verification: 23 server tests passed
- evidence: `docs/implementation/rwo06-phase4-medicalmodv2-no-live-repair-20260423T110051Z/FINAL_REPORT.md`

Do not run another `medicalmodv2` live mutation without fresh explicit owner approval for a new live attempt.

## Stop Conditions

- A diagnosis would require raw ORCA request/response bodies or forbidden browser/network artifacts.
- Another live `medicalmodv2` mutation would be required before no-live fixes/tests.
- Target/scope ambiguity or parser ambiguity.
- Any command would print or capture credentials.
