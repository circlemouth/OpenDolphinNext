# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T08:56:30Z
updated_at: 2026-04-27T08:56:30Z
source_work_order: RWO-06H
blocker_id: rwo06h-fresh-lock-free-target-precondition-needed
priority: normal
supersedes:
- rwo06h-injection-v3-business-rejected-no-live-investigation-needed

## Context

RUN_ID `20260427T084616Z` completed RWO-06H `injectionOrder/310` v3 preflight, one live Trial decision, and no-live rejection investigation:

- Preflight evidence: `docs/implementation/rwo06h-injection-v3-live-preflight-20260427T084616Z/FINAL_REPORT.md`
- Live decision evidence: `docs/implementation/rwo06h-injection-v3-live-decision-20260427T084616Z/FINAL_REPORT.md`
- Rejection investigation: `docs/implementation/rwo06h-injection-v3-rejection-investigation-20260427T084616Z/FINAL_REPORT.md`
- Payload SHA-256: `6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`

Live result: HTTP `200`, sanitized `Api_Result=90`, `responseClassification=businessRejected`, `businessAccepted=false`. Official `medicalmodv2` documentation maps `Api_Result=90` to a target in-use / other-terminal condition and describes patient exclusive-use checks before registration completion.

## Goal

Find or prove a fresh/lock-free target precondition for a future RWO-06H retry without repeating the v3 live send, or classify RWO-06H as blocked and continue the next independent non-S3 roadmap item.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RUN_ID `20260427T084616Z` evidence.
3. Do not run another live `RWO-06H` send for the exact v3 identity.
4. Prefer `RWO-06H_FRESH_LOCK_FREE_TARGET_PREFLIGHT` in `HANDOFF_STATE.json.nextExecutableQueue`.

## Allowed Actions

- Sanitized read-only or no-live target-lock/fresh-target preflight using existing safe wrappers only.
- Official ORCA specification research if target-lock or fresh-target semantics are unclear.
- Sanitized evidence update that identifies a lock-free/fresh target, or blocks RWO-06H retry.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- Repeating the exact v3 live send unchanged.
- Any live retry without documented fresh/lock-free changed precondition, focused no-live verification, and a new duplicate/runtime preflight.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request-class identity, target-precondition decision, official/source URLs if used, no-live/read-only result, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when RWO-06H fresh/lock-free target precondition is recorded as proven/skipped/blocked with sanitized evidence, or the worker selects the next independent non-S3 roadmap item; handoff state is updated; relevant checks pass; and roadmap-scoped changes are committed.
