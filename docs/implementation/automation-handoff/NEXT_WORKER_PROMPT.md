# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T16:02:29Z
updated_at: 2026-04-27T16:02:29Z
source_work_order: ACCEPTMODV2
blocker_id: acceptmodv2-rn020304-target-inventory-runtime-readonly-route
priority: medium
supersedes:
- soap-subjectivesv2-route-contract

## Context

RUN_ID `20260427T160229Z` completed a no-live `ACCEPTMODV2_RN02_03_04_TARGET_INVENTORY` wrapper/sanitizer contract:

- Evidence: `docs/implementation/acceptmodv2-target-inventory-wrapper-20260427T160229Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-target-inventory-wrapper-20260427T160229Z/FINAL_REPORT.md`
- Contract: `phase4-acceptmodv2-target-inventory-sanitized-no-live`
- Script: `web-client/scripts/qa-phase4-acceptmodv2-target-inventory.mjs`
- Library: `web-client/scripts/qa-lib/phase4-acceptmodv2-target-inventory-evidence.mjs`
- Test: `web-client/scripts/__tests__/phase4Acceptmodv2TargetInventoryEvidence.test.ts`

The wrapper intentionally does not execute read-only Trial traffic yet. It locks endpoint/method/serializer/parser/sanitizer behavior for future `acceptlstv2` inventory evidence, rejects live/read-only/raw-artifact flags, and records only presence flags and hashes.

Official ORCA source evidence checked by RUN_ID `20260427T160229Z`:

- `https://www.orca.med.or.jp/receipt/users/tec/api/acceptancelst.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html`

RWO-11/RWO-09 rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture are external release-management gates and are not performed by this automation.

## Goal

Implement or expose a reviewed runtime-safe read-only `acceptlstv2` target inventory route/action so a future automation run can prove server-derived `Acceptance_Id`, patient/date/time, department, physician, and insurance-combination preconditions without raw patient/insurance detail and without live mutation.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/acceptmodv2-target-inventory-wrapper-20260427T160229Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-rn020304-stop-gate-20260427T150350Z/summary.sanitized.json`
   - `docs/implementation/rwo07-acceptmodv2-rn020304-no-live-packet-20260427T030312Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary as external release-management gates.
4. Prefer this task unless a higher-priority non-human, non-RWO-11/RWO-09 safe item is newly inserted.

## Allowed Actions

- Repo-local implementation of a server-authenticated, facility-scoped, read-only `acceptlstv2` route/action.
- DTO/parser/sanitizer updates that expose only allowlisted fields needed for target inventory.
- No-live wrapper/parser/sanitizer tests and dry-runs.
- Sanitized read-only Trial verification only if the route/action is complete, runtime is available through the approved non-S3 WebORCA Trial path, and evidence excludes raw ORCA bodies, credentials, patient names, insurance numbers, cookies, sessions, and credential-bearing URLs.
- Handoff state and roadmap evidence updates.

## Forbidden Actions

- Any RN02/RN03/RN04 live mutation.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request class, route/method/serializer/parser/sanitizer contract, no-live test result, and read-only runtime result if executed.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when one of the following exists:

- a reviewed runtime-safe read-only `acceptlstv2` target inventory route/action with focused tests and sanitized no-live evidence; or
- a sanitized read-only Trial inventory summary proving or blocking server-derived target preconditions; or
- a sanitized blocker explaining why runtime-safe read-only inventory cannot proceed and pointing to the next safe queue item.

## Same-Run Continuation Requirement

Completing or skipping this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized skip/blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.
