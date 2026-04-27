# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T14:06:28Z
updated_at: 2026-04-27T14:06:28Z
source_work_order: SOAP-SUBJECTIVESV2
blocker_id: soap-subjectivesv2-route-contract
priority: medium
supersedes:
- rwo06g-base-charge-rn00-first-visit-gate

## Context

RUN_ID `20260427T140628Z` completed the active `RWO-06G_BASE_CHARGE_RN00_FIRST_VISIT_GATE` and continued to the next safe no-live item:

- `RWO-06G_BASE_CHARGE_RN00_FIRST_VISIT_GATE`
  - Evidence: `docs/implementation/rwo06g-rn00-rwo06h-rn-split-20260427T140628Z/summary.sanitized.json`
  - Result: `RWO06G_RN00_FIRST_VISIT_COMPATIBILITY_NOT_VALIDATED_STOP_BEFORE_LIVE`
  - Sanitized read-only classification: `2xx/nonzero_numeric/not_verified_or_not_first_visit_compatible`
  - Live Trial ORCA mutation: not executed
- `RWO-06H_INJECTION_RN01_RN02_SPLIT`
  - Evidence: `docs/implementation/rwo06g-rn00-rwo06h-rn-split-20260427T140628Z/summary.sanitized.json`
  - Result: `RWO06H_RN01_RN02_CONTRACT_SPLIT_READY_NO_LIVE`
  - Contract: `medicationgetv2` RN01 is point-master lookup only; RN02 remains the selectable-comment row-proof path.
- Focused current-head static/security refresh passed after the wrapper/test/evidence changes.

Existing sanitized evidence carried forward:

- `RWO-06H_INJECTION_TARGET_FRESHNESS_READONLY` remains blocked by `docs/implementation/rwo06h-fresh-lock-free-target-preflight-20260427T091616Z/summary.sanitized.json`.
- `RWO-06F_INSTRUCTION_CHARGE_CONTEXT_READONLY` remains blocked by `docs/implementation/rwo06f-readonly-precondition-probes-20260427T074616Z/summary.sanitized.json`.
- `RWO-06I_SURGERY_ROW_RULE_SPEC_RESEARCH` has existing changed-row identity evidence at `docs/implementation/rwo06i-changed-row-identity-research-20260427T101613Z/summary.sanitized.json`.

RWO-11/RWO-09 rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture are external release-management gates and are not performed by this automation.

## Goal

Execute `SOAP_SUBJECTIVESV2_ROUTE_CONTRACT` as the next independent repo-local no-live queue item. Lock endpoint, method, serializer, parser, sanitizer, and transport-failure classification so subjectivesv2 failures such as 404/502 are not misclassified as business rejection or success.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/rwo06g-rn00-rwo06h-rn-split-20260427T140628Z/summary.sanitized.json`
   - `docs/implementation/chatgpt-research-intake-validation-20260427T125006Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary as external release-management gates.
4. Prefer `SOAP_SUBJECTIVESV2_ROUTE_CONTRACT` in `HANDOFF_STATE.json.nextExecutableQueue` unless a higher-priority non-human, non-RWO-11/RWO-09 safe item is newly inserted.

## Allowed Actions

- Repo-local no-live wrapper/parser/sanitizer/contract checks for subjectivesv2.
- Official ORCA specification research if subjectivesv2 endpoint semantics are unclear.
- Focused tests and sanitized evidence updates.
- Handoff state update and current-head static/security refresh after changes.

## Forbidden Actions

- Live subjectivesv2 mutation or any other live Trial mutation.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, storage readiness claims, fullflow, screenshots, HAR, traces, videos, raw network dumps, request XML, raw ORCA bodies, raw patient detail, raw insurance detail, credentials, cookies, sessions, Authorization headers, or CSRF values.
- Changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record endpoint/request class, route/method/serializer/parser/sanitizer contract, no-live test result, and transport-failure classification behavior.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when sanitized no-live subjectivesv2 route/parser/sanitizer contract evidence exists, or when a sanitized skip/blocker explains why it cannot proceed and points to the next safe queue item.

## Same-Run Continuation Requirement

Completing or skipping this prompt is not, by itself, a valid reason to end the automation run. After recording evidence or a sanitized skip/blocker, continue to the next safe item in `HANDOFF_STATE.json.nextExecutableQueue` unless a global stop condition is reached.
