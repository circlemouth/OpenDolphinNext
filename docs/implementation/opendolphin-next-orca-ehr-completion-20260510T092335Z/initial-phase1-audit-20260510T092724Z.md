# Initial Phase 1 Audit

- RUN_ID: `20260510T092724Z`
- Branch: `master`
- Worktree start state: clean
- Scope: checklist Phase 1 source-of-truth boundary audit

## Target Assets

- ORCA正本領域: patient, diagnosis, acceptance, insurance, medical, billing, receipt/report.
- OpenDolphinNext正本領域: chart document/revision, SOAP, prescription/order record, local workflow state, audit event.
- Trust boundaries: browser request payloads, local persistence, ORCA transport, admin/debug wrappers, test/MSW fixtures, docs route taxonomy.

## Findings

### Local Patient Mutation

`/api/local/patients/mutation` is still present as an active local mutation surface.

- Server DTOs: `api-contract/src/main/java/open/dolphin/rest/dto/orca/LocalPatientMutationRequest.java`, `LocalPatientMutationResponse.java`
- Server resource: `server-modernized/src/main/java/open/dolphin/rest/orca/LocalPatientMutationResource.java`
- Route registration: `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- Admin capability label: `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaCapabilitiesResource.java`
- Web admin client: `web-client/src/features/administration/orcaInternalWrapperApi.ts`, `AdministrationPage.tsx`
- Tests/fixtures: `server-modernized/src/test/java/open/dolphin/rest/orca/LocalPatientMutationResourceIdempotencyTest.java`, `web-client/src/mocks/handlers/outpatient.ts`
- Contract docs: `docs/contracts/orca-route-taxonomy.md`

Checklist impact:

- Phase 1 local patient CRUD removal is not complete.
- Contract docs currently describe this as a local-only surface, which conflicts with the new EHR checklist requirement that patient create/update goes through ORCA `patientmodv2` server adapter only.

### Local Diagnosis Mutation

`/api/local/diagnoses` and legacy `RegisteredDiagnosisModel` remain active.

- Server resource: `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java`
- Web client API: `web-client/src/features/charts/diseaseApi.ts`
- HTTP wrapper metadata: `web-client/src/libs/http/httpClient.ts`
- Legacy entity/table: `persistence/src/main/java/open/dolphin/infomodel/RegisteredDiagnosisModel.java`, table `d_diagnosis`
- ORCA read support still maps to `RegisteredDiagnosisModel`: `server-modernized/src/main/java/open/orca/rest/OrcaDiseaseQuerySupport.java`
- Services and summaries still query or persist `RegisteredDiagnosisModel`: `KarteDiagnosisService`, `KarteServiceBean`, `LocalMedicalSummaryService`, `OutpatientProjectionService`, `ChartEventServiceBean`
- Existing diagnosis coding tables exist under `V0313__diagnosis_coding_tables.sql`, but the local CRUD boundary remains.

Checklist impact:

- Phase 1 local diagnosis CRUD removal is not complete.
- The current design has an insurance-local authoring route and ORCA mirror separation; the new EHR checklist requires replacing this with ORCA `diseasegetv2` cache/snapshot/operation/audit separation and `diseasev3` mutation.

### Raw ORCA Paths / Proxy Surface

No direct evidence was found in the initial grep that Vite is proxying raw ORCA paths as production client behavior. Raw native ORCA paths such as `/api01rv2/*`, `/api21/medicalmodv2`, and `/orca22/diseasev3` are primarily present in server ORCA endpoint definitions, QA scripts, tests, and implementation evidence.

One grep command returned exit code 2 because `config/` does not exist in this repository root; the useful results from existing roots still showed server-side ORCA endpoint constants and QA/test references.

Checklist impact:

- Continue with a narrower follow-up check against `web-client/vite.config.*`, `web-client/plugins/`, `web-client/scripts/verify-no-blocked-orca-route-strings.mjs`, and `web-client/src` before marking raw proxy removal complete.

### Finalized Chart Direct Update

The chart write layer already has partial protection.

- `KarteDocumentWriteService` rejects finalized update and has `karte.document.finalized_update_denied`.
- `KarteServiceBean.updateTitle` delegates to `KarteDocumentWriteService.updateTitle`.
- `KarteDocumentWriteResource` exposes title update, so the next task must verify whether title update is denied after `FINAL` and whether the denial is covered by focused tests.
- Document integrity support already stores `content_hash` and reports `content_hash_mismatch`.

Checklist impact:

- The direct finalized update path appears partially mitigated, but checklist completion requires verifying title direct update, SOAP/module updates, amendment/addendum/cancel event model, and content hash behavior together.

## Misuse Cases For First Implementation Slice

- A client calls `/api/local/patients/mutation` to create or update a patient that should only be authoritative in ORCA, then the UI treats the local row as current patient truth.
- A user edits `/api/local/diagnoses` and the chart UI displays it as `ORCA登録病名` without a successful `diseasev3` send and `diseasegetv2` re-fetch.
- A finalized chart title/body is changed through a narrow direct update route, bypassing revision/amendment history and content hash verification.

## Recommended Next Slice

Start with local patient mutation because it has a smaller surface than diagnosis and directly conflicts with the checklist.

1. Replace admin/internal display and route taxonomy to mark `/api/local/patients/mutation` as deprecated/blocked.
2. Remove or fail-close `LocalPatientMutationResource` from production route registration.
3. Keep official `patientmodv2` create/update/import routes as the only patient mutation path.
4. Update web admin wrapper tests and route inventory tests to expect the local patient mutation route to be absent or blocked.
5. Run focused server route inventory and patient official/local boundary tests, then `web-client` guard.
