# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T08:46:16Z
updated_at: 2026-04-27T08:46:16Z
source_work_order: RWO-06H
blocker_id: rwo06h-single-live-attempt-pending-worker-decision
priority: normal
supersedes:
- rwo06h-duplicate-checkpoint-runtime-preflight-needed

## Context

RUN_ID `20260427T084616Z` completed the RWO-06H v3 duplicate-checkpoint/runtime-readiness preflight:

- Evidence: `docs/implementation/rwo06h-injection-v3-live-preflight-20260427T084616Z/FINAL_REPORT.md`
- Summary: `docs/implementation/rwo06h-injection-v3-live-preflight-20260427T084616Z/summary.sanitized.json`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v3.json`
- Payload SHA-256: `6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`
- Duplicate-live checkpoint: `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`
- Preflight classification: `live_ready_pending_single_attempt`

No live Trial mutation was executed in RUN_ID `20260427T084616Z`.

## Goal

Perform the next safe RWO-06H step: a single main-worker-controlled WebORCA / ORCA Trial live decision for `injectionOrder/310` v3, only if the immediate pre-send duplicate checkpoint and runtime readiness remain valid.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RUN_ID `20260427T084616Z` RWO-06H preflight evidence.
3. Immediately before any live send, re-run a safe duplicate-live checkpoint search for the exact key above.
4. Immediately before any live send, recheck runtime health/readiness with sanitized status-only evidence.
5. If the checkpoint is still absent and runtime readiness is still 2xx/2xx, execute at most one live attempt through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` with the exact payload identity above.

## Allowed Actions

- Sanitized duplicate-live checkpoint recheck.
- Sanitized runtime readiness recheck.
- One live Trial attempt through the existing safe `medicalmodv2` wrapper for the exact endpoint/target/request class/payload identity above.
- No-live investigation and focused repo-local repair if the single attempt fails and a concrete changed precondition is available.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- More than one unchanged live send.
- A second live retry without documented no-live investigation plus a concrete fix or changed precondition.
- Changing endpoint, target, request class, workflow, or payload SHA under this prompt.
- Repeating v1/v2 rejected identities as live-ready evidence.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Business Success Criteria

HTTP 200, wrapper exit 0, dry-run success, and zero-equivalent `Api_Result` alone are not business success.

Business success requires sanitized parsed `businessAccepted` classification with allowlisted completion evidence such as information timestamp plus medical UID, invoice number, or data ID. If that cannot be established from sanitized allowlisted fields, classify the attempt as `INCONCLUSIVE` or `BLOCKED`, not success.

## Stop Conditions

- Accepted duplicate checkpoint appears before send.
- Runtime health/readiness is not 2xx immediately before send.
- Payload SHA or target differs from the preflight packet.
- Safe wrapper guard rejects the command.
- Non-Trial ORCA target is detected.
- Raw artifact, raw ORCA body, credential, cookie, CSRF/session value, patient detail, or insurance detail would need to be captured, committed, or packaged.
- Target drift, parser ambiguity, credential redaction risk, or diagnostic artifact containment failure.
- Business acceptance is reached.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request-class identity, target, payload SHA, duplicate checkpoint decision, runtime readiness, attempt number, response classification, endpoint-specific business-success criteria, stop conditions, and claim boundary.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when the single RWO-06H v3 live decision is recorded as business accepted, business rejected, inconclusive, skipped, or blocked with sanitized evidence; handoff state is updated; relevant checks pass; and roadmap-scoped changes are committed.
