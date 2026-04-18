# 04 Codex merge order and acceptance

## 1. Merge order

1. **C7 medicalInformation gate**
   - Reason: Critical. READY cannot be considered while open.
   - Merge only when empty-string / null / presence / zero-request negatives are pinned.

2. **C5 patient import success semantics**
   - Reason: High trial-signal blocker.
   - Merge only when skipped-only and count inconsistency cannot be success.

3. **C3 charts row-local closure**
   - Reason: High false-positive ORCA signal.
   - Merge only when Timeline and print no longer use patient/latest fallback for positive invoice/send.

4. **C1/C2/T-NEG transport security**
   - Reason: High raw target material and config inconsistency.
   - Merge only when `default` and userinfo validation + rendered negative surfaces are covered.

5. **RT-01 route taxonomy guard/docs**
   - Reason: High guard/docs drift.
   - Merge only when guard allowlist, success message, docs, and tests explain the same categories.

6. **C6 DADS visibility lock**
   - Reason: Medium but affects UI/DADS static confidence.
   - Merge only when important ORCA収納情報 labels are visible/details-out in tests.

7. **Docs cleanup and evidence report**
   - Reason: Must reflect source truth after fixes.
   - Merge only after final test evidence is known.

## 2. Conflict policy

- If two changes disagree, choose stricter trial-signal integrity.
- Do not preserve old behavior for compatibility.
- Do not keep fallback paths that can create positive ORCA signal without row-local key.
- Do not weaken tests to pass.
- If environment prevents a test run, document `not run` and why; do not call it passed.

## 3. Minimum acceptance by claim

| claim | acceptance condition |
|---|---|
| C7 | field presence failure + checkedRequests > 0 required + QA scripts propagate failure + docs aligned |
| C5 | skipped/count partial cannot produce success toast/audit success + canonical readback still required |
| C3 | Timeline and print cannot show other encounter invoice/send as current row positive signal |
| C6 | important ORCA収納情報 labels visible and details-out locked by unit/e2e where practical |
| C1 | `default` sentinel rejected consistently in config/admin/transport/readiness |
| C2 | userinfo URL rejected and raw URL/userinfo/host/path absent from failure surfaces |
| R-OBS-01 | `clientAuthConfigured` config truth preserved |
| T-NEG-01 | detail log/admin save failure/userinfo admin view negatives covered |
| RT-01 | route taxonomy guard/docs/smoke wording aligned |
| older docs | no current truth claim based only on worker report/prior PASS |
| tests_run | accepted only with log path and exit code |

## 4. Suggested focused test commands

Adjust commands to actual package scripts. Save logs under:

```text
docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/
```

Example log wrapper:

```bash
mkdir -p docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs
( cd web-client && npm run verify:web-guard )   2>&1 | tee docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/web-guard.log
```

Candidate commands:

```bash
cd web-client && npm run verify:web-guard
cd web-client && npm run typecheck
cd web-client && npx vitest run scripts/__tests__/medicalInformationGate.test.ts
cd web-client && npx vitest run src/features/outpatient/__tests__/orcaPatientImportApi.test.ts
cd web-client && npx vitest run src/features/charts/orcaClaimSendCache.test.ts src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx src/features/charts/__tests__/OrcaSummary.semantics.test.tsx
mvn -pl server-modernized -Dtest=OrcaConnectionConfigStoreTest,OrcaTransportRegistryTest,OrcaHttpClientLogTest,AdminOrcaConnectionResourceTest,AdminOrcaConnectionTestSupportTest,OperationsHealthResourceTest test
```

Only run wider commands when environment supports them:

```bash
cd web-client && npm run ci
mvn static-analysis verify
```

## 5. Static exit condition

Static exit can be claimed only when:

- C7 is accepted closed.
- C5 is accepted closed.
- C3 row-local false positives are accepted closed.
- C2 raw target material surface is accepted closed.
- RT-01 route guard/docs are accepted closed or residual risk is explicitly Low and not trial-signal breaking.
- All claimed tests have log evidence.
- Dynamic/live success is not mixed into static truth.

## 6. Dynamic handoff condition

`READY FOR DYNAMIC TRIAL CHECK` is allowed only after static exit condition is met. It does **not** mean live ORCA succeeded. It means dynamic trial can start.
