# 03. Repo Touchpoint Plan

## server touchpoints
### C1/C2 primary
- `server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaHttpClient.java`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java`
- `server-modernized/src/main/java/open/dolphin/rest/OrcaGatewayExceptionMapper.java`
- `server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionTestSupport.java`

### likely tests
- `server-modernized/src/test/java/open/dolphin/orca/config/OrcaConnectionConfigStoreTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaTransportRegistryTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/OrcaGatewayExceptionMapperTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionTestSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java` or equivalent

## charts touchpoints
### C3/C4 primary
- `web-client/src/features/charts/orcaClaimSendCache.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/print/useOrcaReportPrint.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/DocumentTimeline.tsx`

### likely tests
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`
- `web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts`
- `web-client/src/features/charts/__tests__/chartsActionBar.test.tsx`
- `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
- 新規 multi-encounter / multi-reception overlay regression tests

## patients touchpoints
### C5 primary
- `web-client/src/features/patients/api.ts`
- `web-client/src/features/patients/PatientsPage.tsx`
- `web-client/src/features/charts/PatientInfoEditDialog.tsx`
- `web-client/src/features/outpatient/orcaPatientImportApi.ts`

### likely tests
- `web-client/src/features/patients/__tests__/api.test.ts`
- `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`
- `web-client/src/features/charts/__tests__/PatientInfoEditDialog.test.tsx`
- `web-client/src/features/outpatient/__tests__/orcaPatientImportApi.test.ts`

## docs / QA touchpoints
### C6/C7 primary
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/qa-fullflow-weborca.mjs`
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`

## guard touchpoints to keep green
### reception
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx`
- `web-client/src/features/reception/__tests__/receptionHandoff.test.ts`

### administration / manageusers
- `web-client/src/features/administration/**`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserResource.java`
- related tests

## hotspot ownership rule
- `OrcaSummary.tsx` は SA-02 owner
- `OrcaSummary.semantics.test.tsx` は SA-04 owner。必要なら SA-02 merge 後に追従 rebase する
- `PatientsPage.tsx` と `PatientInfoEditDialog.tsx` は SA-03 owner
- `release-validation.md` と `orca-remediation-cutover.md` は SA-04 owner
