# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T07:06:26Z
updated_at: 2026-04-28T07:06:26Z
source_work_order: RWO-06F
blocker_id: rwo06f-readonly-context-wrapper-gaps
priority: high
supersedes:
- rwo06f-no-live-precondition-packet-hardening-needed

## Context

RUN_ID `20260428T070626Z` completed `RWO-06F_NO_LIVE_PRECONDITION_PACKET_HARDENING`.

Evidence:

- Packet hardening: `docs/implementation/rwo06f-no-live-precondition-packet-hardening-20260428T070626Z/summary.sanitized.json`
- Carry-forward blocker: `docs/implementation/rwo06f-readonly-context-carry-forward-20260428T070626Z/summary.sanitized.json`
- Prior read-only probe: `docs/implementation/rwo06f-readonly-precondition-probes-20260427T074616Z/summary.sanitized.json`

The packet now records candidate code validity, selectable-comment status, disease/facility/monthly/department/physician/insurance/master freshness statuses, duplicate checkpoint identity, parser/sanitizer flags, business-success separation, and stop conditions.

Current wrapper gap:

- existing read-only probes cover disease, monthly duplicate, and facility only;
- they do not yet safely prove candidate code validity, selectable-comment applicability, physician status, independent insurance-combination readiness, master freshness, or unchanged rejected-checkpoint refusal;
- prior evidence still has `diseaseContext`, `monthlyDuplicateContext`, and `departmentInsuranceContext` as `not_proven`; only facility summary was observed.

`RWO-11/RWO-09` rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING remain external owner/operator release-management gates. Do not execute or reclassify them.

## Goal

Execute `RWO-06F_READONLY_CONTEXT_WRAPPER_GAP_CLOSURE_NO_LIVE`.

Extend the RWO-06F safe read-only wrapper and focused tests so the next read-only preflight can either prove or safely classify:

- candidate code validity;
- selectable-comment status;
- physician status;
- insurance-combination readiness;
- master freshness;
- unchanged rejected-checkpoint refusal.

Do not run live `medicalmodv2`.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the evidence listed above.
3. Preserve `RWO-11/RWO-09` as external release-management gates.
4. Review:
   - `web-client/scripts/qa-phase4-instruction-charge-preconditions.mjs`
   - `web-client/scripts/qa-lib/phase4-instruction-charge-preconditions-evidence.mjs`
   - `web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs`
   - `web-client/scripts/__tests__/phase4InstructionChargePreconditionsEvidence.test.ts`

## Allowed Actions

- Edit `web-client/` RWO-06F no-live/read-only helper code and focused tests.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under a new `docs/implementation/rwo06f-readonly-context-wrapper-gap-closure-<RUN_ID>/` directory.
- Run focused no-live dry-runs, unit tests, JSON validation, web guard, doc links, and `git diff --check`.

## Forbidden Actions

- Any live `medicalmodv2` mutation.
- Any `Request_Number` / class `02` / `03` / `04` live work for RWO-06F.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw disease detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.
- Treating HTTP 200, `Api_Result`, wrapper exit, dry-run pass, read-only preflight, code validity, or master freshness as business success.
- Selecting `RWO-11/RWO-09` rollback/operator/final owner decision as automation execution work.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- endpoint/request-class mapping;
- payload hash/identity;
- duplicate checkpoint identity and unchanged-retry refusal;
- parser/sanitizer contract for any newly added read-only result;
- context status schema;
- stop conditions;
- business-success separation;
- non-claims;
- `credentialsCaptured=false`;
- `diagnosticArtifactsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when sanitized evidence exists showing one of:

- RWO-06F read-only wrapper gap closure completed with focused tests/checks; or
- a narrower sanitized blocker explains why one of the missing safe read-only probes cannot be implemented safely and identifies the next independent safe task.

## Same-Run Continuation Requirement

Completing this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.
