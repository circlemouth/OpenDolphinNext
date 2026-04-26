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

Current result:

- Current branch/head: `master` / `ed3999aa5`
- Accepted reviewer packet source freeze: `master` / `b103e49ee06d1c1043c066a097f7c62408c32263`
- Reviewer packet: `artifacts/reviewer-submission-packets/submission-packet-20260425T174429Z.zip`
- Packet sha256: `415b1fb493632176b44d5d38cc02c8f95c6783de392e491082803542d201529a`
- Checks passed in the classifier run: reviewer packet contract tests (7), `check-doc-links`, and `web-client verify:web-guard`.
- Rollback rehearsal is classified as `pending_human_operator_decision`; repo-local dry-runs cannot prove release-candidate deployment stop, paired restore, restored-target smoke, or operator/owner acceptance.
- No live Trial mutation, production ORCA, S3/MinIO/object-storage setup, diagnostic artifact capture, raw artifact packaging, actual rollback rehearsal, owner final GO, or final release readiness is claimed.
- Latest independent non-live refresh evidence: `docs/implementation/rwo09-non-s3-static-refresh-20260425T204432Z/FINAL_REPORT.md` and `docs/implementation/rwo09-non-s3-static-refresh-20260425T204432Z/summary.sanitized.json`.
- Latest order-family research evidence: `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md`. Recommended no-live priority is `injectionOrder/310` `130000510`, then `baseChargeOrder/110` `111000110`, then `instractionChargeOrder/130` `113001810`; `radiologyOrder/700`, `surgeryOrder/500`, and `testOrder/600` require changed identities or changed preconditions before any live retry.
- Latest remaining ORCA-spec intake: `docs/implementation/clinical-functional-release-readiness-roadmap-20260422/orca-trial-remaining-spec-intake-20260426T124656Z.md`. It adds `medicationgetv2` / `masterlastupdatev3` read-only master-validity guidance for injection, `acceptmodv2` `Request_Number=00` first-visit inquiry guidance for base-charge, wrapper/no-live stop conditions for `subjectivesv2` and `diseasev3`, and RWO-07 operation mapping.
- Latest injection master-validity no-live preflight plan: `docs/implementation/rwo06h-injection-master-validity-preflight-20260426T132941Z/FINAL_REPORT.md`. It requires read-only `medicationgetv2` for the injection medication row and `masterlastupdatev3` for procedure/material/comment rows before any live attempt. Runtime master lookup remains not run.

## Goal

Advance only if new safe evidence exists: record an actual operator rollback rehearsal with sanitized evidence, or record final owner GO/NO-GO/PENDING if supplied. If neither exists, do not repeat the same classification; select the next independent non-live roadmap task that is safe under the Trial-only, non-S3 scope.

## Required First Steps

1. Inspect current branch, HEAD, status, and worktrees.
2. Read `$CODEX_HOME/automations/orca/memory.md`, `HANDOFF_STATE.json`, this prompt, roadmap docs, and RUN_ID `20260425T182930Z` sanitized evidence.
3. Confirm no unrelated uncommitted changes would be overwritten.
4. Check whether new owner/operator input or a new release-candidate rollback environment exists. If absent, continue to independent non-live work rather than re-recording the same blocker.

## Allowed Actions

- Record a real operator rollback rehearsal only if the environment/action has already been safely performed or is available without production ORCA, S3/object-storage, credentials, raw artifacts, or out-of-scope operations.
- Update RWO-11 claim-boundary docs, matrices, and sanitized evidence.
- Record final GO/NO-GO/PENDING only if explicit owner decision evidence is supplied.
- Continue to independent non-live static/package/security checks if rollback/final GO is blocked.
- Continue to independent non-live order-family candidate preparation using `order-family-v2-candidate-research-20260425T215740Z.md` if rollback/final GO is blocked. This is limited to payload identity drafting, parser/sanitizer tests, wrapper dry-runs, duplicate checkpoint checks, and claim-boundary updates; it is not approval to run live Trial.

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
