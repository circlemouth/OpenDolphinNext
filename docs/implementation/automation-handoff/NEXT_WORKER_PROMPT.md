# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T13:50:43Z
updated_at: 2026-04-27T13:50:43Z
source_work_order: RWO-06G
blocker_id: rwo06g-base-charge-rn00-first-visit-gate
priority: high
supersedes:
- rwo09-static-refresh-after-rwo08b-local-diagnostic

## Context

RUN_ID `20260427T135043Z` completed two no-live tasks:

- `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC`
  - Evidence: `docs/implementation/rwo08b-local-exact-match-diagnostic-20260427T135043Z/summary.sanitized.json`
  - Result: `RWO08B_LOCAL_SYNC_PRECONDITION_BLOCKER`
- `RWO-09_STATIC_PACKAGE_REFRESH_CURRENT_HEAD_AFTER_RWO08B_LOCAL_DIAGNOSTIC`
  - Evidence: `docs/implementation/rwo09-static-refresh-after-rwo08b-local-diagnostic-20260427T135043Z/summary.sanitized.json`
  - Result: `CURRENT_HEAD_NON_S3_STATIC_PACKAGE_SECURITY_REFRESH_PASS`

RWO-08B remains blocked for fullflow: non-excluded candidates `00002` through `00011` classify as `local_absent`, and no fresh exact local target was found. This does not authorize Phase 3, Phase 4, fullflow, local import/sync, or live mutation.

## Goal

Execute `RWO-06G_BASE_CHARGE_RN00_FIRST_VISIT_GATE` if runtime/read-only prerequisites are available. Use acceptmodv2 Request_Number `00` read-only evidence to prove or block first-visit compatibility for `baseChargeOrder/110`.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/rwo09-static-refresh-after-rwo08b-local-diagnostic-20260427T135043Z/summary.sanitized.json`
   - `docs/implementation/chatgpt-research-intake-validation-20260427T125006Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary: rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture are external release-management gates and are not performed by this automation.
4. Prefer `RWO-06G_BASE_CHARGE_RN00_FIRST_VISIT_GATE` in `HANDOFF_STATE.json.nextExecutableQueue`.

## Allowed Actions

- Sanitized read-only runtime checks if the existing approved runtime path is available.
- Repo-local parser/sanitizer/contract checks needed to interpret Request_Number `00` without raw artifacts.
- Sanitized skip record if runtime, target, parser, or credential-safe prerequisites are unavailable.
- No-live evidence update and handoff state update.

## Forbidden Actions

- Any live mutation, including acceptmodv2 Request_Number `02` / `03` / `04`.
- Phase 3, Phase 4, fullflow, local patient import/sync, production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw local patient payloads, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, request XML, raw network dumps, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request class, Request_Number `00`, target identity class, read-only status classification, and whether first-visit compatibility is proven, blocked, or inconclusive.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when sanitized RN00 first-visit compatibility gate evidence exists, or when a sanitized skip/blocker record explains why RWO-06G cannot proceed and points to the next safe no-live/read-only queue item.

## Same-Run Continuation Requirement

Completing or skipping this prompt is not, by itself, a valid reason to end the automation run. After recording the RWO-06G evidence or sanitized skip/blocker, the worker must continue within the same run to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless one of the global stop conditions is explicitly met and recorded.

If RWO-06G is blocked only by environment/runtime/target prerequisites, record a sanitized skip or blocker with `credentialsCaptured=false`, `rawArtifactsCommittedOrPackaged=false`, and `liveTrialOrca.executed=false`, then immediately select the next independent no-live/read-only task. Do not hand off to "next worker" merely because this prompt's local completion criteria were satisfied.
