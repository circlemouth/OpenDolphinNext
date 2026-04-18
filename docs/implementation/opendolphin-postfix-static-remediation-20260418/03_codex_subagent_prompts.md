# 03 Codex subagent prompts

全サブエージェントは **gpt-5.4 high** で起動する。  
各サブエージェントは、直接 main branch に commit せず、調査結果・差分案・test proposal・risk を manager に返す。manager が最終統合する。

---

## Subagent A: C7 medicalInformation release gate

```text
あなたは OpenDolphinNext の C7 medicalInformation release gate remediation subagent です。gpt-5.4 high として作業してください。

Scope:
- `web-client/scripts/qa-lib/medical-information-gate.mjs`
- `web-client/scripts/__tests__/medicalInformationGate.test.ts`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/qa-fullflow-weborca.mjs`
- `web-client/src/features/reception/api.ts`
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx`
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`

Do not browse external sites. Do not run live WebORCA.

Problem:
The current gate treats `medicalInformation` / `Medical_Information` as violation only when value is a non-empty string. The release gate requires field presence itself to fail for unselected runs. `{"medicalInformation":""}` must fail. Also target mutation request count 0 must fail.

Required invariant:
- For unselected medical information run, any presence of `medicalInformation` or `Medical_Information` in target mutation request body fails, including empty string, null, false, object, array.
- For selected run, expected value must be present and match the selected code.
- The helper must fail when checked target mutation requests are 0.
- QA scripts must propagate helper failure and log checked request count.
- Docs must say field presence gate, not non-empty value gate.

Deliverables to manager:
1. Files needing edits and exact rationale.
2. Proposed diff or patch-ready instructions.
3. Negative tests to add:
   - unselected + `medicalInformation:""` fails
   - unselected + `Medical_Information:""` fails
   - unselected + `medicalInformation:null` fails
   - no target mutation request fails
   - selected expected code passes only when matching code present
4. Commands to run and expected evidence.
5. Any residual unknowns.

Do not claim dynamic success.
```

---

## Subagent B: C5 patient import success semantics

```text
あなたは OpenDolphinNext の C5 official patient import success semantics remediation subagent です。gpt-5.4 high として作業してください。

Scope:
- `web-client/src/features/outpatient/orcaPatientImportApi.ts`
- `web-client/src/features/outpatient/__tests__/orcaPatientImportApi.test.ts`
- `web-client/src/features/patients/PatientsPage.tsx`
- `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`
- `web-client/src/features/patients/api.ts`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/PatientImportResponse.java`
- `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientImportService.java`

Do not browse external sites. Do not run live WebORCA.

Problem:
Import summary extracts `skippedCount`, requested/fetched/created/updated counts, and errors count, but full-success gate effectively checks only `businessOk` and `errorsCount === 0`. Skipped-only and count-inconsistent responses can become `ok: true` if canonical readback passes.

Required invariant:
- Full success requires all of the following:
  - HTTP accepted path is successful.
  - ORCA business result is all-zero / accepted by existing parser.
  - `errorsCount === 0`.
  - `skippedCount === 0`.
  - Imported count equals expected business count. Use `createdCount + updatedCount` and compare with `fetchedCount` / `requestedCount` according to current contract fields. If the contract is ambiguous, fail safe and classify as partial, with a clear reason.
  - canonical readback succeeds for expected patient IDs.
- Any skipped-only or count inconsistency is `ok: false` with `writeAccepted: true` and `errorCategory: "business_partial"` or a more precise category if introduced consistently.
- UI success toast / audit success must rely on final `ok`, so skipped/count partial yields warning / 要確認.

Deliverables to manager:
1. Proposed full-success predicate and where it lives.
2. Tests to add:
   - `apiResult="00"`, `errors=[]`, `skippedCount>0` => not ok.
   - `apiResult="00"`, `errors=[]`, requested/fetched/imported inconsistent => not ok.
   - canonical readback failure remains not ok.
   - true all-success remains ok.
   - PatientsPage warning branch for skipped-only partial if current mock coverage does not already catch it.
3. Any backend contract/test changes required or not required.
4. Commands to run and expected evidence.
5. Residual unknowns.

Do not claim dynamic success.
```

---

## Subagent C: C3 charts row-local closure and print prefill

```text
あなたは OpenDolphinNext の C3 charts row-local false-positive remediation subagent です。gpt-5.4 high として作業してください。

Scope:
- `web-client/src/features/charts/orcaClaimSendCache.ts`
- `web-client/src/features/charts/DocumentTimeline.tsx`
- `web-client/src/features/charts/print/useOrcaReportPrint.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/orcaClaimSendCache.test.ts`
- `web-client/src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx`
- `web-client/src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx`
- relevant order panel tests

Do not browse external sites. Do not run live WebORCA.

Problem:
`DocumentTimeline` can select claim bundle/invoice by patientId fallback after appointment mismatch. Print can prefill invoice from latest income even when row-local send cache is absent. Component tests are mock-heavy and do not prove actual source + actual helper closure.

Required invariant:
- Positive invoice / send status / claim bundle for a chart row must come only from row-local key match: encounterKey, scheduleKey, receptionId, appointmentId according to current priority.
- PatientId-only or latest-income fallback may be used only as neutral context, never as positive send/invoice signal for current row.
- Print invoice prefill must not use latest income unless it is proven row-local for the selected encounter. If no row-local match, leave invoice blank / unresolved and surface neutral wording.
- Same-day multi-encounter negative tests must fail before fix and pass after fix.

Deliverables to manager:
1. Exact fallback paths to remove or downgrade.
2. Proposed source changes.
3. Tests to add:
   - Timeline appointment mismatch + same patient + other encounter invoice => current row does not show invoice.
   - selected invoice priority does not prefer patient fallback bundle.
   - print with latest income from other encounter and no row-local send entry => no invoice prefill.
   - actual helper + actual component wiring test, not only mocked helper.
4. Risk assessment for ReceptionPage uses of patient fallback; do not break unrelated prior PASS areas.
5. Commands to run and expected evidence.

Do not claim dynamic success.
```

---

## Subagent D: C1/C2/T-NEG transport security and sanitize

```text
あなたは OpenDolphinNext の C1/C2/T-NEG transport security remediation subagent です。gpt-5.4 high として作業してください。

Scope:
- `server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSecurityPolicy.java`
- `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaHttpClient.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionTestSupport.java`
- `server-modernized/src/test/java/open/dolphin/orca/config/OrcaConnectionConfigStoreTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaTransportRegistryTest.java`
- `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaHttpClientLogTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionTestSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java`

Do not browse external sites. Do not run live WebORCA.

Problems:
- C1: config store/admin default facility input layer does not reject `"default"` literal consistently, while transport rejects it.
- C2: userinfo in `serverUrl` is not explicitly rejected and admin config view can return raw userinfo URL.
- T-NEG: detail log and admin save failure payload/details lack direct rendered negative tests.

Required invariants:
- Facility ID `null`, blank, and case-insensitive `default` sentinel are rejected consistently in config store, admin parser, transport registry, readiness, and transport invoke.
- URL with userinfo is invalid at config validation time. It must not be normalized silently.
- Failure responses, audit details, readiness, mapper output, summary log, detail log, admin save failure body/details must not contain raw URL, userinfo, host, secret path, or credentials.
- `clientAuthConfigured` R-OBS-01 must remain preserved.

Deliverables to manager:
1. Proposed validation location and error categories/messages.
2. Tests to add:
   - save/update default facility id `default` rejected.
   - facility record id `default` rejected if applicable.
   - userinfo serverUrl rejected.
   - admin config view cannot persist/return userinfo URL because save is rejected.
   - admin save failure response/details sanitized.
   - detail log rendered string sanitized.
   - R-OBS tests still pass.
3. Commands to run and expected evidence.
4. Any docs contract drift to hand to Subagent E/G.

Do not claim dynamic success.
```

---

## Subagent E: RT-01 route taxonomy guard/docs

```text
あなたは OpenDolphinNext の RT-01 route taxonomy guard/docs remediation subagent です。gpt-5.4 high として作業してください。

Scope:
- `web-client/scripts/verify-no-blocked-orca-route-strings.mjs`
- `web-client/scripts/runtime-ready-smoke.mjs`
- `web-client/src/features/outpatient/orcaQueueApi.ts`
- `web-client/src/features/outpatient/__tests__/orcaQueueApi.test.ts`
- `web-client/src/mocks/handlers/orcaQueue.ts`
- `web-client/src/mocks/handlers/orcaQueue.test.ts`
- `web-client/src/libs/http/httpClient.test.ts`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `docs/contracts/orca-route-taxonomy.md`
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`

Do not browse external sites. Do not run live WebORCA.

Problem:
Production fail-close and server public surface are mostly positive, but static guard allowlist and docs/success message disagree. Guard allowlist permits queue/pushevent strings in mocks/tests/httpClient tests while docs imply only `orcaQueueApi.ts` fail-close sentinel.

Required invariant:
- Define exactly three categories:
  1. server public ORCA route surface: official/master only, no queue/pushevent.
  2. client production fail-close sentinel: allowed only where needed to return unavailable without network call.
  3. mock/test-only legacy route strings: either removed, renamed to non-public constants, or explicitly classified and guarded so they cannot be mistaken for public surface.
- Guard success message must match actual allowlist.
- Docs must match guard and runtime smoke.
- Runtime smoke remains: any browser network hit to blocked queue/pushevent is failure.

Deliverables to manager:
1. Proposed taxonomy wording.
2. Proposed guard allowlist tightening or explicit test-surface classification.
3. Tests/fixtures to update.
4. Docs to edit.
5. Command `npm run verify:web-guard` evidence plan.

Do not claim dynamic success.
```

---

## Subagent F: C6 DADS OrcaSummary visibility lock

```text
あなたは OpenDolphinNext の C6 DADS OrcaSummary visibility lock remediation subagent です。gpt-5.4 high として作業してください。

Scope:
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`
- `tests/charts/e2e-orca-billing-status.spec.ts`
- `tests/charts/e2e-billing-correction-note.spec.ts`
- any UI contract notes under `web-client/notes/` or `docs/`

Do not browse external sites. Do not run live WebORCA.

Problem:
Source direction keeps Workflow / Transmission / ORCA収納情報 outside details, but some income labels are tested only with DOM presence (`toBeInTheDocument`) rather than visibility. DADS says important information must not be hidden, and disclosure/accordion is for supplemental content.

Required invariant:
- ORCA収納情報 section heading and important labels/explanations/date/insurance/preview/unpaid info are outside closed details and visible.
- Unit tests use `toBeVisible()` for important labels, not only DOM presence.
- E2E tests assert visible and details-out for critical billing labels where practical.
- OrcaSummary remains a support panel and does not introduce a competing primary CTA.

Deliverables to manager:
1. List of exact labels currently DOM-only.
2. Proposed test changes and any required source changes.
3. DADS reasoning restricted to `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`.
4. Commands to run and expected evidence.

Do not claim dynamic success.
```

---

## Subagent G: evidence/log/report integrator

```text
あなたは OpenDolphinNext の evidence/log/report integration subagent です。gpt-5.4 high として作業してください。

Scope:
- all changed files from subagents
- `docs/implementation/opendolphin-postfix-static-remediation-20260418/`
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- old carried-forward docs under `docs/implementation/`
- test logs created by manager

Do not browse external sites. Do not run live WebORCA.

Problem:
Previous worker report accepted too much without rerun artifacts. The final report must distinguish source evidence, unit tests, integration tests, e2e tests, docs-only, rerun result, and not verified.

Required invariant:
- Never write READY while Critical remains.
- Never accept claimed test run without log path / rerun evidence.
- Old PASS / already closed docs must not be promoted to current truth.
- Live ORCA success is not claimed.

Deliverables to manager:
1. Final report draft using `docs/implementation/opendolphin-postfix-static-remediation-20260418/06_final_report_template.md`.
2. Test evidence table from actual logs.
3. Residual unknowns table.
4. Dynamic handoff verdict recommendation.
5. List of old docs that still contain misleading carried-forward PASS language.

Do not claim dynamic success.
```
