# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T14:37:25Z
source_work_order: RWO-08B/RWO-08
blocker_id: fullflow-next-candidate-00005-diagnostic-fullflow-pending
priority: high
supersedes:
- fullflow-current-target-no-active-entry-after-accept

## Context

RUN_ID `20260425T135857Z` completed the previous handoff by classifying current candidate `00001`.

Sanitized evidence:

- `docs/implementation/rwo08b-current-target-duplicate-acceptance-20260425T135857Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-current-target-duplicate-acceptance-20260425T135857Z/summary.sanitized.json`
- `docs/implementation/rwo08b-current-target-duplicate-acceptance-20260425T135857Z/command-log.jsonl`

Current result:

- Diagnostic fullflow harness now records sanitized accept mutation classification and reception active-entry counters.
- Candidate `00001` exact read-only selector preflight passed with no mutation, but diagnostic fullflow after accept returned `apiResult=16` with no acceptance evidence, no `acceptanceId`, no `visitNumber`, no `scheduleKey`, and no `encounterKey`.
- Reception DOM diagnostics for `00001` showed one matching reservation row, zero active rows, and zero keyed active rows. The Charts handoff control stayed disabled with `no_active_entry`.
- Order send was not reached and request XML was not created.
- Candidate `00005` exact read-only preflight passed with no mutation: official exact patient evidence accepted, insurance accepted, local selectable accepted, selector options accepted, direct-acceptance appointment dependency accepted, and `targetMutationRequestCount=0`.
- `00005` input identity hash: `72afa991f8d538ad8c02b8c2e3212537ad1134cd47a5f6cf025fadf323672e75`.
- No L4 fullflow success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO, or final release readiness is claimed.

Do not read, paste, commit, or package raw diagnostic artifact contents from local-only diagnostic roots. Committed evidence must remain sanitized summaries only.

## Goal

Run at most one diagnostic fullflow for changed candidate `00005`, using the existing sanitized fullflow evidence mode, to determine whether the changed Trial precondition produces exactly one active refreshed entry with a server/refreshed canonical key and reaches Charts.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T135857Z` sanitized evidence.
3. Confirm the local runtime path remains non-S3 and does not require S3/MinIO/object-storage configuration.
4. Confirm `00005` exact read-only preflight evidence is current for the same runtime or rerun read-only preflight with `targetMutationRequestCount=0`.
5. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Run status-only health/readiness checks, runtime-ready smoke, and exact read-only selector preflight.
- Run at most one diagnostic fullflow for candidate `00005` after current runtime/read-only prerequisites pass.
- Inspect source for reception-to-Charts handoff construction and canonical handoff wait logic.
- Add no-live/unit/component tests using synthetic fixtures only if the `00005` diagnostic reveals a repo-local defect.
- Commit only reviewed source changes, focused tests, sanitized evidence, handoff state, and gate matrix updates.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Repeating diagnostic fullflow for `00005` without a new concrete fix or changed precondition.
- Running live order-send mutation as a substitute for resolving the handoff blocker.
- Reintroducing DOM option injection or display-string selector synthesis.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- For `00005` fullflow: route identity, selected candidate class, active-entry status after accept, accept mutation business classification, canonical handoff status, order-send reachability, request XML presence/absence, timeout/error classification, and fix/precondition justification.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- Candidate `00005` resolves the no-active-entry/canonical handoff blocker and the next diagnostic/Trial gate is queued or executed under policy.
- Candidate `00005` is classified as a current runtime/business/test-data blocker with sanitized evidence and next independent Work Order recorded.
- Local runtime is unavailable for the run, with sanitized skip evidence and the next independent safe Work Order selected.
- A non-skippable safety blocker is recorded with sanitized evidence.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
