# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T09:46:13Z
updated_at: 2026-04-27T09:46:13Z
source_work_order: RWO-06I
blocker_id: rwo06i-changed-row-identity-research-needed
priority: normal
supersedes:
- rwo09-static-refresh-after-rwo06i-surgery-master-proof
- rwo06i-surgery-v3-adjunct-master-proof-needed

## Context

RUN_ID `20260427T094613Z` completed two steps:

- RWO-06I evidence: `docs/implementation/rwo06i-surgery-v3-adjunct-master-proof-20260427T094613Z/FINAL_REPORT.md`
- Result: surgery v3 official-sample-style rows `150003110`, `641210099`, and `840000042` did not produce sanitized read-only row proof through `medicationgetv2` Request_Number `02`.
- Live Trial mutation: `not_run`
- RWO-09 evidence: `docs/implementation/rwo09-static-refresh-after-rwo06i-surgery-master-proof-20260427T094613Z/FINAL_REPORT.md`
- Result: current-head non-S3 static/package/security refresh passed after the wrapper and evidence changes.

The existing surgery v3 payload SHA remains `f1046a303a1d78e12c6409efc7cb68bcb96bc6737428846c24e2fa4981af9421`, but it is not live-ready. The prior bare surgery v2 identity also remains forbidden after business rejection.

## Goal

Find a safe no-live next step for RWO-06I after v3 adjunct rows failed read-only proof. Prefer official ORCA specification research and source-backed row identity drafting. Do not run live.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RWO-06I surgery master-proof evidence.
3. Prefer `RWO-06I_CHANGED_ROW_IDENTITY_RESEARCH_NO_LIVE` in `HANDOFF_STATE.json.nextExecutableQueue`.
4. Use ORCA official sources first if row class, master lookup behavior, row ordering, or surgery code semantics are unclear.

## Allowed Actions

- Official ORCA specification research for surgery/medicalmodv2 row semantics and row-proof requirements.
- Source-backed no-live row identity research or drafting for a changed `surgeryOrder/500` payload.
- Parser/sanitizer tests or wrapper dry-runs that do not execute live mutation.
- Sanitized evidence update with claim boundaries.

## Forbidden Actions

- Any RWO-06I live send.
- Repeating the rejected surgery v2 live send unchanged.
- Treating official samples, dry-runs, read-only `official_error_no_row_proof`, or HTTP 2xx as Trial business acceptance.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record source URLs, checked date, endpoint/request-class identity, candidate row identity or stop decision, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when a new source-backed no-live surgery identity is drafted for future row proof, or a sanitized stop/skip decision is recorded because no safe identity can be established without live mutation, raw artifacts, credentials, production ORCA, S3/object storage, or human billing context.
