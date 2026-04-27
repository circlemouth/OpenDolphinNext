# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T07:16:11Z
updated_at: 2026-04-27T07:16:11Z
source_work_order: RWO-06F
blocker_id: rwo06f-readonly-precondition-probes-needed
priority: normal
supersedes:
- rwo06f-instruction-charge-preconditions-no-live-needed

## Context

RUN_ID `20260427T071611Z` completed the RWO-06F no-live precondition packet and follow-up current-head static refresh:

- RWO-06F evidence: `docs/implementation/rwo06f-instruction-charge-preconditions-20260427T071611Z/FINAL_REPORT.md`
- RWO-06F summary: `docs/implementation/rwo06f-instruction-charge-preconditions-20260427T071611Z/summary.sanitized.json`
- RWO-09 evidence: `docs/implementation/rwo09-current-head-static-refresh-20260427T071611Z/FINAL_REPORT.md`
- RWO-09 summary: `docs/implementation/rwo09-current-head-static-refresh-20260427T071611Z/summary.sanitized.json`

Result: `instractionChargeOrder` / class `130` candidate `113001810` remains no-live prepared and wrapper dry-run passes, but live Trial mutation is blocked until disease, facility, monthly duplicate, department, and insurance context are proven with sanitized server-derived evidence.

No live Trial mutation, diagnostic artifact capture, production ORCA, S3/object-storage setup, rollback rehearsal execution, owner final GO/NO-GO, or final release readiness is claimed.

## Goal

Continue RWO-06F without live mutation by creating or running sanitized read-only precondition wrappers/probes that can prove or safely block:

- disease context for the management/guidance fee
- facility/system classification compatibility
- monthly duplicate status
- server-derived department and insurance readiness

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RUN_ID `20260427T071611Z` RWO-06F/RWO-09 evidence.
3. Prefer `HANDOFF_STATE.json.nextExecutableQueue[0]` task `RWO-06F_READONLY_PRECONDITION_PROBES` if it remains safe.
4. If endpoint semantics are unclear, use ORCA official-source research before selecting any read-only probe.

## Allowed Actions

- Implement or run no-live/read-only sanitized wrappers for `diseasegetv2` or `diseasev3` summaries, `medicalgetv2` monthly checks, and `system01dailyv2` / `system01lstv2` facility summaries.
- Wrapper dry-runs, parser/sanitizer tests, and sanitized evidence updates.
- Read-only Trial probes only when a safe wrapper exists and emits no raw patient, disease, insurance, ORCA body, credential, cookie, session, Authorization, CSRF, HAR, trace, screenshot, video, or raw network artifact.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- `instractionChargeOrder/130` live Trial mutation before all preconditions and current endpoint packet fields are complete.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw disease names/details, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.
- Request_Number `02` / `03` / `04` through the current `medicalmodv2` create wrapper.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request-class identity, source URLs checked when relevant, precondition classification, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when RWO-06F read-only precondition evidence is recorded, or safely skipped/blocked with sanitized evidence, handoff state is updated, relevant checks pass, and roadmap-scoped changes are committed.
