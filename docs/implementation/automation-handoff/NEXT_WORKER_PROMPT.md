# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T00:04:07Z
updated_at: 2026-04-28T00:04:07Z
source_work_order: ACCEPTMODV2
blocker_id: acceptmodv2-rn02-safe-live-wrapper-action-missing
priority: high
supersedes:
- acceptmodv2-rn020304-target-inventory-readonly-trial-no-target-ready
- acceptmodv2-rn020304-duplicate-checkpoint-preflight

## Context

RUN_ID `20260427T231541Z` repaired the `acceptlstv2` parser/sanitizer so the read-only target inventory now derives target-ready presence flags from the official response shape:

- Evidence: `docs/implementation/acceptmodv2-target-inventory-parser-fix-20260427T231541Z/summary.sanitized.json`
- Route: `/api/orca/official/visits/acceptance-list`
- ORCA endpoint: `/api01rv2/acceptlstv2`
- Date: `2026-04-28`
- Class `01`: one target-ready sanitized row.
- Class `03`: one target-ready sanitized row with the same row hash.
- Selected row hash: `e93b97c2c70016eddffac3e68976c5b0322da86d1ee870bb730c613e5fde73be`

RUN_ID `20260428T000407Z` assembled the no-live duplicate checkpoint and endpoint-specific preflight:

- Evidence: `docs/implementation/acceptmodv2-rn020304-duplicate-preflight-20260428T000407Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-rn020304-duplicate-preflight-20260428T000407Z/FINAL_REPORT.md`
- RN02 dry-run: `preconditions_satisfied_no_live`, but live execution still requires a reviewed safe live wrapper/action and immediate runtime/target-drift preflight.
- RN03: stopped before live because server-authoritative update fields are missing.
- RN04: stopped before live because explicit `Claim_Send_Info` policy and rollback duplicate policy are missing.

RWO-11/RWO-09 rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture remain external release-management gates and are not performed by this automation.

## Goal

Implement or select a reviewed safe RN02 live wrapper/action for `acceptmodv2 Request_Number=02` without executing live ORCA Trial mutation in this step.

The wrapper/action must make a future single RN02 Trial attempt possible only after all immediate preflight gates pass. If implementation is unsafe or ambiguous, record a sanitized blocker and continue to the next independent non-live task.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/acceptmodv2-target-inventory-parser-fix-20260427T231541Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-rn020304-duplicate-preflight-20260428T000407Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-rn020304-stop-gate-20260427T150350Z/summary.sanitized.json`
   - `docs/implementation/rwo07-acceptmodv2-rn02-wrapper-contract-20260427T040311Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary as external release-management gates.
4. Do not execute RN02 live until the new wrapper/action has focused no-live tests, command gating, target-drift preflight, runtime readiness preflight, duplicate checkpoint enforcement, parser/sanitizer enforcement, and sanitized evidence policy.

## Allowed Actions

- Modify `web-client/` and/or `server-modernized/` only as needed for a safe RN02 wrapper/action.
- Add focused tests for command gating, target drift, duplicate checkpoint enforcement, parser/sanitizer contract, and failure to accept client-provided identifiers.
- Add sanitized evidence docs for no-live wrapper readiness.
- Use official ORCA documentation if endpoint semantics or RN02 completion evidence are unclear.
- Run dry-runs, unit tests, web guard, JSON parse checks, and `git diff --check`.

## Forbidden Actions

- Any live RN02/RN03/RN04 mutation in this wrapper-implementation step.
- RN03/RN04 live work.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request class, target identity mode, duplicate checkpoint key format, target-drift gate, command/live flag gate, runtime readiness requirement, parser/sanitizer contract, completion evidence criteria, stop conditions, and non-claims.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when one of the following exists:

- a reviewed no-live RN02 safe wrapper/action with focused tests and sanitized readiness evidence; or
- a fresh sanitized blocker explaining why RN02 live wrapper/action implementation cannot proceed safely and identifying the next independent safe task.

## Same-Run Continuation Requirement

Completing or skipping this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.
