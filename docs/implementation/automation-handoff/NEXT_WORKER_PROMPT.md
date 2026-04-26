# NEXT_WORKER_PROMPT

status: active
created_at: 2026-04-25T18:29:30Z
source_work_order: RWO-11/RWO-09
blocker_id: final-owner-go-or-operator-rollback-rehearsal-pending
priority: normal
supersedes:
- rollback-rehearsal-or-final-owner-go-pending

## Context

RUN_ID `20260425T182930Z` classified the active rollback/owner-decision handoff.

RUN_ID `20260425T191429Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, left this blocker pending, and advanced independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `7670a304a703a39a14c811dd03a9200c2487302f`.

RUN_ID `20260425T204432Z` again found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, did not reclassify the existing rollback blocker, and refreshed the independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `86c2d18b9d56dbfdd15937de5845f04f81402c53`.

RUN_ID `20260425T215740Z` was an external research-only worker result later intaken at HEAD `ed3999aa5`: `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md`. It is source-backed no-live research only, not live acceptance evidence. It may be used by future automation to prepare independent non-live order-family candidate/contract work if rollback/final owner input remains absent.

RUN_ID `20260426T112213Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input and advanced independent no-live RWO-06H work. It added focused injection v2 row-role/code-shape contract coverage plus a safe wrapper dry-run for `injectionOrder/310` payload SHA `1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300`; no live Trial request was executed.

RUN_ID `20260426T124656Z` intook a sanitized external ChatGPT ORCA-spec report as automation evidence: `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/orca-trial-remaining-spec-intake-20260426T124656Z.md`. It records no-live priority, operation mappings, official URL pointers, and live stop conditions. It is documentation-only evidence and does not authorize live Trial execution by itself.

RUN_ID `20260426T132941Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input and advanced independent no-live RWO-06H work. It added a sanitized injection v2 master-validity preflight plan requiring read-only `medicationgetv2` / `masterlastupdatev3` checks for the procedure, medication, material, and comment rows before any live Trial attempt; no runtime master lookup and no live Trial request was executed.

RUN_ID `20260426T145500Z` updated the automation handoff document set with an executable-queue throughput policy. `HANDOFF_STATE.json.nextExecutableQueue` is now the machine-readable next-task list. If this human-pending rollback/owner blocker has no new explicit input, workers should carry it forward without reclassification and immediately continue to the first safe non-human queue item.

RUN_ID `20260426T140206Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input and advanced the executable queue. It added a sanitized read-only Trial wrapper for `RWO-06H` injection master validity, ran one read-only `medicationgetv2` / `masterlastupdatev3` pass, and stopped before live because medication code `620000012` was not validated (`2xx` / `other_present` / `masterFound=false`). The same run prepared the `RWO-06G` no-live `acceptmodv2` `Request_Number=00` first-visit compatibility plan. No live Trial mutation was executed.

RUN_ID `20260426T170241Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, left this blocker pending, and refreshed independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `9a35c5c0ff312bf9fc78c7dd252ac9a936d36203`. No live Trial mutation, diagnostic artifact capture, production ORCA, or S3/object-storage setup was executed.

RUN_ID `20260426T180208Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, left this blocker pending, and refreshed independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `6d3e319b915d3a0976e13015bda046028dc6d66c`. No live Trial mutation, diagnostic artifact capture, production ORCA, or S3/object-storage setup was executed.

RUN_ID `20260426T190239Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, left this blocker pending, and refreshed independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `faa53ec28e893dff6606030d7d99a2399c6f63a2`. No live Trial mutation, diagnostic artifact capture, production ORCA, or S3/object-storage setup was executed.

RUN_ID `20260426T200210Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, left this blocker pending, and refreshed independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `1ee2778ff39dfba640ac174a8fb0a0dc4d7311ae`. No live Trial mutation, diagnostic artifact capture, production ORCA, or S3/object-storage setup was executed.

RUN_ID `20260426T210142Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input, left this blocker pending, and refreshed independent non-live RWO-09/RWO-11 static/package/security checks at current HEAD `3980669ce40d6c64e3315f15eb1665ac8e1412e7`. No live Trial mutation, diagnostic artifact capture, production ORCA, or S3/object-storage setup was executed.

RUN_ID `20260426T212101Z` intook the user-supplied ORCA Trial Specification Research Report as sanitized secondary research: `docs/implementation/orca-spec-research-intake-20260426T212101Z/README.md`. It is not live acceptance evidence and does not authorize live execution. It updates no-live priorities: `RWO-06H` must prove an injectable medication row with `medicationgetv2 Request_Number=02` and must not retry oral-tablet code `620000012`; `RWO-06G` must repair/tighten `acceptmodv2 Request_Number=00` parsing so active acceptance plus consultation-fee/first-visit-compatible fields are required; `RWO-08B` must use a fresh target with unique active acceptance, no duplicate, and server-derived official identifiers before any diagnostic fullflow retry.

RUN_ID `20260426T223215Z` found no new owner/operator rollback rehearsal evidence or final GO/NO-GO/PENDING input and advanced the executable queue. It added a read-only candidate override guard for `RWO-06H` so unchanged `620000012` cannot be reused as injectable evidence, checked candidate medication codes `620076111` and `620007539` with `medicationgetv2 Request_Number=02`, and stopped before live because both returned sanitized `2xx` / `other_present` / `masterFound=false`. The same run hardened `RWO-06G` `acceptmodv2 Request_Number=00` parsing so `apiResult=60`, HTTP 2xx, patient-info-only, or active acceptance without consultation-fee/first-visit fields fail closed. `RWO-08B` was skipped without diagnostic fullflow because no fresh target or server-derived official identifier precondition was available without live mutation/raw artifacts.

Sanitized evidence:

- `docs/implementation/rwo11-rollback-owner-pending-20260425T182930Z/FINAL_REPORT.md`
- `docs/implementation/rwo11-rollback-owner-pending-20260425T182930Z/summary.sanitized.json`
- `artifacts/orca-remediation/closeout/20260425T182930Z/`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md`
- `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/orca-trial-remaining-spec-intake-20260426T124656Z.md`
- `docs/implementation/rwo06h-injection-v2-contract-preflight-20260426T112213Z/FINAL_REPORT.md`
- `docs/implementation/rwo06h-injection-v2-contract-preflight-20260426T112213Z/summary.sanitized.json`
- `docs/implementation/rwo06h-injection-master-validity-preflight-20260426T132941Z/FINAL_REPORT.md`
- `docs/implementation/rwo06h-injection-master-validity-preflight-20260426T132941Z/summary.sanitized.json`
- `docs/implementation/automation-handoff/AUTOMATION_THROUGHPUT_POLICY.md`
- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/FINAL_REPORT.md`
- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/summary.sanitized.json`
- `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/base-charge-first-visit-plan.sanitized.json`
- `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/FINAL_REPORT.md`
- `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/summary.sanitized.json`
- `docs/implementation/rwo07-operation-matrix-hardening-20260426T150137Z/OPERATION_MATRIX_HARDENING.md`
- `docs/implementation/rwo07-operation-matrix-hardening-20260426T150137Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T160138Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T160138Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T170241Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T170241Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T180208Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T180208Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T190239Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T190239Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T200210Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T200210Z/summary.sanitized.json`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T210142Z/FINAL_REPORT.md`
- `docs/implementation/rwo09-non-s3-static-refresh-20260426T210142Z/summary.sanitized.json`
- `docs/implementation/orca-spec-research-intake-20260426T212101Z/README.md`
- `docs/implementation/orca-spec-research-intake-20260426T212101Z/summary.sanitized.json`
- `docs/implementation/rwo06h-rwo06g-rwo08b-preflight-20260426T223215Z/FINAL_REPORT.md`
- `docs/implementation/rwo06h-rwo06g-rwo08b-preflight-20260426T223215Z/summary.sanitized.json`

Current result:

- Current branch/head: `master` / `3980669ce`
- Accepted reviewer packet source freeze: `master` / `b103e49ee06d1c1043c066a097f7c62408c32263`
- Reviewer packet: `artifacts/reviewer-submission-packets/submission-packet-20260425T174429Z.zip`
- Packet sha256: `415b1fb493632176b44d5d38cc02c8f95c6783de392e491082803542d201529a`
- Checks passed in the classifier run: reviewer packet contract tests (7), `check-doc-links`, and `web-client verify:web-guard`.
- Rollback rehearsal is classified as `pending_human_operator_decision`; repo-local dry-runs cannot prove release-candidate deployment stop, paired restore, restored-target smoke, or operator/owner acceptance.
- No live Trial mutation, production ORCA, S3/MinIO/object-storage setup, diagnostic artifact capture, raw artifact packaging, actual rollback rehearsal, owner final GO, or final release readiness is claimed.
- Latest independent non-live refresh evidence: `docs/implementation/rwo09-non-s3-static-refresh-20260426T210142Z/FINAL_REPORT.md` and `docs/implementation/rwo09-non-s3-static-refresh-20260426T210142Z/summary.sanitized.json`.
- Latest order-family research evidence: `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md`. Recommended no-live priority is `injectionOrder/310` `130000510`, then `baseChargeOrder/110` `111000110`, then `instractionChargeOrder/130` `113001810`; `radiologyOrder/700`, `surgeryOrder/500`, and `testOrder/600` require changed identities or changed preconditions before any live retry.
- Latest remaining ORCA-spec intake: `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/orca-trial-remaining-spec-intake-20260426T124656Z.md`. It adds `medicationgetv2` / `masterlastupdatev3` read-only master-validity guidance for injection, `acceptmodv2` `Request_Number=00` first-visit inquiry guidance for base-charge, wrapper/no-live stop conditions for `subjectivesv2` and `diseasev3`, and RWO-07 operation mapping.
- Latest injection master-validity read-only attempt: `docs/implementation/rwo06h-injection-master-validity-readonly-20260426T140206Z/FINAL_REPORT.md`. `masterlastupdatev3` returned sanitized `2xx` / `success_zero` for procedure/material/comment, but `medicationgetv2` for medication `620000012` returned sanitized `2xx` / `other_present` and `masterFound=false`; injection live remains stopped until changed evidence or a changed candidate identity exists.
- Latest base-charge first-visit read-only attempt: `docs/implementation/rwo06g-base-charge-first-visit-readonly-20260426T150137Z/FINAL_REPORT.md`. The read-only `acceptmodv2` `Request_Number=00` check returned sanitized `2xx` / `nonzero_numeric` / `not_verified_or_not_first_visit_compatible`; baseChargeOrder/110 live remains stopped until changed first-visit evidence or a changed candidate/precondition exists.
- Latest ORCA spec research intake: `docs/implementation/orca-spec-research-intake-20260426T212101Z/README.md`. Treat it as no-live/read-only guidance only. Next priority is injection row-level proof for an injectable candidate using `medicationgetv2 Request_Number=02`; `masterlastupdatev3` is not row-level proof, `620000012` must not be retried unchanged as injection, base-charge RN00 evidence must include active acceptance plus consultation-fee/first-visit-compatible fields, and RWO-08B fullflow must not repeat `00001`/`00005` unchanged or synthesize official identifiers.
- Latest RWO-06H/RWO-06G/RWO-08B queue result: `docs/implementation/rwo06h-rwo06g-rwo08b-preflight-20260426T223215Z/FINAL_REPORT.md`. `620076111` and `620007539` did not produce row-level injectable medication proof; injection live remains stopped. `acceptmodv2 Request_Number=00` parser/preflight is hardened; base-charge live remains stopped until active acceptance plus consultation-fee/first-visit fields are proven. RWO-08B remains blocked until a fresh target and server-derived official identifiers are proven without raw artifacts.
- Latest RWO-07 operation matrix hardening: `docs/implementation/rwo07-operation-matrix-hardening-20260426T150137Z/OPERATION_MATRIX_HARDENING.md`. `Request_Number=00` is inquiry-only, `01` is create, and `02` / `03` / `04` remain queued for endpoint-specific no-live contracts before any live action.
- Latest throughput policy: `docs/implementation/automation-handoff/AUTOMATION_THROUGHPUT_POLICY.md`. `HANDOFF_STATE.json.nextExecutableQueue` has processed the 20260426T212101Z follow-up items through RUN_ID `20260426T223215Z`: `RWO-06H_READONLY_INJECTABLE_MASTER_ROW_PROOF` is skipped/stopped before live because row proof was not produced, `RWO-06G_RN00_PARSER_PREFLIGHT_REPAIR` is completed, and `RWO-08B_L4_FULLFLOW_OFFICIAL_IDENTIFIER_PREFLIGHT` is skipped until a fresh target/server-derived identifier precondition exists. Existing completed items remain historical evidence. Do not run injection, baseChargeOrder/110, or diagnostic fullflow live from this intake alone.

## Goal

Advance only if new safe evidence exists: record an actual operator rollback rehearsal with sanitized evidence, or record final owner GO/NO-GO/PENDING if supplied. If neither exists, do not repeat the same classification; select the next independent non-live roadmap task that is safe under the Trial-only, non-S3 scope.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T182930Z` sanitized evidence.
3. Confirm no unrelated uncommitted changes would be overwritten.
4. Check whether new owner/operator input or a new release-candidate rollback environment exists. If absent, carry this blocker forward without reclassification and process `HANDOFF_STATE.json.nextExecutableQueue` from the first safe non-human item.

## Allowed Actions

- Record a real operator rollback rehearsal only if the environment/action has already been safely performed or is available without production ORCA, S3/object-storage, credentials, raw artifacts, or out-of-scope operations.
- Update RWO-11 claim-boundary docs, matrices, and sanitized evidence.
- Record final GO/NO-GO/PENDING only if explicit owner decision evidence is supplied.
- Continue to independent non-live static/package/security checks if rollback/final GO is blocked.
- Continue to independent non-live order-family candidate preparation using `order-family-v2-candidate-research-20260425T215740Z.md` if rollback/final GO is blocked. This is limited to payload identity drafting, parser/sanitizer tests, wrapper dry-runs, duplicate checkpoint checks, and claim-boundary updates; it is not approval to run live Trial.
- Process `HANDOFF_STATE.json.nextExecutableQueue` and complete or skip multiple independent no-live/read-only items in the same run when safe.

## Forbidden Actions

- Production ORCA execution or production readiness claims.
- S3/MinIO/object-storage setup, dummy storage, fake object-storage credentials, or storage readiness claims.
- Printing, requesting, committing, or packaging credentials, cookies, session IDs, auth headers, anti-forgery values, credential-bearing URLs, raw ORCA bodies, raw patient details, raw insurance details, screenshots, HAR, traces, videos, raw network dumps, request XML, or raw request/response bodies.
- Running live Trial mutation as a substitute for rollback/owner-decision readiness.
- Running live Trial mutation from the order-family research without a later endpoint-specific no-live verification record, sanitized preflight, duplicate-live checkpoint, and applicable approval scope.
- Repeating diagnostic fullflow for candidates `00001` or `00005` unchanged.
- Broad refactors or changes under legacy `client/` or `server/`.

## Evidence Requirements

- Sanitized Markdown/JSON only.
- Record branch/HEAD, rollback command/check scope or skip reason, current accepted reviewer packet identity, and claim boundaries.
- `credentialsCaptured=false`.
- `rawArtifactsCommittedOrPackaged=false`.

## Completion Criteria

This prompt is complete when either:

- rollback rehearsal / stop-policy evidence is refreshed through a safe sanitized repo-local path and matrices/handoff are updated; or
- final owner GO/NO-GO/PENDING is recorded from explicit owner evidence; or
- no new owner/operator input exists and the run advances another independent safe Work Order, leaving this blocker as pending without duplicate classification.

## Final Report Requirements

Use `【ワーカー報告】` and include branch/HEAD, active prompt, current Work Order, next Work Order, files changed, commit id, tests/checks, diagnostic artifact handling, live Trial endpoint/target/request class if used, sanitized business-success classification, blockers, recommended next action, credentials captured, and raw artifacts committed/packaged.
