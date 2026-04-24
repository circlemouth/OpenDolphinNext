# ORCA Trial Reachability Expansion Plan

RUN_ID: `20260424T025733Z`

## Purpose

Owner request: add roadmap tasks to verify every currently unverified WebORCA / ORCA Trial reachability path for major chart workflows.

This plan expands the existing Trial-backed, non-S3 roadmap. It does not claim that these paths are already verified, and it does not authorize production ORCA, S3/MinIO/object-storage setup, raw artifact capture, or broad release readiness claims.

## Batch Automation Rule

One automation run may execute multiple ORCA Trial reachability checks when all of the following are true:

- Each check has its own endpoint/request-class scope, target, preflight, safe wrapper, expected sanitized business-success criteria, and evidence directory.
- Checks run sequentially, not as blind parallel live mutations.
- A failure in one check is recorded as an endpoint-specific sanitized blocker and does not prevent the same run from continuing to independent safe checks.
- Each live mutation check is preceded by focused no-live validation and a wrapper dry-run.
- The run stops before any check that would require raw ORCA request/response bodies, raw patient or insurance details, credential capture, screenshots, HAR, traces, videos, raw network dumps, production ORCA, or S3/object-storage configuration.
- HTTP 200, wrapper exit 0, readiness 2xx, dry-run success, or parser generic zero result is not treated as business success by itself.

## Hourly Automation Rule

This automation may run once per hour. Every reachability task must therefore be resumable and idempotent:

- At the start of each run, read `docs/implementation/automation-handoff/HANDOFF_STATE.json`, this plan, the latest run summaries, and `$CODEX_HOME/automations/orca/memory.md`.
- Maintain an endpoint-level checklist with statuses such as `not_started`, `no_live_verified`, `readonly_accepted`, `live_accepted`, `blocked`, `skipped_environment_unavailable`, `skipped_s3_required_out_of_scope`, and `not_applicable`.
- Do not repeat a live mutation check that already has accepted sanitized evidence for the same endpoint, request class, target, payload identity, and run-scope unless a new repo-local fix or explicit revalidation work order requires it.
- If a previous hourly run ended after a blocker, continue with the next independent safe check rather than retrying the blocked check blindly.
- A single hourly run is not required to finish every queued reachability check. It is required to finish safely within the run budget.
- Reserve time at the end of each run for sanitized evidence writing, scans, `HANDOFF_STATE.json`/gate updates, and commit when tracked files changed.
- Do not start a new live mutation check when the remaining run budget is insufficient for preflight, execution, evidence scan, blocker handling, and commit.
- If the one-hour budget is nearly exhausted, write a sanitized checkpoint and leave the next endpoint explicitly queued.
- Packet, gate matrix, and claim-boundary updates should summarize cumulative endpoint status without replacing prior endpoint-specific evidence.

## Reachability Levels

| Level | Meaning | Allowed evidence |
|---|---|---|
| L0 | Route/wrapper/static contract exists. | Source review, parser/sanitizer tests, wrapper dry-run, route inventory tests. |
| L1 | Local backend can reach the approved Trial runtime path. | Status-only health/readiness, sanitized connection classification, no raw bodies. |
| L2 | Read-only Trial endpoint returns endpoint-specific accepted business evidence. | Sanitized allowlisted parsed fields, classifications, hashes, command metadata. |
| L3 | Trial mutation endpoint returns endpoint-specific accepted business evidence. | Sanitized business summary with endpoint-specific completion evidence. |
| L4 | Browser fullflow reaches the intended Trial endpoint through the web-client and server. | Safe fullflow summary only; no screenshots/HAR/traces/videos/raw network/raw bodies. |

## Unverified Reachability Targets

| Functional area | Current evidence | Missing Trial reachability | Planned level |
|---|---|---|---|
| Clinical documents / document fee | Document save/output has local/server/component/static evidence. `文書料` examples are currently `otherOrder` / `LOCAL_OTHER:*`. | Document save/output is not ORCA order mutation evidence. `文書料` billing requires an explicit mapping to a sendable charge class before Trial mutation. | Local/browser/fullflow for documents; L0 first for any future document-fee ORCA mapping. |
| Prescription | No-live browser/local persistence and selected server/local contract evidence. One scoped `medicalmodv2` Trial acceptance exists but is not broad prescription coverage. | Prescription-specific ORCA Trial reachability through the current order-send path. | L0-L3 first; L4 only after safe fullflow is ready. |
| Injection | Local/static entity support exists. | Representative injection class-family Trial reachability. | L0-L3 after payload contract and safe wrapper readiness. |
| Treatment / generic orders | Representative treatment UI create/readback/update/delete and local contract evidence. One scoped `medicalmodv2` Trial acceptance exists but is not broad order-class coverage. | Representative non-drug treatment/generic order ORCA Trial reachability. | L0-L3 first; L4 only after safe fullflow is ready. |
| Guidance / management fees (`指導料`) | UI/server entity exists as `instractionChargeOrder`; static tests include management-fee examples. | Representative `instractionChargeOrder` Trial reachability, starting with class `130`, then `132/133/140/141/142/143/148/149` if needed. | L0-L3 after payload contract and safe wrapper readiness. |
| Base charge | UI/server entity exists as `baseChargeOrder`. | Representative `baseChargeOrder` Trial reachability for `110/114/120/124` as required by claim. | L0-L3 after payload contract and safe wrapper readiness. |
| Tests / radiology / surgery | UI/server entities exist for `testOrder`, `radiologyOrder`, and `surgeryOrder`. | Representative Trial reachability by class family. | L0-L3 after payload contract and safe wrapper readiness. |
| SOAP | No-live local subjectives/SOAP save evidence. | `subjectivesv2` or current authoritative SOAP ORCA endpoint reachability. | L0-L2/L3 after endpoint-specific safety approval and wrapper readiness. |
| Disease CRUD | No-live local diagnoses/disease CRUD evidence and ORCA mirror read-only UI behavior. | `diseasev3` or current authoritative disease ORCA endpoint reachability for create/update/delete semantics. | L0-L2/L3 after endpoint-specific safety approval and wrapper readiness. |
| Request_Number `02` / `03` / `04` | Not approved or verified. | Update/delete/cancel semantics if required by the business claim. | Separate RWO-07 approval and endpoint-specific success criteria. |
| Browser fullflow | Explicitly `not_run`. | End-to-end web-client to server-modernized to ORCA Trial evidence without forbidden artifacts. | L4 only after safe fullflow harness exists. |

## New Work Orders

### RWO-06B: Reachability Inventory And Safe Wrapper Gap Analysis

Scope:

- Build a current endpoint/request-class inventory for prescription, treatment/generic orders, SOAP, and disease CRUD.
- Map each workflow to the authoritative server route, ORCA API name, request class/number, allowed target policy, and endpoint-specific business-success criteria.
- Identify which checks can be read-only and which would be live mutation checks.
- Confirm or create safe wrapper requirements for each unverified check before live execution.

Exit criteria:

- A sanitized reachability matrix exists.
- Each target is classified as `ready_for_no_live_wrapper_work`, `ready_for_readonly_trial_probe`, `requires_live_mutation_approval`, `blocked_by_missing_safe_wrapper`, `blocked_by_business_scope`, or `out_of_scope`.

### RWO-06C: Read-Only Trial Reachability Batch

Scope:

- Run all safe read-only Trial reachability probes that have wrappers and endpoint-specific parsers.
- Multiple read-only checks may run in one automation task under the batch automation rule.

Exit criteria:

- Each read-only endpoint has sanitized L2 evidence or a sanitized blocker.
- No raw bodies, credentials, patient/insurance details, screenshots, HAR, traces, videos, or raw network artifacts are captured.

### RWO-06D: Endpoint-Specific Trial Mutation Reachability Batch

Scope:

- Run endpoint-specific live Trial mutation checks only after RWO-06B/RWO-06C prerequisites, focused no-live validation, wrapper dry-run, status-only readiness 2xx, and endpoint-specific safety approval are present.
- Multiple live checks may run in one automation task when each check remains independently scoped and fail-closed.
- Prescription and treatment/generic order checks should prefer current `medicalmodv2` Request_Number `01` / class `01` coverage when the inventory proves that is the authoritative route.
- `subjectivesv2`, `diseasev3`, and Request_Number `02` / `03` / `04` remain separate endpoint-specific live scopes; do not execute them until their wrapper, parser, success criteria, and approval record are present.

Exit criteria:

- Each approved mutation check has sanitized L3 business acceptance evidence or an endpoint-specific sanitized blocker.
- The roadmap claim boundary is updated after each accepted, rejected, blocked, skipped, or not-run check.

### RWO-08B: Safe Fullflow Reachability Batch

Scope:

- After endpoint-level reachability is complete enough for the release claim, run safe fullflow checks without screenshots, HAR, traces, videos, raw network dumps, request XML, raw request bodies, or raw response bodies.
- Multiple fullflow variants may run in one automation task only if the safe fullflow harness enforces artifact-free evidence for every variant.

Exit criteria:

- Each fullflow variant has sanitized L4 evidence or a sanitized blocker.
- Fullflow evidence is not used to claim production ORCA or S3/object-storage readiness.

### RWO-06E: Exhaustive Order Item Matrix

Scope:

- Expand reachability inventory from major workflows to the current app's clinical document surface plus all ORCA-sendable order entities and Claim007 class-code families.
- Separate already accepted endpoint-specific payload identities from unverified class families.
- Treat `文書料` as local-only `otherOrder` unless a business mapping to a sendable charge class is explicitly approved.

Exit criteria:

- A sanitized matrix exists and marks each surface as accepted, queued, fail-closed, blocked, or not applicable.
- `文書`, `指導料`, tests, treatments, injections, charges, surgery, radiology, and local-only rows are all explicitly represented.

### RWO-06F: Instruction Charge Trial Reachability

Scope:

- Define and verify the first `instractionChargeOrder` / `指導料` safe payload identity, starting with Claim007 class `130`.
- Proceed to live Trial only after no-live contract tests, sanitizer/parser tests, wrapper dry-run, readiness 2xx, and duplicate-live checkpointing pass.

Exit criteria:

- `instractionChargeOrder/130` has sanitized L3 business acceptance evidence or a sanitized endpoint-specific blocker.
- The matrix is updated without claiming all `指導料` variants or all order items.

Checkpoint:

- RUN_ID `20260424T044803Z` added the `instruction-charge` workflow, class `130` payload identity, no-live tests, and dry-run evidence.
- The single v1 live Trial attempt reached readiness HTTP `200` / `200` and executed once, but ORCA Trial classified the request as `businessRejected`.
- Do not repeat the v1 checkpoint. Continue with sanitized v2 candidate investigation or classify the row as pending business/Trial data decision.

## Claim Boundary

This plan allows adding and batching reachability verification tasks. It does not by itself claim that prescription, treatment/generic orders, SOAP, disease CRUD, Request_Number `02` / `03` / `04`, or fullflow are verified through ORCA Trial.

Successful future checks must be recorded endpoint by endpoint in the release gate matrix and functional claims boundary.

## RWO-06D medicalmodv2 Checkpoint

RUN_ID `20260424T031608Z` completed the first endpoint-specific mutation batch for `medicalmodv2`:

- Prescription active v2 identity: `medicalmodv2_prescription_trial_reachability_v2.json`, SHA-256 `9146d2ba3cbc5f037ba90c9620a50a36f5c1696de0d4cd36dc2b6fc6d5f876b7`, duplicate-live checkpoint `rwo06d:medicalmodv2:rwo06d-prescription-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-9146d2ba3cbc5f037ba90c9620a50a36f5c1696de0d4cd36dc2b6fc6d5f876b7`, live `businessAccepted`.
- Representative treatment/generic active v2 identity: `medicalmodv2_treatment_generic_trial_reachability_v2.json`, SHA-256 `89885a031fa98c95a5fc4758dbac55f4375167178edb12fc9a78e9817a16fe7c`, duplicate-live checkpoint `rwo06d:medicalmodv2:rwo06d-treatment-generic-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-89885a031fa98c95a5fc4758dbac55f4375167178edb12fc9a78e9817a16fe7c`, live `businessAccepted`.
- Evidence: [../rwo06d-medicalmodv2-endpoint-wrapper-prep-20260424T031608Z/FINAL_REPORT.md](../rwo06d-medicalmodv2-endpoint-wrapper-prep-20260424T031608Z/FINAL_REPORT.md).

Do not repeat these accepted checkpoint identities in hourly automation. They are L3 endpoint-specific Trial evidence only, not broad order-matrix, fullflow, production ORCA, or S3/object-storage readiness evidence.

## RWO-06E Order Item Matrix Checkpoint

RUN_ID `20260424T044007Z` created the exhaustive static matrix:

- Evidence: [../rwo06e-order-item-reachability-matrix-20260424T044007Z/ORDER_ITEM_TRIAL_REACHABILITY_MATRIX.md](../rwo06e-order-item-reachability-matrix-20260424T044007Z/ORDER_ITEM_TRIAL_REACHABILITY_MATRIX.md).
- Current accepted live rows remain `medOrder/212` and `treatmentOrder/400` only.
- `instractionChargeOrder` / `指導料`, `baseChargeOrder`, `injectionOrder`, `surgeryOrder`, `testOrder`, and `radiologyOrder` remain queued for endpoint-specific safe payload work.
- Clinical documents are not ORCA order mutation evidence; `文書料` currently maps to local-only `otherOrder` / `LOCAL_OTHER:*` and remains fail-closed unless a business mapping is approved.

## RWO-06B Inventory Checkpoint

RUN_ID `20260424T030710Z` completed the first static inventory:

- Prescription and representative treatment/generic order send paths map to the existing official `medicalmodv2` route, but endpoint-specific payload identities and duplicate-live checkpoints are still required before new RWO-06D live claims.
- SOAP remains local-only through `/api/local/charts/subjectives`; `subjectivesv2` is blocked pending a safe wrapper/parser/success criteria and business-scope record.
- Disease CRUD remains local-only through `/api/local/diagnoses`; disease master candidate read is not a substitute for `diseasev3` CRUD reachability.
- Request_Number `02` / `03` / `04` remain RWO-07 only, and fullflow remains blocked behind artifact-free harness hardening.
