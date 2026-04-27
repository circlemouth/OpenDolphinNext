# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T08:53:44Z
updated_at: 2026-04-27T08:53:44Z
source_work_order: RWO-06H
blocker_id: rwo06h-injection-v3-business-rejected-no-live-investigation-needed
priority: normal
supersedes:
- rwo06h-single-live-attempt-pending-worker-decision

## Context

RUN_ID `20260427T084616Z` completed the RWO-06H `injectionOrder/310` v3 preflight and then executed exactly one main-worker-controlled WebORCA / ORCA Trial live attempt:

- Preflight evidence: `docs/implementation/rwo06h-injection-v3-live-preflight-20260427T084616Z/FINAL_REPORT.md`
- Live decision evidence: `docs/implementation/rwo06h-injection-v3-live-decision-20260427T084616Z/FINAL_REPORT.md`
- Live summary: `docs/implementation/rwo06h-injection-v3-live-decision-20260427T084616Z/summary.sanitized.json`
- Payload: `web-client/qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v3.json`
- Payload SHA-256: `6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`
- Duplicate-live checkpoint: `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-6878f9a087dc029cd9f6a28b9863ab69fa68515913f009575c8006e67e40ab5d`

Live result: HTTP `200`, sanitized `Api_Result` `90`, `responseClassification=businessRejected`, `businessAccepted=false`. Completion timestamp was present, but no medical UID, invoice number, or data ID was present. No raw ORCA body, raw patient/insurance detail, credentials, or diagnostic artifacts were captured or committed.

## Goal

Perform no-live investigation of the RWO-06H v3 rejection and either identify a concrete changed precondition/payload identity for a future retry packet or classify the injection row as blocked without repeating the live send.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RUN_ID `20260427T084616Z` preflight/live decision evidence.
3. Do not run another live `RWO-06H` send for the exact v3 identity.
4. Prefer `RWO-06H_INJECTION_V3_REJECTION_NO_LIVE_INVESTIGATION` in `HANDOFF_STATE.json.nextExecutableQueue`.

## Allowed Actions

- Official ORCA specification research for `medicalmodv2` rejection semantics and injectable row requirements.
- No-live payload/precondition review for `injectionOrder/310` v3.
- Sanitized parser/sanitizer or wrapper dry-run tests.
- Sanitized evidence update that records a changed precondition/payload identity, or a blocked classification.
- Current-head static/package/security checks if source/docs/evidence changes.

## Forbidden Actions

- Repeating the exact v3 live send unchanged.
- Any live retry without documented no-live investigation, a concrete changed precondition or payload identity, focused no-live verification, and a new duplicate/runtime preflight.
- Production ORCA or production readiness claims.
- S3/MinIO/object-storage setup or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies in committed evidence or packages.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record official source URLs checked, endpoint/request-class identity, rejection classification, no-live findings, changed-precondition decision, claim boundary, and next safe action.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when the RWO-06H v3 rejection is investigated without live mutation and the next action is recorded as changed-precondition retry-prep, blocked, or skip-to-next-roadmap-item; handoff state is updated; relevant checks pass; and roadmap-scoped changes are committed.
