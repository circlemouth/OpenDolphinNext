# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T07:46:16Z
updated_at: 2026-04-27T07:46:16Z
source_work_order: RWO-06H
blocker_id: rwo06h-injectable-candidate-discovery-no-live-needed
priority: normal
supersedes:
- rwo09-current-head-static-refresh-needed-after-rwo06f-readonly-probes

## Context

RUN_ID `20260427T074616Z` completed:

- RWO-06F read-only precondition probes: `docs/implementation/rwo06f-readonly-precondition-probes-20260427T074616Z/FINAL_REPORT.md`
- RWO-06F summary: `docs/implementation/rwo06f-readonly-precondition-probes-20260427T074616Z/summary.sanitized.json`
- RWO-09 current-head static refresh: `docs/implementation/rwo09-current-head-static-refresh-20260427T074616Z/FINAL_REPORT.md`
- RWO-09 summary: `docs/implementation/rwo09-current-head-static-refresh-20260427T074616Z/summary.sanitized.json`

Result: the new RWO-06F read-only wrapper executed once against WebORCA / ORCA Trial. Facility/system summary was observed, but disease, monthly duplicate, and department/insurance preconditions remain not proven. `instractionChargeOrder/130` live mutation remains blocked.

No live Trial mutation, diagnostic artifact capture, production ORCA, S3/object-storage setup, rollback rehearsal execution, owner final GO/NO-GO, or final release readiness is claimed.

## Goal

Continue the next safe independent queue item: RWO-06H no-live injectable candidate discovery or row-proof work, using only source-backed candidates and repaired sanitized `medicationgetv2` Request_Number `02` checks.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RUN_ID `20260427T074616Z` RWO-06F/RWO-09 evidence.
3. Prefer the first safe RWO-06H item in `HANDOFF_STATE.json.nextExecutableQueue`.
4. Do not rely on prior `medicationgetv2` evidence generated before the 2026-04-27 repaired wrapper unless it is explicitly marked repaired/current.

## Allowed Actions

- Official/source-backed injectable medication candidate research.
- No-live candidate list preparation.
- Sanitized `medicationgetv2` Request_Number `02` read-only checks through the repaired wrapper.
- Wrapper dry-runs, parser/sanitizer tests, and sanitized evidence updates.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- `injectionOrder/310` live Trial mutation before row-level medication proof and endpoint packet completion.
- `instractionChargeOrder/130` live Trial mutation.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw disease names/details, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request-class identity, source URLs checked when relevant, candidate classifications, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when the selected RWO-06H no-live/read-only task is recorded as completed/skipped/blocked with sanitized evidence, handoff state is updated, relevant checks pass, and roadmap-scoped changes are committed.
