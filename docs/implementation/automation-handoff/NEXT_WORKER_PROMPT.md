# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T08:16:23Z
updated_at: 2026-04-27T08:16:23Z
source_work_order: RWO-06H
blocker_id: rwo06h-duplicate-checkpoint-runtime-preflight-needed
priority: normal
supersedes:
- rwo06h-injectable-candidate-discovery-no-live-needed

## Context

RUN_ID `20260427T081623Z` completed the RWO-06H no-live injectable candidate discovery / row-proof step:

- RWO-06H evidence: `docs/implementation/rwo06h-additional-injectable-candidates-20260427T081623Z/FINAL_REPORT.md`
- RWO-06H summary: `docs/implementation/rwo06h-additional-injectable-candidates-20260427T081623Z/summary.sanitized.json`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v3.json`
- Payload SHA-256: `6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`
- Duplicate-live checkpoint: `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`

Result: source-backed candidate `621894701` produced sanitized `medicationgetv2` Request_Number `02` row-level proof. The v3 `medicalmodv2` wrapper dry-run passed. No live Trial mutation was executed and no Trial business acceptance is claimed.

## Goal

Continue the next safe RWO-06H step: prepare duplicate-checkpoint/runtime-readiness preflight for a single main-worker-controlled `injectionOrder/310` v3 live decision.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RUN_ID `20260427T081623Z` RWO-06H evidence.
3. Prefer `RWO-06H_DUPLICATE_CHECKPOINT_PREFLIGHT` in `HANDOFF_STATE.json.nextExecutableQueue`.
4. Do not run live until the endpoint packet is complete for the exact v3 payload identity above.

## Allowed Actions

- Sanitized duplicate-live checkpoint preflight.
- Runtime readiness checks using existing safe wrappers only.
- Endpoint packet assembly with endpoint/request class, target, payload SHA, duplicate checkpoint, no-live wrapper result, parser/sanitizer result, runtime readiness, business-success criteria, stop conditions, and sanitized evidence policy.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- `injectionOrder/310` live Trial mutation before endpoint packet completion.
- Repeating v1/v2 rejected or no-proof identities as live-ready evidence.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request-class identity, target, payload SHA, duplicate checkpoint decision, runtime readiness classification, endpoint-specific success criteria, stop conditions, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when the RWO-06H v3 duplicate-checkpoint/runtime-readiness preflight is recorded as completed/skipped/blocked with sanitized evidence, handoff state is updated, relevant checks pass, and roadmap-scoped changes are committed.
