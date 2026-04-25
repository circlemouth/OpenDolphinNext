# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T10:43:30Z
source_work_order: RWO-08B/RWO-08/RWO-09/RWO-11
blocker_id: fullflow-selector-master-contract-missing
priority: high
supersedes:
- fullflow-authoritative-selector-source-missing

## Context

RUN_ID `20260425T104330Z` followed the active RWO-08B handoff for authoritative direct-acceptance selector source investigation.

Sanitized evidence:

- `docs/implementation/rwo08b-authoritative-selector-source-20260425T104330Z/FINAL_REPORT.md`
- `docs/implementation/rwo08b-authoritative-selector-source-20260425T104330Z/summary.sanitized.json`
- `docs/implementation/rwo08b-authoritative-selector-source-20260425T104330Z/command-log.jsonl`

Current result:

- `qa-fullflow-weborca.mjs` remains fail-closed after RUN_ID `20260425T101308Z`; it does not inject missing selector options.
- The current reception UI constructs department and physician selector options from server-returned appointment/visit rows and the selected row.
- Patient-search direct acceptance has no selected appointment/visit row, so department/physician options remain missing and mutation stays blocked.
- Existing server-authoritative ORCA master support exposes medical-information options via `system01lstv2 Request_Number=06`.
- No implemented server route/gateway/parser contract currently exposes department/physician master options for direct acceptance.
- Local backend was unavailable in RUN_ID `20260425T104330Z`, so no read-only preflight or live Trial action was run in that run.
- Focused no-live tests passed: selector gate + reception page tests (87 tests), acceptmodv2 API tests (18 tests), and `node --check` for `qa-fullflow-weborca.mjs`.
- No L4 fullflow success, Trial order-send business success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner GO, or final release readiness is claimed.

Do not read, paste, commit, or package raw diagnostic artifact contents from prior local-only diagnostic roots. Any committed evidence must remain sanitized summaries only.

## Goal

Define and implement, or explicitly block with evidence, a safe server-authoritative department/physician selector options contract for direct patient acceptance.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and the RUN_ID `20260425T104330Z` sanitized evidence above.
3. Review current ORCA/system master support before adding any endpoint. Do not invent ORCA request numbers or parse raw ORCA details into evidence.
4. If unrelated uncommitted changes exist, do not overwrite them.

## Allowed Actions

- Research official/public ORCA documentation for department and physician master option retrieval if needed; cite only public/official sources in docs.
- Add a narrowly scoped server-authoritative options contract under `api-contract/` and `server-modernized/` if the ORCA source is identified.
- Add parser/sanitizer/unit tests that use synthetic fixtures only and emit no raw Trial data.
- Add a web-client API/query integration that consumes only server-returned option code/name fields.
- Add focused no-live reception tests showing direct patient-search acceptance can use server-returned department/physician options and still fails closed when options are absent.
- Run read-only preflight wrappers only after a concrete contract/fix and local runtime readiness are available.
- Rerun at most one diagnostic fullflow only after focused no-live verification and a passing exact read-only preflight.
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
- For source research: public/official source identity, request class/scope, option fields, and why the source is safe for this roadmap.
- For implementation: server-side trust boundary, DTO/parser allowlist, fail-closed behavior, audit/error behavior, and no raw detail exposure.
- For web-client: option construction rules, absent/ambiguous behavior, and tests proving no display-string/code synthesis.
- For any read-only preflight: endpoint/request-class identity, selected candidate class, selector readiness, mutation policy counts, and blocker/result.
- `credentialsCaptured` must remain `false`; `rawArtifactsCommittedOrPackaged` must remain `false`.

## Completion Criteria

This prompt is complete when one of these is true:

- A server-authoritative department/physician option source is implemented with focused server/client no-live tests, and exact read-only preflight is reclassified.
- A current appointment/visit-derived Trial precondition with real department/physician selector options is established and exact read-only preflight passes.
- Official/source-backed research proves no safe department/physician master option source is available in this automation scope, with sanitized evidence and next independent Work Order recorded.
- A non-skippable safety blocker is recorded with sanitized evidence and the next independent safe Work Order is selected.

In every completion path, update `HANDOFF_STATE.json`, `RELEASE_GATE_MATRIX.md`, and write a final sanitized evidence directory.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
