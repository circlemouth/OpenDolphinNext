# ORCA Trial Reachability Expansion Plan

RUN_ID: `20260424T025733Z`

## Purpose

Owner request: add roadmap tasks to verify every currently unverified WebORCA / ORCA Trial reachability path for major chart workflows.

This plan expands the existing Trial-backed, non-S3 roadmap. It does not claim that these paths are already verified, and it does not authorize production ORCA, S3/MinIO/object-storage setup, committing/packaging raw diagnostic artifacts, or broad release readiness claims.

Owner direction recorded on 2026-04-24 updates the scope:

- Existing broad browser/fullflow harnesses may run even if they create screenshots, HAR, traces, videos, or raw network artifacts, provided those artifacts remain local-only, untracked, and excluded from reviewer packets.
- `diseasev3` create/update/delete verification should proceed through endpoint-specific wrappers, parser/sanitizer checks, duplicate-live checkpoints, and sanitized business-success criteria.
- All electronic-chart operations that a user can perform, including update/delete/cancel-like operations that map to Request_Number `02` / `03` / `04` or equivalent semantics, must be inventoried and tested where safe.
- Trial-rejected `medicalmodv2` order-family v1 payloads should be followed by source-backed v2 candidate research using official/public web sources plus no-live contract checks before any live retry.

## Batch Automation Rule

One automation run may execute multiple ORCA Trial reachability checks when all of the following are true:

- Each check has its own endpoint/request-class scope, target, preflight, wrapper, expected sanitized business-success criteria, and evidence directory.
- Checks run sequentially, not as blind parallel live mutations.
- A failure in one check is recorded as an endpoint-specific sanitized blocker and does not prevent the same run from continuing to independent safe checks.
- Each live mutation check is preceded by focused no-live validation and a wrapper dry-run.
- The run stops before any check that would require committing/packaging raw ORCA request/response bodies, raw patient or insurance details, credential capture, diagnostic screenshot/HAR/trace/video/raw-network artifacts, production ORCA, or S3/object-storage configuration.
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
| L4 | Browser fullflow reaches the intended Trial endpoint through the web-client and server. | Sanitized fullflow summary, route/status classification, hashes, and diagnostic artifact manifest when local-only diagnostic artifacts are used. |

## Unverified Reachability Targets

| Functional area | Current evidence | Missing Trial reachability | Planned level |
|---|---|---|---|
| Clinical documents / document fee | Document save/output has local/server/component/static evidence. `文書料` examples are currently `otherOrder` / `LOCAL_OTHER:*`. | Document save/output is not ORCA order mutation evidence. `文書料` billing requires an explicit mapping to a sendable charge class before Trial mutation. | Local/browser/fullflow for documents; L0 first for any future document-fee ORCA mapping. |
| Prescription | No-live browser/local persistence and selected server/local contract evidence. One scoped `medicalmodv2` Trial acceptance exists but is not broad prescription coverage. | Prescription-specific ORCA Trial reachability through the current order-send path. | L0-L3 first; L4 through artifact-free or diagnostic fullflow. |
| Injection | Local/static entity support exists. | Representative injection class-family Trial reachability. | L0-L3 after payload contract and safe wrapper readiness. |
| Treatment / generic orders | Representative treatment UI create/readback/update/delete and local contract evidence. One scoped `medicalmodv2` Trial acceptance exists but is not broad order-class coverage. | Representative non-drug treatment/generic order ORCA Trial reachability. | L0-L3 first; L4 through artifact-free or diagnostic fullflow. |
| Guidance / management fees (`指導料`) | UI/server entity exists as `instractionChargeOrder`; static tests include management-fee examples. | Representative `instractionChargeOrder` Trial reachability, starting with class `130`, then `132/133/140/141/142/143/148/149` if needed. | L0-L3 after payload contract and safe wrapper readiness. |
| Base charge | UI/server entity exists as `baseChargeOrder`. | Representative `baseChargeOrder` Trial reachability for `110/114/120/124` as required by claim. | L0-L3 after payload contract and safe wrapper readiness. |
| Tests / radiology / surgery | UI/server entities exist for `testOrder`, `radiologyOrder`, and `surgeryOrder`. | Representative Trial reachability by class family. | L0-L3 after payload contract and safe wrapper readiness. |
| SOAP | No-live local subjectives/SOAP save evidence. | `subjectivesv2` or current authoritative SOAP ORCA endpoint reachability. | L0-L2/L3 after endpoint-specific safety approval and wrapper readiness. |
| Disease CRUD | No-live local diagnoses/disease CRUD evidence and ORCA mirror read-only UI behavior. | `diseasev3` create/update/delete reachability and business success classification. | L0-L3 with endpoint-specific wrapper, parser, duplicate-live checkpoints, and sanitized evidence. |
| Request_Number `02` / `03` / `04` | Previously not verified. | Every user-actionable electronic-chart operation that maps to update/delete/cancel-like semantics. | RWO-07 operation inventory plus endpoint-specific wrappers and success criteria. |
| Browser fullflow | Explicitly `not_run`. | End-to-end web-client to server-modernized to ORCA Trial evidence. | L4 through artifact-free or owner-approved diagnostic fullflow mode. |

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
- No raw bodies, credentials, patient/insurance details, or diagnostic artifacts are committed/packaged.

### RWO-06D: Endpoint-Specific Trial Mutation Reachability Batch

Scope:

- Run endpoint-specific live Trial mutation checks only after RWO-06B/RWO-06C prerequisites, focused no-live validation, wrapper dry-run, status-only readiness 2xx, and endpoint-specific safety approval are present.
- Multiple live checks may run in one automation task when each check remains independently scoped and fail-closed.
- Prescription and treatment/generic order checks should prefer current `medicalmodv2` Request_Number `01` / class `01` coverage when the inventory proves that is the authoritative route.
- `subjectivesv2`, `diseasev3`, and Request_Number `02` / `03` / `04` remain separate endpoint-specific live scopes; execute them only after their wrapper, parser, success criteria, and duplicate-live checkpoint are present. Owner direction now explicitly asks `diseasev3` and user-actionable Request_Number `02` / `03` / `04` paths to be advanced.

Exit criteria:

- Each approved mutation check has sanitized L3 business acceptance evidence or an endpoint-specific sanitized blocker.
- The roadmap claim boundary is updated after each accepted, rejected, blocked, skipped, or not-run check.

### RWO-08B: Fullflow Reachability Batch

Scope:

- After endpoint-level reachability is complete enough for the release claim, run fullflow checks through artifact-free mode or owner-approved diagnostic mode.
- Multiple fullflow variants may run in one automation task when diagnostic artifacts remain local-only/untracked and committed evidence is limited to sanitized extracted summaries.

Exit criteria:

- Each fullflow variant has sanitized L4 evidence, diagnostic artifact manifest when applicable, or a sanitized blocker.
- Fullflow evidence is not used to claim production ORCA or S3/object-storage readiness.

### RWO-07: User-Actionable Operation / Request_Number Coverage

Scope:

- Inventory all electronic-chart operations users can perform for accepted and queued clinical surfaces: create, edit/update, delete/remove, cancel/undo, copy/reorder, finish/send, and billing/claim finalization where present.
- Map each operation to ORCA endpoint, Request_Number or equivalent operation selector, payload identity, target policy, expected idempotency/duplicate-live checkpoint, and endpoint-specific business-success criteria.
- Execute Request_Number `02` / `03` / `04` or equivalent paths only after no-live contract tests, parser/sanitizer tests, wrapper dry-run, readiness 2xx, and a duplicate-live checkpoint.

Exit criteria:

- Every user-actionable operation is `live_accepted`, `business_rejected`, `blocked`, `queued`, or `not_applicable` with a reason.
- No operation is excluded merely because it is update/delete/cancel-like.
- No broad operation-family claim is made from a single representative row.

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
- RUN_ID `20260424T050223Z` classified class `130` as pending business/Trial data decision because repo-local sanitized evidence did not justify a v2 candidate.
- Do not repeat the v1 checkpoint. Next automation should use web-researched official/public sources and local no-live contract checks to propose a justified v2 candidate before any live retry.

### RWO-06G: Base Charge Trial Reachability

Scope:

- Verify the next independent order family: `baseChargeOrder` / `基本診療料` / Claim007 class `110`.
- Proceed to live Trial only after no-live contract tests, sanitizer/parser tests, wrapper dry-run, readiness 2xx, and duplicate-live checkpointing pass.

Checkpoint:

- RUN_ID `20260424T050223Z` added the `base-charge` workflow, payload `medicalmodv2_base_charge_trial_reachability_v1.json`, SHA-256 `d2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93`, and a passing wrapper dry-run.
- The single v1 live Trial attempt reached readiness HTTP `200` / `200` and executed once, but ORCA Trial classified the request as `businessRejected`.
- Do not repeat the v1 checkpoint. Use web-researched official/public sources and local no-live contract checks to propose a justified base-charge v2 candidate before any live retry.

### RWO-06H: Injection Trial Reachability

Scope:

- Verify the next independent order family: `injectionOrder` / `注射` / Claim007 class `310`.
- Proceed to live Trial only after no-live contract tests, sanitizer/parser tests, wrapper dry-run, readiness 2xx, and duplicate-live checkpointing pass.

Checkpoint:

- RUN_ID `20260424T052654Z` added the `injection` workflow, payload `medicalmodv2_injection_trial_reachability_v1.json`, SHA-256 `c01169729cb86d1c68211e4b01f6c38bf3dde0ac948100c53855ec91f1b9010e`, and a passing wrapper dry-run.
- The single v1 live Trial attempt reached readiness HTTP `200` / `200` and executed once, but ORCA Trial classified the request as `businessRejected`.
- Do not repeat the v1 checkpoint. Use web-researched official/public sources and local no-live contract checks to propose a justified injection v2 candidate before any live retry.

### RWO-06I: Surgery Trial Reachability

Scope:

- Verify the next independent order family: `surgeryOrder` / `手術` / Claim007 class `500`.
- Proceed to live Trial only after no-live contract tests, sanitizer/parser tests, wrapper dry-run, readiness 2xx, and duplicate-live checkpointing pass.

Checkpoint:

- RUN_ID `20260424T055036Z` added the `surgery` workflow, payload `medicalmodv2_surgery_trial_reachability_v1.json`, SHA-256 `23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000`, and a passing wrapper dry-run.
- The single v1 live Trial attempt reached readiness HTTP `200` / `200` and executed once, but ORCA Trial classified the request as `businessRejected`.
- Do not repeat the v1 checkpoint. Use web-researched official/public sources and local no-live contract checks to propose a justified surgery v2 candidate before any live retry.
- RUN_ID `20260425T010143Z` added source-backed v2 payload `medicalmodv2_surgery_trial_reachability_v2.json`, SHA-256 `f7fbb890b62b7211b47c2672e85f0e70acbcdee18c9cbe9d7ea24c7942bbaa0e`, using surgery code `150003110`. The safe wrapper dry-run and focused contract test passed with no live ORCA execution.

### RWO-06J: Test Order Trial Reachability

Scope:

- Verify the next independent order family: `testOrder` / `検査` / Claim007 class `600`.
- Proceed to live Trial only after no-live contract tests, sanitizer/parser tests, wrapper dry-run, readiness 2xx, and duplicate-live checkpointing pass.

Checkpoint:

- RUN_ID `20260424T055036Z` added the `test-order` workflow, payload `medicalmodv2_test_order_trial_reachability_v1.json`, SHA-256 `b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2`, and a passing wrapper dry-run.
- The single v1 live Trial attempt reached readiness HTTP `200` / `200` and executed once, but ORCA Trial classified the request as `businessRejected`.
- Do not repeat the v1 checkpoint. Use web-researched official/public sources and local no-live contract checks to propose a justified test-order v2 candidate before any live retry.

### RWO-06K: Radiology Trial Reachability

Scope:

- Verify the next independent order family: `radiologyOrder` / `画像診断` / Claim007 class `700`.
- Proceed to live Trial only after no-live contract tests, sanitizer/parser tests, wrapper dry-run, readiness 2xx, and duplicate-live checkpointing pass.

Checkpoint:

- RUN_ID `20260424T061549Z` added the `radiology` workflow, payload `medicalmodv2_radiology_trial_reachability_v1.json`, SHA-256 `d4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e`, and a passing wrapper dry-run.
- The single v1 live Trial attempt reached readiness HTTP `200` / `200` and executed once, but ORCA Trial classified the request as `businessRejected`.
- Do not repeat the v1 checkpoint. Use web-researched official/public sources and local no-live contract checks to propose a justified radiology v2 candidate before any live retry.
- RUN_ID `20260424T225533Z` added source-backed v2 payload `medicalmodv2_radiology_trial_reachability_v2.json`, SHA-256 `ba41ca8d029b362d197361def1653a334ea27032935a6979298548465df4d436`, using body-part code `002000099` and imaging fee code `170027910`. The safe wrapper dry-run and focused contract test passed with no live ORCA execution.
- RUN_ID `20260425T001701Z` advanced that v2 payload through one sanitized live Trial checkpoint. Runtime readiness was `200` / `200`, HTTP status was `200`, parsed API result was `80`, response classification was `businessRejected`, and `businessAccepted=false`. Do not repeat the unchanged v2 checkpoint without no-live investigation, a concrete repo-local fix or changed Trial/business precondition, focused no-live verification, and sanitized preflight.

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
- `instractionChargeOrder` / `指導料`, `baseChargeOrder`, `injectionOrder`, `surgeryOrder`, `testOrder`, and `radiologyOrder` each have one safely tested but Trial-rejected v1 identity.
- Clinical documents are not ORCA order mutation evidence; `文書料` currently maps to local-only `otherOrder` / `LOCAL_OTHER:*` and remains fail-closed unless a business mapping is approved.

## RWO-06B Inventory Checkpoint

RUN_ID `20260424T030710Z` completed the first static inventory:

- Prescription and representative treatment/generic order send paths map to the existing official `medicalmodv2` route, but endpoint-specific payload identities and duplicate-live checkpoints are still required before new RWO-06D live claims.
- SOAP remains local-only through `/api/local/charts/subjectives`; RUN_ID `20260424T080121Z` prepared the no-live `subjectivesv2` live-readiness identity, but live SOAP Trial reachability is still unverified until a future exact-checkpoint prompt runs and parses a successful live result.
- Disease CRUD remains local-only through `/api/local/diagnoses`; disease master candidate read is not a substitute for `diseasev3` CRUD reachability. RUN_ID `20260424T090051Z` prepared the no-live `diseasev3` create-only live-readiness identity. Owner direction now asks automation to advance `diseasev3` create and then update/delete through endpoint-specific checkpoints.
- Request_Number `02` / `03` / `04` are now mandatory RWO-07 coverage for all user-actionable electronic-chart operations where they apply. Fullflow may proceed through artifact-free or owner-approved diagnostic mode.
