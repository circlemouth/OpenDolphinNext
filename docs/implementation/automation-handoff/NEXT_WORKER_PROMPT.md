# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T11:13:31Z
source_work_order: RWO-08B/RWO-08
blocker_id: selector-options-runtime-preflight-pending
priority: high
supersedes:
- fullflow-selector-master-contract-missing

## Context

RUN_ID `20260425T111331Z` completed the no-live implementation for the server-authoritative direct-acceptance selector options contract.

Sanitized evidence:

- `docs/implementation/rwo08b-selector-options-contract-20260425T111331Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-selector-options-contract-20260425T111331Z/summary.sanitized.json`
- `docs/implementation/rwo08b-selector-options-contract-20260425T111331Z/command-log.jsonl`

Current result:

- New server route: `GET /api/orca/official/appointments/selector-options`.
- ORCA source: `/api01rv2/system01lstv2` with `Request_Number=01` for department options and `Request_Number=02` for doctor options.
- Returned fields are allowlisted to `departments[].code/name` and `physicians[].code/name`.
- Reception direct patient-search acceptance now consumes server-returned selector options and still rejects display-string/code synthesis.
- Focused no-live verification passed: server parser/resource/payload/inventory tests (29 tests), reception + acceptmodv2 tests (67 tests), web typecheck, and `git diff --check`.
- Local backend was unavailable (`health=000`, `readiness=000`), so exact read-only selector preflight was not run.
- No diagnostic fullflow, live mutation, L4 success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner GO, or final release readiness is claimed.

Do not read, paste, commit, or package raw diagnostic artifact contents from prior local-only diagnostic roots. Any committed evidence must remain sanitized summaries only.

## Goal

Start or use the approved non-S3 local WebORCA Trial runtime, then reclassify exact read-only selector readiness using the new server-authoritative selector route before any diagnostic fullflow retry.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T111331Z` sanitized evidence.
3. Confirm the local runtime path does not require S3/MinIO/object-storage configuration.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Start the documented non-S3 Trial runtime profile if local-only safe config is available or can be generated under the automation policy.
- Run health/readiness status-only checks.
- Run read-only selector preflight wrappers after runtime readiness is available.
- Add a narrowly scoped preflight wrapper adjustment if the wrapper does not yet read `GET /api/orca/official/appointments/selector-options`.
- Add parser/sanitizer/unit tests using synthetic fixtures only.
- Rerun at most one diagnostic fullflow only after exact read-only selector readiness passes and all focused no-live checks remain green.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Inventing client constants for department/physician options and treating them as authoritative.
- Parsing display strings, hidden DOM values, old RUN_ID evidence, or QA defaults as canonical selector options.
- Reintroducing DOM option injection in the diagnostic fullflow harness.
- Running live mutation without exact read-only selector readiness.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For read-only preflight: runtime readiness status classes, selector route identity, option-count presence, selected candidate class, selector readiness, mutation policy counts, and blocker/result.
- For any diagnostic fullflow: sanitized extracted summary only, with local-only/untracked diagnostic artifacts if captured.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- Exact read-only selector preflight passes using server-authoritative selector options, and the next diagnostic fullflow retry is queued or executed under policy.
- Exact read-only selector preflight is blocked by a current runtime/business precondition, with sanitized evidence and next independent Work Order recorded.
- Local runtime remains unavailable for this run, with sanitized skip evidence and the next independent safe Work Order selected.
- A non-skippable safety blocker is recorded with sanitized evidence.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
