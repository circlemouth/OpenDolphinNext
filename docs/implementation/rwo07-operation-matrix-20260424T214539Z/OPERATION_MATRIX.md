# RWO-07 User-Actionable Operation Matrix

RUN_ID: `20260424T214539Z`

## Verdict

`RWO07_OPERATION_MATRIX_RECORDED_NEXT_ENDPOINT_TASK_QUEUED`

This is a sanitized operation inventory for electronic-chart actions that users can currently perform or initiate from the web client. It maps each action to the current local product route or official ORCA wrapper state, with Request_Number `02` / `03` / `04` applicability called out explicitly.

No live ORCA Trial action was executed in this run.

## Scope Boundary

- Trial-only roadmap scope: WebORCA / ORCA Trial only.
- Production ORCA: `not_applicable_trial_only`.
- S3 / MinIO / object storage: `not_applicable_out_of_scope`.
- Diagnostic artifacts: not captured.
- Raw ORCA bodies, credentials, cookies, sessions, patient details, and insurance details: not captured.

## Misuse Cases Checked

| Misuse case | Control recorded by this matrix |
|---|---|
| Treating local edit/delete as ORCA Request_Number `02` / `03` / `04` success | Every local-only mutation row is marked `queued` or `not_applicable_local_only`; no live success is inferred. |
| Reusing a create-only diseasev3 identity for update/delete | `diseasev3` create remains the only prepared identity; update/delete rows are blocked until endpoint-specific wrappers and payload identities exist. |
| Retrying rejected or accepted live mutations as broad operation coverage | Prior accepted `medicalmodv2` Request_Number `01` identities are listed as scoped create/send evidence only and are not extended to update/delete/cancel/copy. |
| Treating medication master search Request_Number `02` as a chart update/delete operation | It is separated as read-only lookup semantics, not mutation evidence. |

## Operation Matrix

| Surface | User action | Current product operation | Current route / component evidence | ORCA endpoint / selector mapping | RWO-07 status | Next safe action |
|---|---|---|---|---|---|---|
| Prescription order (`medOrder`) | Create/new prescription | `orderBundle` create | `OrderDockPanel` opens `medOrder` editor; `orderBundleApi` supports `operation=create`. | `medicalmodv2` Request_Number `01`, class `01`; scoped Trial `businessAccepted` already exists for the accepted prescription identity. | `live_accepted_scoped_create_only` | Do not repeat accepted identity; cover update/delete separately. |
| Prescription order (`medOrder`) | Edit/update existing prescription | `orderBundle` update | `OrderDockPanel` opens existing bundle with `kind=edit`; `orderBundleApi` supports `operation=update`. | Candidate equivalent is `medicalmodv2` update semantics, but no endpoint-specific Request_Number `02`/`03`/`04` wrapper identity exists. | `queued_rwo07_no_live_contract_missing` | Define payload identity, request-number semantics, parser/sanitizer success criteria, and duplicate checkpoint before live. |
| Prescription order (`medOrder`) | Delete/remove existing prescription | `orderBundle` delete | `OrderDockPanel` delete mutation and order-summary delete mutation call `operation=delete`. | Candidate equivalent is `medicalmodv2` delete/cancel semantics; current accepted Trial evidence does not cover this. | `queued_rwo07_no_live_contract_missing` | Define delete/cancel semantics and fail closed if official mapping cannot be proven. |
| Prescription order (`medOrder`) | Copy/reorder from prior prescription | UI `copy` opens new editable bundle | `OrderDockPanel` uses `kind=copy`; mutation remains a later create/update when saved. | Not a distinct ORCA Request_Number by itself; follow-on save/send maps to create or future update. | `not_applicable_ui_staging_only` | Verify browser/local behavior separately; ORCA evidence belongs to resulting save/send action. |
| Treatment / generic order (`treatmentOrder`) | Create/send representative treatment | `orderBundle` create | `OrderDockPanel` and `orderBundleApi` create path. | `medicalmodv2` Request_Number `01`, class `01`; scoped Trial `businessAccepted` already exists for representative treatment/generic identity. | `live_accepted_scoped_create_only` | Do not repeat accepted identity; keep as representative L3 only. |
| Treatment / generic order | Edit/update existing treatment | `orderBundle` update | `orderBundleApi` contract supports update; local tests exercise treatment update preservation. | Candidate equivalent is `medicalmodv2` update semantics; not live verified. | `queued_rwo07_no_live_contract_missing` | Define update payload and no-live contract before any Trial mutation. |
| Treatment / generic order | Delete/remove existing treatment | `orderBundle` delete | `OrderDockPanel` and `SoapNotePanel` order-summary delete paths. | Candidate equivalent is `medicalmodv2` delete/cancel semantics; not live verified. | `queued_rwo07_no_live_contract_missing` | Define deletion/cancel success criteria and duplicate-live checkpoint. |
| Guidance/base/injection/surgery/test/radiology order families | Create representative order | `orderBundle` create | Current catalogs and payloads exist; v1 live attempts for these families were `businessRejected`. | `medicalmodv2` Request_Number `01`, class family-specific Claim007 classes. | `queued_v2_no_live_verification` | Start with `testOrder/600` v2 candidate `160000310` from prior research; run no-live wrapper verification before live. |
| Guidance/base/injection/surgery/test/radiology order families | Edit/update representative order | `orderBundle` update | UI/API supports update locally, but no Trial update identity exists. | Candidate Request_Number `02`/`03`/`04` or equivalent is unknown per family. | `blocked_until_create_family_accepted_or_business_mapping_defined` | Do not test update/delete until representative create is accepted or official mapping is proven. |
| Guidance/base/injection/surgery/test/radiology order families | Delete/remove representative order | `orderBundle` delete | UI/API supports local delete, but no Trial delete identity exists. | Candidate delete/cancel semantics are unknown per family. | `blocked_until_create_family_accepted_or_business_mapping_defined` | Do not execute live delete/cancel without endpoint-specific mapping and rollback/duplicate strategy. |
| SOAP / subjectives | Create/save note | local SOAP save/update | `SoapNotePanel` local persistence; prior `subjectivesv2` live attempts ended HTTP `502` transportRejected and remain inconclusive. | `subjectivesv2`; current no-live contract uses create semantics and forbids repeating unchanged live retries. | `blocked_subjectivesv2_502_no_concrete_fix` | Do not retry live until a concrete repo-local fix or changed precondition is verified no-live. |
| SOAP / subjectives | Delete S/O/A/P section or note row | local SOAP delete | `SoapNotePanel` issues `operation=delete` for local SOAP rows. | No approved `subjectivesv2` Request_Number `02`/`03`/`04` mapping or wrapper identity. | `queued_rwo07_no_live_contract_missing` | Define official update/delete semantics only after subjectives create reachability blocker is resolved. |
| Disease (`insurance disease`) | Create disease | local disease create; prepared official wrapper identity | `DiagnosisEditPanel` / `diseaseApi` support create; prior diseasev3 no-live identity exists. | `diseasev3` create, `/orca22/diseasev3`, class `01`, Request_Number `01`; no live attempt yet. | `next_executable_endpoint_task` | Run existing `diseasev3` no-live dry-run and, if runtime prerequisites are available, a future scoped live create checkpoint. |
| Disease (`insurance disease`) | Edit/update disease | local disease update | `diseaseApi` supports `operation=update`; UI readback tests cover update locally. | Current server official route rejects non-`01` diseaseModV3 requestNumber and is create-only. | `blocked_create_only_server_contract` | Requires new endpoint-specific wrapper/payload identity and server support; do not reuse create identity. |
| Disease (`insurance disease`) | Delete/end disease | local disease delete | `DiagnosisEditPanel` delete mutation uses `operation=delete`. | Current `diseasev3` wrapper and server route are create-only; update/delete not authorized. | `blocked_create_only_server_contract` | Define official ORCA disease update/delete semantics separately after create evidence. |
| Medication/treatment master lookup | Search by input code or 9-digit code | read-only lookup | `orcaMedicationGetApi` supports Request_Number `01` and `02`; server validates code shape. | `/api/orca/official/chart-support/medication-get`, Request_Number `01` or `02`. | `not_applicable_readonly_lookup_not_chart_mutation` | Keep as read-only support evidence; do not count as update/delete/cancel. |
| Contraindication check | Check medication warnings | read-only/supporting validation | Server builds contraindication request with Request_Number default `01`. | ORCA contraindication endpoint, read-only/supporting check. | `not_applicable_readonly_supporting_check` | Keep separate from chart mutation coverage. |
| Document/report fee | Create/print document or fee-like row | local/report document create | Report document resource currently emits Request_Number `01`; prior matrix treats `文書料` as local-only `otherOrder`. | Not accepted ORCA chart mutation evidence. | `not_applicable_or_blocked_business_mapping_missing` | Requires explicit business mapping to sendable charge class before Trial mutation. |
| Encounter finish / ORCA send UI | Finish/send chart payload | composite browser action | Chart action buttons and queue/status views exist; L4 fullflow has not run under diagnostic exception. | Should route to accepted endpoint-specific identities only after prerequisites. | `queued_fullflow_diagnostic_or_artifact_free` | Inventory/run diagnostic fullflow only when local runtime prerequisites are available and artifacts stay untracked. |

## Next Executable Endpoint-Specific Task

The next concrete endpoint-specific task is `diseasev3` create:

| Field | Value |
|---|---|
| Workflow | `diseasev3` |
| Official server route | `POST /api/orca/official/chart-support/disease-mod-v3` |
| ORCA endpoint | `/orca22/diseasev3` |
| Target | Trial dummy target `00001` only |
| Operation | create only |
| Request selector | class `01`, Request_Number `01` only |
| Payload | `web-client/qa/payloads/phase4/diseasev3_phase4_dummy_native_intent_v1.json` |
| Payload SHA-256 | `da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df` |
| Duplicate-live checkpoint | `rwo06b:diseasev3:rwo06b-diseasev3-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df` |
| Current run action | no-live wrapper dry-run only |
| Business-success classification | `not_applicable_no_live_matrix_and_dry_run_only` |

Before live Trial execution, the worker must confirm current runtime readiness, duplicate-live checkpoint status, endpoint target identity, and sanitized evidence mode. HTTP 200, wrapper exit 0, dry-run success, and zero-equivalent `Api_Result` alone are not business success.

## Claim Boundary

This matrix claims only that RWO-07 user-actionable operations have been inventoried and the next executable endpoint-specific task is recorded. It does not claim Request_Number `02` / `03` / `04` Trial success, diseasev3 live success, SOAP/subjectivesv2 success, update/delete/cancel readiness, fullflow success, production ORCA readiness, S3/object-storage readiness, all-order readiness, or final release readiness.

