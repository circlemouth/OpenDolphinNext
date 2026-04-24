# RWO-06B SOAP / Disease Safe Wrapper Prep

RUN_ID: `20260424T063100Z`

## Scope

This is a no-live blocker-resolution record for SOAP `subjectivesv2` and disease CRUD `diseasev3`.

No WebORCA Trial mutation, production ORCA execution, S3/MinIO/object-storage setup, fullflow, browser screenshots, HAR, traces, videos, raw network dumps, raw ORCA request/response bodies, raw patient or insurance details, or legacy `client/` / `server/` changes were used.

## Current Product Paths

| Surface | Current UI path | Current server path | ORCA endpoint inventory | Current Trial reachability status |
|---|---|---|---|---|
| SOAP local note | `web-client/src/features/charts/soap/subjectiveChartApi.ts` posts to `/api/local/charts/subjectives` | `server-modernized/src/main/java/open/dolphin/rest/orca/LocalChartSubjectiveResource.java` persists local `DocumentModel`/`ProgressCourse` and audits `LOCAL_CHART_SUBJECTIVES_MUTATION` | `OrcaEndpoint.SUBJECTIVES_MOD` maps to `/orca25/subjectivesv2`; stub exists at `server-modernized/src/test/resources/orca/stub/64_subjectivesv2_response.sample.xml` | `blocked_no_live_wrapper_business_scope_missing` |
| Disease insurance-local CRUD | `web-client/src/features/charts/diseaseApi.ts` reads/mutates `/api/local/diagnoses`; disease master candidate lookup is `/api/orca/official/disease-master/name/...` | `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java` persists local `RegisteredDiagnosisModel` rows and rejects non-local/candidate authoring | `OrcaEndpoint.DISEASE_MOD_V3` maps to `/orca22/diseasev3`; stub exists at `server-modernized/src/test/resources/orca/stub/57_diseasev3_response.sample.xml` | `blocked_no_live_wrapper_business_scope_missing` |

The native-intent payloads exist only as inert design inputs:

| Payload | SHA-256 | Status |
|---|---|---|
| `web-client/qa/payloads/phase4/subjectivesv2_phase4_dummy_native_intent_v1.json` | `9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308` | `non_executable_until_subjectivesv2_safe_wrapper_exists` |
| `web-client/qa/payloads/phase4/diseasev3_phase4_dummy_native_intent_v1.json` | `da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df` | `non_executable_until_diseasev3_safe_wrapper_exists` |

## Trust Boundary

The safe wrappers must treat browser state, local SOAP/disease UI fields, dummy JSON payloads, and local diagnosis identifiers as untrusted inputs. The server-side wrapper must resolve or verify the Trial target, facility, authenticated actor, allowed endpoint, allowed request semantics, and any patient/insurance context from server-controlled runtime state and endpoint-specific allowlists.

The current local routes are authoritative only for the local product behavior they already implement. They are not ORCA Trial mutation evidence and must not be promoted to ORCA readiness claims.

## Required Safe Wrapper Properties

| Requirement | `subjectivesv2` | `diseasev3` |
|---|---|---|
| Target control | Allow only WebORCA Trial target `00001` until a later owner-approved target set exists. | Same. |
| Endpoint control | Hard-code `/api/orca/official/...` wrapper path to `OrcaEndpoint.SUBJECTIVES_MOD` and ORCA `/orca25/subjectivesv2`; reject arbitrary endpoint/path input. | Hard-code wrapper path to `OrcaEndpoint.DISEASE_MOD_V3` and ORCA `/orca22/diseasev3`; reject arbitrary endpoint/path input. |
| Request semantics | Define whether this is create/register only and whether a request number/class parameter is valid for this endpoint before any live run. | Explicitly define create/update/delete Request_Number mapping. `02` / `03` / `04` remain forbidden by this prompt and require separate approval. |
| Payload source | Build XML/server payload from a narrow allowlisted JSON contract; do not pass through arbitrary client XML or raw native payloads. | Same; reject candidate-only and ORCA mirror rows as authoring sources. |
| Sanitized evidence | Store only status, endpoint identity, payload SHA-256, field-presence booleans, parser classification, duplicate checkpoint, and allowlisted completion flags. | Same. |
| Parser contract | HTTP 2xx and `apiResult=00` alone are not success. Require endpoint-specific completion evidence. | Same, plus operation-specific completion evidence. |
| Duplicate-live checkpoint | Include request class, endpoint, target, request semantics, operation, and payload SHA-256. | Include operation (`create`/`update`/`delete`) and request number/class once approved. |
| Failure mode | Fail closed on target mismatch, endpoint drift, parser ambiguity, missing success fields, sensitive-message shape, or any raw artifact need. | Same. |

## Proposed Business Success Criteria

These are proposals only. They do not authorize live execution.

| Endpoint | Minimum success classification before any live claim |
|---|---|
| `subjectivesv2` | HTTP 2xx, `apiResult` zero-equivalent, no parser ambiguity, sanitized confirmation timestamp or equivalent endpoint completion marker present, target and perform-date fields match allowlist, and no sensitive message/raw detail needed to decide success. |
| `diseasev3` create | HTTP 2xx, `apiResult` zero-equivalent, no parser ambiguity, endpoint-specific completion marker present, sanitized registered-disease count or stable mutation-complete marker present, allowed disease code/category semantics verified, and no raw patient/insurance detail needed. |
| `diseasev3` update/delete | Not ready. Requires separate operation semantics and owner/business decision before wrapper approval; this prompt does not authorize Request_Number `02` / `03` / `04`. |

## Misuse Cases Checked

| Misuse case | Control / current classification |
|---|---|
| Treating inert native-intent JSON as executable live approval. | Both payloads are classified as non-executable until endpoint-specific wrappers, parser tests, and approval exist. |
| Treating local `/api/local/charts/subjectives` or `/api/local/diagnoses` success as ORCA Trial success. | Current routes are explicitly local-only evidence; ORCA Trial reachability remains blocked. |
| Running `diseasev3` update/delete or Request_Number `02` / `03` / `04` under the broad medicalmodv2 iterative approval. | Not authorized. Operation semantics and owner/business scope are still pending. |
| Capturing raw ORCA XML/body or patient/insurance details to infer success. | Stop condition remains raw artifact needed; wrapper must decide from allowlisted parsed fields only. |

## Next Safe Step

Create endpoint-specific no-live wrapper libraries and contract tests:

1. `subjectivesv2` safe evidence module and CLI wrapper with dry-run/mock only.
2. `diseasev3` safe evidence module and CLI wrapper with dry-run/mock only.
3. Parser/sanitizer tests using checked-in stub responses, asserting no raw body, no sensitive text, no Request_Number `02` / `03` / `04`, and fail-closed target/endpoint drift behavior.
4. Only after those pass, a later handoff may request endpoint-specific live approval for exactly one endpoint identity.

## Claim Boundary

This prep record does not claim SOAP `subjectivesv2` Trial reachability, disease `diseasev3` Trial reachability, disease CRUD acceptance, Request_Number `02` / `03` / `04`, fullflow, production ORCA readiness, S3/object-storage readiness, broad clinical release readiness, or final release GO.

Credentials captured: `false`

Raw artifacts captured: `false`
