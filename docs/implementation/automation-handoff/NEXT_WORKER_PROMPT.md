# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T09:16:16Z
updated_at: 2026-04-27T09:26:16Z
source_work_order: RWO-06I
blocker_id: rwo06i-surgery-v3-adjunct-master-proof-needed
priority: normal
supersedes:
- rwo06i-surgery-v2-business-rejected-no-live-investigation-needed

## Context

RUN_ID `20260427T091616Z` completed two no-live steps:

- RWO-06H evidence: `docs/implementation/rwo06h-fresh-lock-free-target-preflight-20260427T091616Z/FINAL_REPORT.md`
- Result: no safe read-only target-lock/fresh-target proof exists in the current repo.
- Live Trial mutation in that step: `not_run`
- RWO-06I evidence: `docs/implementation/rwo06i-surgery-v3-no-live-20260427T091616Z/FINAL_REPORT.md`
- Result: changed official-sample-style surgery v3 payload prepared and safe wrapper dry-run passed.
- Surgery v3 payload SHA-256: `f1046a303a1d78e12c6409efc7cb68bcb96bc6737428846c24e2fa4981af9421`

Prior RWO-06I `surgeryOrder/500` v2 live evidence exists at `docs/implementation/rwo06i-surgery-v2-live-20260425T020245Z/FINAL_REPORT.md`. It reached WebORCA / ORCA Trial once and was sanitized `businessRejected` with `Api_Result=80`; the unchanged v2 identity must not be repeated.

## Goal

Prove or block the RWO-06I surgery v3 adjunct rows before any future live attempt. Record sanitized row-level proof or an explicit stop condition for `150003110`, `641210099`, and `840000042`; do not run live.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RWO-06I v3 no-live evidence.
3. Do not run any live `RWO-06I` send.
4. Prefer `RWO-06I_SURGERY_V3_ADJUNCT_MASTER_PROOF_PREFLIGHT` in `HANDOFF_STATE.json.nextExecutableQueue`.

## Allowed Actions

- Sanitized read-only or no-live master proof for surgery v3 rows using existing safe wrappers only.
- Official ORCA specification research if row class, master lookup, or adjunct-row semantics are unclear.
- Sanitized evidence update that proves all required rows or blocks RWO-06I v3 before live.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- Any RWO-06I live send.
- Repeating the exact surgery v2 live send unchanged.
- Treating the v3 dry-run as Trial business acceptance or retry readiness.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request-class identity, row-proof or stop decision, official/source URLs if used, no-live/read-only result, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when RWO-06I surgery v3 adjunct rows are proven or blocked with sanitized evidence, handoff state is updated, relevant checks pass, and roadmap-scoped changes are committed.
