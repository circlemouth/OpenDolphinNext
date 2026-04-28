# NEXT_WORKER_PROMPT

status: completed
created_at: 2026-04-28T01:01:35Z
updated_at: 2026-04-28T02:12:00Z
source_work_order: ACCEPTMODV2
blocker_id: acceptmodv2-rn02-single-live-attempt-pending-runtime-preflight
priority: high
supersedes:
- acceptmodv2-rn02-safe-live-wrapper-action-missing

## Context

RUN_ID `20260428T010135Z` implemented the RN02 server-derived action needed by the prior handoff:

- Evidence: `docs/implementation/acceptmodv2-rn02-server-derived-action-20260428T010135Z/summary.sanitized.json`
- Report: `docs/implementation/acceptmodv2-rn02-server-derived-action-20260428T010135Z/FINAL_REPORT.md`
- Route: `/api/orca/official/visits/acceptance-operation`
- Request class: `acceptmodv2_request_02_server_derived_action`
- Request number: `02`
- Target identity mode: sanitized `acceptlstv2` target row hash
- Duplicate checkpoint: `acceptmodv2:rn02:trial:acceptlstv2-target-row:e93b97c2c70016eddffac3e68976c5b0322da86d1ee870bb730c613e5fde73be:date-2026-04-28:request-02`

The action intentionally does not accept client-provided ORCA identifiers. It re-reads `acceptlstv2`, resolves the row by hash, rejects target drift before mutation, and builds `mutateVisit` from server-derived internal fields that are excluded from public JSON serialization.

RWO-11/RWO-09 rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture remain external release-management gates and are not performed by this automation.

## Goal

Prepare and, only if every immediate gate passes, perform one main-worker-controlled RN02 WebORCA / ORCA Trial live attempt through the server-derived action.

Do not run RN03/RN04. Do not run any production ORCA, S3/MinIO/object-storage setup, raw artifact capture, screenshots, HAR, traces, videos, request XML, raw ORCA bodies, raw patient detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF capture.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/acceptmodv2-rn02-server-derived-action-20260428T010135Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-rn020304-duplicate-preflight-20260428T000407Z/summary.sanitized.json`
   - `docs/implementation/acceptmodv2-target-inventory-parser-fix-20260427T231541Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary as external release-management gates.
4. Before live, record sanitized preflight evidence for:
   - current runtime readiness;
   - immediate target-drift check against `/api/orca/official/visits/acceptance-list`;
   - duplicate checkpoint status;
   - exact endpoint/request class/target row hash;
   - parser/sanitizer and no-raw-artifact policy;
   - completion criteria and stop conditions.

## Allowed Actions

- Run read-only target inventory probes against WebORCA / ORCA Trial.
- Run dry-runs, unit tests, web guard, JSON parse checks, and `git diff --check`.
- If all gates pass and approved local runtime config is available, run exactly one RN02 live Trial attempt through `/api/orca/official/visits/acceptance-operation`.
- After a live attempt, rerun sanitized read-only inventory to classify whether the selected active row is absent.
- Record only sanitized Markdown/JSON evidence.

## Forbidden Actions

- Any RN03/RN04 live work.
- Blind repeat of the same live request after a failure.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request class, target identity mode, duplicate checkpoint key, target-drift gate, runtime readiness, parser/sanitizer contract, completion evidence criteria, stop conditions, and non-claims.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- If live executes, `liveTrialOrca.executed=true` with attempt number, sanitized classification, and business-success criteria. HTTP 2xx, Api_Result zero, and wrapper exit 0 alone are not success.

## Completion Criteria

This prompt is complete when one of the following exists:

- one RN02 live Trial attempt is executed through the server-derived action and classified with sanitized business evidence; or
- a fresh sanitized blocker explains why the live attempt cannot proceed safely, then identifies the next independent safe task.

## Same-Run Continuation Requirement

Completing or skipping this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.


## Completion Update - 20260428T020135Z

RN02 WebORCA / ORCA Trial live verification completed through the server-derived action. Attempt 1 returned sanitized transport 404 because the runtime image did not yet expose the route; after rebuilding/restarting server-modernized-dev from current HEAD, attempt 2 reached `live_trial_business_accepted_selected_active_row_absent`. Evidence: `docs/implementation/acceptmodv2-rn02-live-attempt-20260428T020135Z/summary.sanitized.json`. No RN03/RN04, production ORCA, S3/object-storage, raw artifacts, credentials, screenshots, HAR, traces, videos, raw ORCA bodies, patient details, or insurance details were captured or committed.
