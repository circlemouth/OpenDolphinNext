# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T13:20:00Z
source_work_order: RWO-08B/RWO-08
blocker_id: fullflow-current-target-no-active-entry-after-accept
priority: high
supersedes:
- fullflow-canonical-charts-handoff-timeout-after-accept

## Context

RUN_ID `20260425T124401Z` investigated the canonical Charts handoff timeout after accepted direct candidate `00001`.

Sanitized evidence:

- `docs/implementation/rwo08b-canonical-handoff-investigation-20260425T124401Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-canonical-handoff-investigation-20260425T124401Z/summary.sanitized.json`
- `docs/implementation/rwo08b-canonical-handoff-investigation-20260425T124401Z/command-log.jsonl`

Current result:

- Repo-local fix: pending accept handoff resolution now allows a unique refreshed server entry to complete handoff when `patientId`, `visitDate`, `departmentCode`, and `physicianCode` match and the refreshed entry carries `scheduleKey` or `encounterKey`.
- Fail-closed behavior remains: patient-only pending handoff is rejected, ambiguous refreshed entries are rejected, and no client-provided canonical key is synthesized.
- Focused no-live tests passed (`receptionHandoff`: 8 tests), `verify:web-guard` passed, and `typecheck` passed.
- Runtime profile remained `orca-trial-no-object-storage`; status-only health/readiness/web checks were `200` / `200` / `200`.
- Runtime-ready smoke passed with JSON-only evidence.
- Exact read-only selector preflight for candidate `00001` passed with `targetMutationRequestCount=0`.
- One diagnostic fullflow was attempted after the concrete repo-local fix and remained blocked before Charts handoff: the patient-search open-Charts control was disabled with a no-active-entry classification, no `scheduleKey`/`encounterKey` was available, order send was not reached, and request XML was not created.
- No request XML was created.
- No L4 fullflow success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness is claimed.

Do not read, paste, commit, or package raw diagnostic artifact contents from prior local-only diagnostic roots. Committed evidence must remain sanitized summaries only.

## Goal

Diagnose why current Trial candidate `00001` does not produce an active refreshed entry/canonical handoff after accept, or select a changed current Trial precondition that yields exactly one active refreshed entry with a server/refreshed canonical key.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T124401Z` sanitized evidence.
3. Confirm the local runtime path remains non-S3 and does not require S3/MinIO/object-storage configuration.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Inspect source for reception-to-Charts handoff construction and canonical handoff wait logic.
- Add no-live/unit/component tests using synthetic fixtures only.
- Run status-only health/readiness, runtime-ready smoke, and exact read-only selector preflight.
- Run at most one diagnostic fullflow only after a new concrete repo-local fix or changed runtime/test-data precondition plus focused no-live verification.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating diagnostic fullflow without a concrete fix or changed precondition.
- Running live order-send mutation as a substitute for resolving the handoff blocker.
- Reintroducing DOM option injection or display-string selector synthesis.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For the handoff investigation: route identity, selected candidate class, active-entry status after accept, canonical handoff status, order-send reachability, request XML presence/absence, timeout/error classification, and fix/precondition justification.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A concrete fix or changed precondition resolves the no-active-entry/canonical handoff blocker and the next diagnostic fullflow is queued or executed under policy.
- The no-active-entry/canonical handoff blocker is classified as a current runtime/business/test-data blocker with sanitized evidence and next independent Work Order recorded.
- Local runtime is unavailable for the run, with sanitized skip evidence and the next independent safe Work Order selected.
- A non-skippable safety blocker is recorded with sanitized evidence.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
