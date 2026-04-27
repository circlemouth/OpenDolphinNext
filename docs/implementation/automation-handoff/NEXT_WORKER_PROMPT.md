# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-27T12:50:06Z
updated_at: 2026-04-27T12:50:06Z
source_work_order: RWO-08B
blocker_id: rwo08b-local-exact-match-diagnostic-needed
priority: high
supersedes:
- rwo08b-readonly-candidate-refresh-blocked-no-fresh-target
- chatgpt-research-intake-validation-needed

## Context

RUN_ID `20260427T121615Z` reran RWO-08B read-only candidate discovery after excluding duplicate-blocked candidates `00001` and `00005`.

- Evidence: `docs/implementation/rwo08b-readonly-candidate-refresh-20260427T121615Z/summary.sanitized.json`
- Result: `RWO08B_READONLY_CANDIDATE_REFRESH_BLOCKED_NO_FRESH_TARGET`
- Candidate set: `00001` through `00011`
- Accepted proposal candidates before exclusion: `2`
- Selected candidate after exclusion: `none`
- Non-excluded candidates `00002` through `00011`: `local_exact_match_missing`
- Exact selected-candidate preflight: `not_run`
- Phase 3 / Phase 4 / fullflow: `not_run`
- Mutation route blocked request count: `0`

RUN_ID `20260427T125006Z` recorded ChatGPT research prompts, then the owner supplied research responses. The intake validation is recorded here:

- Evidence: `docs/implementation/chatgpt-research-intake-validation-20260427T125006Z/FINAL_REPORT.md`
- Summary: `docs/implementation/chatgpt-research-intake-validation-20260427T125006Z/summary.sanitized.json`
- Result: `CHATGPT_RESEARCH_INTAKE_VALIDATED_FOR_NO_LIVE_WORK_ORDERS`

The research is sufficient for safe no-live/read-only Work Orders, but not sufficient for live retry or fullflow.

## Goal

Execute `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC` as a no-live/read-only blocker-resolution task.

Diagnose what `local_exact_match_missing` means for candidates `00002` through `00011` without running Phase 3, Phase 4, fullflow, `acceptmodv2` mutation, `medicalmodv2` mutation, `patientmodv2` mutation, or local import/sync mutation.

## Required First Steps

1. Inspect current branch, HEAD, status, and registered worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, and:
   - `docs/implementation/chatgpt-research-intake-validation-20260427T125006Z/summary.sanitized.json`
   - `docs/implementation/rwo08b-readonly-candidate-refresh-20260427T121615Z/summary.sanitized.json`
   - `docs/implementation/rwo08b-duplicate-candidate-exhaustion-20260425T152931Z/summary.sanitized.json`
3. Preserve the RWO-11/RWO-09 boundary: rollback rehearsal, release-candidate stop, paired restore, restored-target smoke, operator acceptance, and final owner GO/NO-GO/PENDING capture are external release-management gates and are not performed by this automation.
4. Prefer `RWO-08B_LOCAL_EXACT_MATCH_DIAGNOSTIC` in `HANDOFF_STATE.json.nextExecutableQueue`.

## Allowed Actions

- Repo-local no-live review of:
  - `web-client/scripts/qa-lib/orca-trial-preflight.mjs`
  - `web-client/scripts/qa-weborca-candidate-discovery.mjs`
  - `web-client/scripts/qa-weborca-readonly-preflight.mjs`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPatientSearchResource.java`
  - `server-modernized/src/main/java/open/dolphin/session/PatientServiceBean.java`
  - `server-modernized/src/main/java/open/dolphin/orca/sync/`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java`
- Diagnostic-only taxonomy refinement for `local_exact_match_missing`, such as:
  - `local_absent`
  - `local_prefix_only_nonexact`
  - `local_id_format_mismatch_possible`
  - `facility_scope_mismatch_possible`
  - `sync_precondition_unknown`
  - `ui_render_mismatch_possible`
- Focused unit tests for taxonomy/sanitizer behavior.
- Read-only runtime diagnostics only if the existing runtime path is already safe and evidence can be sanitized. Allowed runtime observations are limited to counts, booleans, status classes, hashes, route names, and mutation-route count.
- Sanitized evidence update with claim boundaries.

## Forbidden Actions

- Phase 3, Phase 4, fullflow, `acceptmodv2` mutation, `medicalmodv2` mutation, `patientmodv2` mutation, Request_Number `02` / `03` / `04` mutation, or any live mutation.
- Running local patient import/sync to create or change a fresh target without later explicit owner/operator instruction.
- Reusing `00001` or `00005` as fresh targets.
- Treating candidate discovery, HTTP `200`, dry-run success, local-search-only success, or `acceptedCandidateCount > 0` as release/fullflow evidence.
- Production ORCA, production credentials, production patient data, S3/MinIO/object-storage setup, or storage readiness claims.
- Credentials, cookies, sessions, Authorization headers, CSRF values, credential-bearing URLs, raw ORCA bodies, raw local patient payloads, raw patient detail, raw insurance detail, screenshots, HAR, traces, videos, request XML, raw network dumps, or raw request/response bodies in committed evidence or packages.
- Model-specific subagent requirements copied from ChatGPT research. If subagents are used, follow current runtime/developer/AGENTS rules.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record the exact taxonomy outcome for each tested candidate or a static-code-only stop reason.
- Record whether local search failure appears to be local DB absence, nonexact ID, facility scope, sync precondition, UI render mismatch, or still unknown.
- Record whether runtime was used; if yes, record only sanitized counts/booleans/status classes/hashes and `mutationRouteBlockedRequestCount`.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.
- `liveTrialOrca.executed=false`.

## Completion Criteria

This prompt is complete when one of the following is recorded:

- `RWO08B_LOCAL_SYNC_PRECONDITION_BLOCKER`
- `RWO08B_PATIENT_ID_NORMALIZATION_DIAGNOSTIC_BLOCKER`
- `RWO08B_FACILITY_SCOPE_DIAGNOSTIC_BLOCKER`
- `RWO08B_HARNESS_CLASSIFICATION_REFINED_NO_FRESH_TARGET`
- `RWO08B_OWNER_OPERATOR_FRESH_TARGET_REQUIRED`
- `RWO08B_READONLY_EXACT_LOCAL_TARGET_FOUND_PRE_FULLFLOW_GATE_PENDING`

Do not claim L4/fullflow success. If a fresh exact local target is found, stop at pre-fullflow gate pending exact selected-candidate preflight and a separate endpoint packet.
