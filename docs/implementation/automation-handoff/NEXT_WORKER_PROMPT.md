# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-28T06:34:23Z
updated_at: 2026-04-28T06:34:23Z
source_work_order: RWO-06F
blocker_id: rwo06f-no-live-precondition-packet-hardening-needed
priority: high
supersedes:
- acceptmodv2-rn02-single-live-attempt-completed-business-accepted

## Context

RUN_ID `20260428T063423Z` intook owner-supplied ChatGPT ORCA specification research and converted it into repo-local sanitized context:

- Evidence: `docs/implementation/rwo06f-official-spec-context-map-20260428T063423Z/summary.sanitized.json`
- Context map: `docs/implementation/rwo06f-official-spec-context-map-20260428T063423Z/RWO06F_OFFICIAL_SPEC_CONTEXT_MAP.md`
- External gate intake schema: `docs/implementation/rwo06f-official-spec-context-map-20260428T063423Z/RWO11_RWO09_EXTERNAL_GATE_INTAKE_SCHEMA.md`

The vetted classification is:

- `RWO-06F` / `instractionChargeOrder` / `指導料` / class `130` can progress through official-spec docs, no-live endpoint packet hardening, and sanitized read-only preflight/carry-forward.
- `RWO-11/RWO-09` rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING remain external owner/operator release-management gates. Do not execute or reclassify them as automation work.

Prior RWO-06F evidence:

- `docs/implementation/rwo06f-instruction-charge-preconditions-20260427T071611Z/summary.sanitized.json`
- `docs/implementation/rwo06f-readonly-precondition-probes-20260427T074616Z/summary.sanitized.json`
- payload: `web-client/qa/payloads/phase4/medicalmodv2_instruction_charge_trial_reachability_v2.json`
- payload SHA-256: `043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858`
- representative entity: `instractionChargeOrder`
- medical class: `130`
- candidate code: `113001810`

The prior read-only probe observed `facilityContext` in sanitized form, but `diseaseContext`, `monthlyDuplicateContext`, and `departmentInsuranceContext` remained `not_proven`. Live Trial ORCA mutation is still forbidden until all preconditions and owner/operator business context are complete.

## Goal

Execute `RWO-06F_NO_LIVE_PRECONDITION_PACKET_HARDENING`.

Harden the existing RWO-06F v2 no-live packet, parser/sanitizer contract, duplicate checkpoint, context status schema, stop conditions, and focused tests so a later worker can either run a safe read-only preflight or carry forward a precise sanitized blocker.

Do not run live `medicalmodv2`. Do not run production ORCA, S3/MinIO/object-storage setup, raw artifact capture, screenshots, HAR, traces, videos, request XML, raw ORCA bodies, raw patient detail, raw disease detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF capture.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and the RWO-06F evidence listed above.
3. Preserve `RWO-11/RWO-09` as external release-management gates.
4. Review existing RWO-06F helper/test surfaces:
   - `web-client/scripts/qa-phase4-instruction-charge-preconditions.mjs`
   - `web-client/scripts/qa-lib/phase4-instruction-charge-preconditions-evidence.mjs`
   - `web-client/scripts/__tests__/phase4InstructionChargePreconditionsEvidence.test.ts`
   - `web-client/scripts/qa-lib/phase4-medicalmodv2-safe-evidence.mjs`
5. Identify whether the current no-live packet already records or needs to record:
   - candidate code validity;
   - selectable-comment status;
   - disease context status;
   - facility/system context status;
   - monthly duplicate status;
   - department status;
   - physician status;
   - insurance-combination status;
   - master freshness status;
   - duplicate checkpoint identity;
   - parser/sanitizer and raw-artifact exclusion flags;
   - endpoint-specific business-success criteria and stop conditions.

## Allowed Actions

- Edit `web-client/` RWO-06F no-live/read-only helper code and focused tests.
- Edit `docs/implementation/automation-handoff/HANDOFF_STATE.json`.
- Add sanitized evidence under a new `docs/implementation/rwo06f-no-live-precondition-packet-hardening-<RUN_ID>/` directory.
- Run focused no-live dry-runs, unit tests, JSON validation, web guard, doc links, and `git diff --check`.
- If a runtime/read-only probe is not necessary for the packet hardening, do not run it.

## Forbidden Actions

- Any live `medicalmodv2` mutation.
- Any `Request_Number` / class `02` / `03` / `04` live work for RWO-06F.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw disease detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.
- Treating HTTP 200, `Api_Result`, wrapper exit, dry-run pass, read-only preflight, or code validity as business success.
- Selecting `RWO-11/RWO-09` rollback/operator/final owner decision as automation execution work.

## Evidence Requirements

Record sanitized Markdown/JSON only:

- endpoint/request-class mapping;
- payload hash/identity;
- duplicate checkpoint identity;
- precondition status schema;
- parser/sanitizer contract;
- stop conditions;
- business-success separation;
- non-claims;
- `credentialsCaptured=false`;
- `diagnosticArtifactsCaptured=false`;
- `rawArtifactsCommittedOrPackaged=false`;
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when sanitized evidence exists showing one of:

- RWO-06F no-live precondition packet hardening completed with focused tests/checks; or
- a fresh sanitized blocker explains why the no-live packet cannot be hardened safely and identifies the next independent safe task.

## Same-Run Continuation Requirement

Completing this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.
