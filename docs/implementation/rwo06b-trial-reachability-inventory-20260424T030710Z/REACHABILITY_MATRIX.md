# RWO-06B Trial Reachability Inventory

RUN_ID: `20260424T030710Z`

## Scope

This is a sanitized static inventory only. It did not execute WebORCA Trial traffic, production ORCA traffic, browser fullflow, screenshots, HAR, traces, videos, raw network capture, raw ORCA request/response bodies, or S3/object-storage setup.

## Misuse Cases Checked

| Misuse case | Control in this inventory |
|---|---|
| Treating the accepted `medicalmodv2` dummy payload as broad prescription/order coverage. | Prescription and treatment/generic order entries remain separate endpoint/request-class/payload identities; existing acceptance is scoped only. |
| Executing SOAP `subjectivesv2` or disease `diseasev3` live because native-intent JSON files exist. | Both are classified as blocked until an endpoint-specific safe wrapper, parser, success criteria, and approval record exist. |
| Reusing local-only SOAP/disease routes as ORCA Trial success evidence. | Local routes are marked authoritative for current product behavior but not ORCA Trial reachability evidence. |

## Endpoint-Level Matrix

| Workflow | Authoritative current app route | Server route / ORCA API | Request class / number | Current status | Safe wrapper status | Business-success criteria before any live claim | Next safe action |
|---|---|---|---|---|---|---|---|
| Prescription order send | Web client `postOrcaMedicalModV2Xml` via `/api/orca/official/chart-support/medical-mod-v2` | `OrcaChartSupportResource.medicalModV2` to `OrcaEndpoint.MEDICAL_MOD` (`/api21/medicalmodv2`, query `class=01`) | `medicalmodv2`; Request_Number `01` only; API class `01` only | `no_live_verified_for_prescription_specific_payload`; one scoped `medicalmodv2` Trial acceptance exists but is not prescription-specific broad coverage | Generic Phase4 safe wrapper exists for `medicalmodv2`; prescription-specific payload identity and no-live contract are not yet defined | HTTP 2xx plus `apiResult=00` and endpoint-specific completion evidence such as information timestamp plus medical UID/invoice/data identifier, with parsed sanitized classification | Create prescription-specific `medicalmodv2` safe payload/wrapper contract test, dry-run it, then queue one RWO-06D live check only if readiness is 2xx |
| Treatment / generic order send | Web client `prepareMedicalModV2SendData` and ORCA send button via `/api/orca/official/chart-support/medical-mod-v2` | Same `medicalmodv2` official chart-support route to `/api21/medicalmodv2` | `medicalmodv2`; Request_Number `01` only; API class `01` only | `no_live_verified_for_representative_treatment_payload`; representative no-live browser/local evidence exists | Generic Phase4 safe wrapper exists; representative treatment/generic payload identity and duplicate-live checkpoint are not yet defined | Same as above, plus the payload identity must prove the intended order entity/class row set without raw item/patient details | Create representative treatment/generic `medicalmodv2` payload/wrapper contract test, dry-run it, then queue one RWO-06D live check only if non-duplicate and approved |
| SOAP local save | Web client `postChartSubjectiveEntry` to `/api/local/charts/subjectives` | `LocalChartSubjectiveResource`; no official ORCA SOAP wrapper in current app path | Current product route is local-only; `OrcaEndpoint.SUBJECTIVES_MOD` exists but has no safe official resource/wrapper | `local_only_verified_no_orca_trial_reachability` | Missing endpoint-specific safe wrapper/parser for `subjectivesv2`; native-intent payload is non-executable under current wrapper | Must not be claimed until `subjectivesv2` safe wrapper defines allowed class/request semantics, parsed success fields, and no raw body policy | Block live SOAP Trial work; define wrapper and business scope first if owner keeps SOAP ORCA registration in release scope |
| Disease CRUD local save | Web client `mutateDiseases` to `/api/local/diagnoses` and disease master candidate lookup | `LocalDiagnosisResource` for CRUD; `OrcaLiveDiseaseMasterResource` only reads candidate disease master, not disease CRUD mutation | Local CRUD only; `OrcaEndpoint.DISEASE_MOD_V3` exists but no safe official CRUD resource/wrapper | `local_only_verified_no_diseasev3_trial_reachability`; disease master candidate read is not disease CRUD success | Missing endpoint-specific safe wrapper/parser for `diseasev3`; native-intent payload is non-executable under current wrapper | Must not be claimed until create/update/delete semantics, allowed Request_Number, target, parser, and sanitized completion fields are defined | Block live disease Trial work; define wrapper and business scope first if disease ORCA registration remains required |
| Request_Number `02` / `03` / `04` | None in current safe Phase4 path | Future endpoint-specific only | Explicitly forbidden by current automation prompt | `not_applicable_until_rwo07_approval` | No safe wrapper approval | Separate owner-approved RWO-07 scope and success criteria required | Do not execute |
| Fullflow | Existing fullflow harness writes forbidden artifacts | `qa-fullflow-weborca.mjs` currently captures request XML and browser artifacts | Not applicable | `blocked_by_unsafe_harness` | Safe fullflow wrapper missing | L4 summary only, no screenshots/HAR/traces/videos/raw request XML/raw bodies | Keep RWO-08B queued behind artifact-free fullflow harness hardening |

## RWO-06C / RWO-06D Checkpoint

- RWO-06C read-only batch: no workflow-specific read-only Trial probe is ready from this inventory. Disease master candidate lookup is read-only, but it is not disease CRUD reachability and must not be substituted for `diseasev3`.
- RWO-06D mutation batch: prescription and treatment/generic order can reuse the `medicalmodv2` route only after endpoint-specific payload identities, wrapper contract tests, dry-runs, readiness 2xx, duplicate-live checkpointing, and sanitized success criteria are in place.
- SOAP and disease mutation checks are blocked by missing endpoint-specific safe wrappers and business-scope confirmation.

## Claim Boundary

This inventory closes RWO-06B only. It does not establish new Trial business success, prescription Trial reachability, treatment/generic Trial reachability, SOAP `subjectivesv2` reachability, disease `diseasev3` reachability, fullflow success, production ORCA readiness, S3/object-storage readiness, or final release readiness.
