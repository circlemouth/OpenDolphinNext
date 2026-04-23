# NEXT_WORKER_PROMPT

status: completed
created_at: 2026-04-23T14:01:51Z
completed_at: 2026-04-23T15:18:28Z
source_work_order: RWO-06
blocker_id: phase4-medicalmodv2-business-rejected-api-result-14
priority: high
supersedes:
- phase4-medicalmodv2-runtime-readiness-blocked-before-live

## Completion Update

RUN_ID `20260423T150257Z` completed this handoff. The stale Phase4 payload used `departmentCode=11` / `physicianCode=0005`; repo-local sanitized semantics mapped `apiResult=14` to stale physician context, and prior sanitized Phase3 Trial evidence for target `00001` used `departmentCode=01` / `physicianCode=10001`.

The worker added `web-client/qa/payloads/phase4/medicalmodv2_phase4_dummy_phase3_context_v1.json`, hardened the safe wrapper to reject the stale department/physician context before live ORCA, passed focused no-live verification, then executed one sanitized live Trial retry through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs`.

Sanitized live result:

- HTTP status: `200`
- `apiResult`: `00`
- response classification: `businessAccepted`
- business accepted: `true`
- completion evidence: information timestamp and medical UID present
- credentials captured: `false`
- raw artifacts captured: `false`

Evidence:

- `docs/implementation/rwo06-medicalmodv2-api14-context-repair-20260423T150257Z/FINAL_REPORT.md`
- `docs/implementation/rwo06-medicalmodv2-api14-context-repair-20260423T150257Z/summary.sanitized.json`
- `docs/implementation/rwo06-medicalmodv2-api14-context-repair-20260423T150257Z/wrapper-live/phase4-medicalmodv2-summary.sanitized.json`

## Context

RWO-06 `medicalmodv2` remains the active roadmap task. Owner direction RUN_ID `20260423T122650Z` allows repeated `medicalmodv2` fix-and-retry cycles without fresh owner approval, but only after sanitized investigation, repo-local fix when in scope, focused no-live verification, safe wrapper preflight, and sanitized evidence recording.

RUN_ID `20260423T140151Z` fixed the non-S3 Trial runtime readiness blocker by adding a constrained `trial-local` WebORCA Trial runtime fallback in `OrcaConnectionConfigStore`. The fallback is non-persisted and only applies when the runtime environment is `trial-local`, the requested facility matches the runtime facility, the ORCA target is WebORCA Trial over HTTPS, WebORCA mode is selected, and runtime ORCA credentials are present. Production and non-Trial runtimes continue to fail closed.

Post-fix readiness and wrapper preflight:

- `/api/health`: HTTP `200`
- `/api/health/readiness`: HTTP `200`
- ORCA readiness: `UP`, `mode=weborca`, `credentialConfigured=true`, `clientAuthConfigured=false`
- wrapper dry-run: passed
- credentials captured: `false`
- raw artifacts captured: `false`

The one allowed live Trial retry for that cycle was then executed through `web-client/scripts/qa-phase4-safe-medicalmodv2.mjs` using the previously approved payload hash:

- RUN_ID: `20260423T140151Z`
- endpoint: `POST /api/orca/official/chart-support/medical-mod-v2`
- target: `00001/00001`
- request class: `medicalmodv2`
- payload SHA-256: `e0f34fa28177155bf19cc0476863bf540f8b1ff4d844ddf189b88ab327645618`
- HTTP status: `200`
- response classification: `businessRejected`
- `apiResult`: `14`
- business accepted: `false`
- completion evidence: information timestamp present; medical UID, invoice number, and data ID absent

Evidence:

- `docs/implementation/rwo06-medicalmodv2-runtime-fallback-20260423T140151Z/FINAL_REPORT.md`
- `docs/implementation/rwo06-medicalmodv2-runtime-fallback-20260423T140151Z/summary.sanitized.json`
- `docs/implementation/rwo06-medicalmodv2-runtime-fallback-20260423T140151Z/wrapper-live/phase4-medicalmodv2-summary.sanitized.json`

## Goal

Investigate and repair the sanitized `apiResult=14` / `businessRejected` outcome for Phase 4 `medicalmodv2` without raw ORCA bodies or credential exposure. If a repo-local request-construction or approved dummy payload contract fix is found, run focused no-live verification, wrapper dry-run/readiness preflight, and then one sanitized live `medicalmodv2` Trial retry for that fix cycle.

## Allowed Actions

- Confirm branch, HEAD, status, registered worktrees, and no unsafe unrelated changes.
- Read sanitized evidence from the RWO-06 evidence directories listed above.
- Inspect source, tests, request construction, DTO mapping, payload validators, and sanitized wrapper summaries.
- Run no-live unit/component/contract tests, guard scripts, wrapper dry-runs, parser/sanitizer tests, and status-only health/readiness probes.
- Fix repo-local request-construction, DTO mapping, sanitizer, or dummy payload contract defects that explain `apiResult=14`.
- Add or update only sanitized tests and evidence.
- Run one sanitized live `medicalmodv2` Trial attempt for a fix cycle only if:
  - the candidate request remains Request_Number `01` and class code `01`;
  - Request_Number `02` / `03` / `04` remain forbidden;
  - focused no-live verification passes;
  - wrapper dry-run passes;
  - wrapper readiness gate reports health/readiness 2xx;
  - no S3/object-storage or production ORCA requirement is introduced.
- Update `HANDOFF_STATE.json`, the release gate matrix, and run-specific sanitized evidence docs.
- Commit roadmap/handoff-scoped tracked changes before reporting.

## Forbidden Actions

- Blind or tight-loop live retries without a preceding investigation/fix/focused no-live verification cycle.
- Live retry while readiness is not 2xx.
- Phase3 / `acceptmodv2` rerun.
- Fullflow execution.
- Request_Number `02` / `03` / `04`.
- `diseasev3` or `subjectivesv2` live execution.
- Production ORCA execution or production ORCA readiness claims.
- S3/MinIO/object-storage setup, dummy S3, fake credentials, object-storage emulation, or storage readiness claims.
- Printing, requesting, committing, or working around ORCA credentials, production credentials, external-service passwords/tokens, cookies, session IDs, Authorization headers, CSRF values, credential-bearing URLs, or raw ORCA bodies.
- Reading or printing generated runtime files that may contain credentials except through presence-only/sanitized classification.
- HAR, trace, video, screenshot, raw network dump, request XML, raw request/response body, raw network JSON, or body-derived artifacts.
- `env`, `printenv`, `set`, `history`, or `set -x`.
- Changes under legacy `client/` or `server/`.

## Required Evidence

- Sanitized investigation summary with branch/HEAD and status-only readiness evidence.
- Root-cause or blocker classification for `apiResult=14`.
- Focused tests/checks run and results.
- If fixed: source/doc changes, focused verification, wrapper dry-run, readiness `ok=true`, and single live retry classification.
- If not fixable in the run: sanitized blocker record with precise next independent task.
- Secret/raw-artifact scan over new tracked evidence docs.
- Files changed and verification commands.

## Completion Criteria

This prompt is complete when one of the following is true:

- `medicalmodv2` live Trial business acceptance is achieved through the safe wrapper with completion evidence.
- `apiResult=14` is explained and a next narrower blocker prompt is written because the remaining fix requires a human business decision, a new Trial data setup decision, or information that cannot be obtained safely without raw ORCA bodies.
- A stricter stop condition is reached and recorded with sanitized evidence.

In every completion path:

- credentials printed/captured in the new run: `false`
- raw artifacts captured: `false`
- no production ORCA, S3/MinIO/object-storage, fullflow, blind live retry, or final release readiness claim

## Stop Conditions

- Root-cause classification would require raw ORCA request/response bodies, raw patient or insurance details, credentials, HAR/trace/video/screenshot/raw network artifacts, or backend logs containing unredacted secrets.
- A live retry would be required before a repo-local fix and focused no-live verification are complete.
- Production ORCA or S3/object-storage configuration would be required instead of being skippable.
- Target/scope ambiguity.
- Unsafe repo state or unrelated worktree changes make a safe commit impossible.

## Final Report Requirements

Use `【ワーカー報告】` and include:

- branch and HEAD
- active handoff prompt and source evidence path
- current Work Order and next Work Order
- root-cause classification or blocker classification
- files changed and commit id
- tests/checks run
- Trial ORCA endpoint/target/request class if any live step was used
- blockers and recommended next action
- credentials captured: expected `no`
- raw artifacts captured: expected `no`
