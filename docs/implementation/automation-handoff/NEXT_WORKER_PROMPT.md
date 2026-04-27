# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T17:07:08Z
updated_at: 2026-04-27T20:01:29Z
source_work_order: ACCEPTMODV2
blocker_id: acceptmodv2-rn020304-target-inventory-readonly-trial-runtime-docker-unavailable
priority: medium
supersedes:
- acceptmodv2-rn020304-target-inventory-runtime-readonly-route

## Context

RUN_ID `20260427T170708Z` completed the previous route/action blocker:

- Evidence: `docs/implementation/acceptmodv2-target-inventory-readonly-route-20260427T170708Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-target-inventory-readonly-route-20260427T170708Z/FINAL_REPORT.md`
- Public route: `/api/orca/official/visits/acceptance-list`
- ORCA endpoint: `/api01rv2/acceptlstv2`
- Request classes: `01`, `02`, `03`
- Serializer: `acceptlstreq_xml2_server_sanitized_readonly`
- Parser/sanitizer: allowlisted presence flags and row hashes only

The route is server-authenticated and facility-scoped. The request DTO accepts only `acceptanceDate`, `classCode`, and optional `departmentCode`. It does not accept client-provided `Acceptance_Id`, `Patient_ID`, facility, owner, role, object key, URI, or digest as target authority.

RWO-11/RWO-09 rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture remain external release-management gates and are not performed by this automation.

RUN_ID `20260427T180231Z` added the runtime-safe read-only wrapper mode and focused tests:

- Evidence: `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T180231Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T180231Z/FINAL_REPORT.md`
- Wrapper mode: `--execute-readonly`
- Focused test: `npm run test:ci -- scripts/__tests__/phase4Acceptmodv2TargetInventoryEvidence.test.ts`
- Runtime result: skipped as `skipped_environment_unavailable` because Docker daemon was unavailable.

RUN_ID `20260427T190231Z` rechecked the approved non-S3 runtime path:

- Evidence: `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T190231Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T190231Z/FINAL_REPORT.md`
- Runtime result: skipped as `skipped_environment_unavailable` because Docker daemon was still unavailable.

RUN_ID `20260427T200129Z` rechecked the same approved non-S3 runtime path:

- Evidence: `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T200129Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T200129Z/FINAL_REPORT.md`
- Runtime result: skipped as `skipped_environment_unavailable` because Docker daemon was still unavailable.
- No read-only ORCA Trial inventory, live mutation, production ORCA, S3/object storage, raw artifact capture, or credential capture was performed.

## Goal

Run sanitized read-only WebORCA Trial target inventory through `/api/orca/official/visits/acceptance-list` once the approved non-S3 runtime is available, so future RN02/RN03/RN04 work can prove whether server-derived `Acceptance_Id`, patient/date/time, department, physician, and insurance-combination preconditions exist without raw patient/insurance detail and without live mutation.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/acceptmodv2-target-inventory-readonly-trial-20260427T180231Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-target-inventory-readonly-route-20260427T170708Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-target-inventory-wrapper-20260427T160229Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-rn020304-stop-gate-20260427T150350Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary as external release-management gates.
4. Verify runtime readiness only through the approved non-S3 WebORCA Trial path.

## Allowed Actions

- Start or use the approved repo-local non-S3 WebORCA Trial runtime when Docker and credentials/config are already available through approved local runtime files.
- Run sanitized read-only `acceptlstv2` inventory through the wrapper:
  `RUN_ID=<run_id> node web-client/scripts/qa-phase4-acceptmodv2-target-inventory.mjs --execute-readonly --sanitized-evidence-only --disable-browser-artifacts --class 01 --acceptance-date <YYYY-MM-DD>`
- Record only endpoint identity, class/date scope, transport status class, API result class, row counts, target-ready counts, row hashes, and presence flags.
- If runtime/config is unavailable, write a sanitized skip record and continue to the next safe non-S3, non-production, non-RWO-11/RWO-09 work item.
- Handoff state and roadmap evidence updates.

## Forbidden Actions

- Any RN02/RN03/RN04 live mutation.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request class, route/method/serializer/parser/sanitizer contract, runtime readiness result, read-only inventory result or skip reason.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when one of the following exists:

- a sanitized read-only Trial inventory summary proving at least one target-ready row or explicitly proving no target-ready row; or
- a fresh sanitized blocker/skip record explaining why runtime-safe read-only inventory cannot proceed in the current environment and pointing to the next safe queue item.

## Same-Run Continuation Requirement

Completing or skipping this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized skip/blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.
