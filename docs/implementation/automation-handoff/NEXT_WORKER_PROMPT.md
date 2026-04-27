# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T06:46:12Z
updated_at: 2026-04-27T06:46:12Z
source_work_order: RWO-06F
blocker_id: rwo06f-instruction-charge-preconditions-no-live-needed
priority: normal
supersedes:
- rwo06h-injectable-row-proof-needs-changed-candidate
- rwo09-current-head-refresh-after-rwo06h-rerun

## Context

RUN_ID `20260427T064612Z` completed the `RWO-06H` repaired-wrapper candidate rerun and follow-up `RWO-09` current-head non-S3 static refresh:

- RWO-06H evidence: `docs/implementation/rwo06h-repaired-candidate-rerun-20260427T064612Z/FINAL_REPORT.md`
- RWO-06H summary: `docs/implementation/rwo06h-repaired-candidate-rerun-20260427T064612Z/summary.sanitized.json`
- RWO-09 evidence: `docs/implementation/rwo09-current-head-static-refresh-20260427T064612Z/FINAL_REPORT.md`
- RWO-09 summary: `docs/implementation/rwo09-current-head-static-refresh-20260427T064612Z/summary.sanitized.json`

RWO-06H result: repaired-wrapper read-only `medicationgetv2 Request_Number=02` checks for `620076111`, `620007539`, `620006203`, `620004173`, `620002589`, `621958501`, `620006734`, `620767312`, `620738012`, and `621429304` all returned sanitized `2xx/official_error/official_error_no_row_proof/masterFound=false`. `620000012` was not reused as injectable success evidence. Injection live remains stopped.

RWO-09 result: JSON validity, doc links, web guard, reviewer submission packet contract tests, review package contract tests, and `git diff --check` passed after the RWO-06H evidence update.

No live Trial mutation, diagnostic artifact capture, production ORCA, S3/object-storage setup, rollback rehearsal execution, owner final GO/NO-GO, or final release readiness is claimed.

## Goal

Continue independent no-live roadmap work. The next useful path is `RWO-06F` / `instractionChargeOrder` class `130`: prove or safely block the disease/facility/monthly/department/insurance preconditions without raw patient or insurance detail, before any future live Trial attempt.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the latest RWO-06H/RWO-09 evidence.
3. Read the RWO-06F entries in `WORKPLAN_TO_RELEASE.md`, `REMAINING_WORK_BREAKDOWN.md`, `RELEASE_GATE_MATRIX.md`, and `order-family-v2-candidate-research-20260425T215740Z.md`.
4. If instruction-charge endpoint semantics or preconditions are unclear, perform ORCA official-source research first and record sanitized no-live evidence.

## Allowed Actions

- ORCA official-source research for `instractionChargeOrder` / class `130` preconditions.
- No-live payload/precondition planning, parser/sanitizer tests, wrapper dry-runs, duplicate-checkpoint dry-runs, and sanitized evidence updates.
- Read-only Trial probes only if a safe wrapper exists and evidence remains sanitized-only.
- Current-head static/package/security checks only if source/docs changed and focused verification is needed.

## Forbidden Actions

- Live Trial mutation without a complete endpoint packet and current sanitized preflight.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient/insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.
- Re-running `injectionOrder/310` live without new row-level medication proof.
- Re-running `RWO-11/RWO-09` rollback execution while target/restore identity remains ambiguous.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record source URLs checked, checked date, precondition classification, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when RWO-06F no-live precondition evidence is recorded or safely skipped/blocked with sanitized evidence, handoff state is updated, relevant checks pass, and roadmap-scoped changes are committed.
