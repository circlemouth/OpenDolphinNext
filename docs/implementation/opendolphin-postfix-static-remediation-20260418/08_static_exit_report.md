# OpenDolphinNext post-fix static remediation report

RUN_ID: `20260418T210850Z`

Current source of truth for this closure is this report plus current `docs/contracts/`, `docs/runbooks/`, `docs/releases/`, source, tests, scripts, and the RUN_ID test logs listed below. Older 2026-04-17 planning packages and `docs/archive/` are historical context only.

## 1. overall verdict

- `ACCEPT`

The residual static review items are closed in current source/test/docs/scripts. Worker reports were treated as claims only; acceptance is based on current repo diffs and the RUN_ID evidence logs.

## 2. dynamic handoff verdict

- `READY`

This means the static remediation can be handed off to a separate dynamic ORCA/WebORCA trial task. It does **not** claim live ORCA success. `runtime-ready-smoke` remains an environment blocker in this run because `127.0.0.1:9080` refused connections.

## 3. changed files

| path | change type | reason | linked area |
|---|---|---|---|
| `web-client/scripts/verify-no-blocked-orca-route-strings.mjs` | script | delegate to repo-wide taxonomy guard helper | RT-01 |
| `web-client/scripts/lib/orca-route-taxonomy-guard.mjs` | script | multi-root scanner, classifier, allowlist, category counts | RT-01 |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | test | classifier/scan-root regression coverage | RT-01 |
| `docs/contracts/orca-route-taxonomy.md` | docs | route category contract aligned with guard | RT-01 |
| `docs/runbooks/release-validation.md` | docs | release validation aligned with route guard and readiness contract | RT-01, health |
| `web-client/src/features/patients/api.ts` | source | canonical readback requires HTTP ok + all-zero `apiResult` + full ID match | C5 |
| `web-client/src/features/patients/__tests__/api.test.ts` | test | non-zero/missing/all-zero canonical batch business gates | C5 |
| `web-client/src/features/outpatient/orcaPatientImportApi.ts` | source | propagate canonical readback business result into import result | C5 |
| `web-client/src/features/outpatient/__tests__/orcaPatientImportApi.test.ts` | test | import stays non-success when canonical batch `apiResult` is non-zero | C5 |
| `web-client/src/features/charts/OrcaSummary.tsx` | source | visible disabled reason/helper text for income info button | DADS, C6 |
| `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx` | test | visible helper text and details-outside lock | DADS, C6 |
| `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java` | source | omit ORCA push raw `lastError` from readiness JSON | health, R-OBS-01 |
| `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java` | test | readiness detailed body remains sanitized, including ORCA push error | health, R-OBS-01 |
| `docs/contracts/health-endpoints.md` | docs | anonymous readiness contract aligned to sanitized detailed response | health |
| `docs/architecture/server-modernization-overview.md` | docs | health/readiness summary aligned to sanitized detailed contract | health |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/README.md` | docs | current source of truth and evidence location | evidence |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/06_final_report_template.md` | docs | verdict vocabulary aligned to ACCEPT/PARTIAL/REJECT and READY/NOT READY | evidence |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` | docs | final evidence matrix | evidence |
| `docs/implementation/opendolphin-webclient-followup-release-gate-package-20260417/README.md` | docs | new historical disclaimer entrypoint | older docs cleanup |
| `docs/implementation/opendolphin-webclient-followup-release-gate-package-20260417/*` | docs | stale PASS/READY wording marked historical | older docs cleanup |
| `docs/implementation/opendolphin-webclient-remaining-followup-package-20260417/*` | docs | stale worker-report/closed wording marked historical | older docs cleanup |
| `docs/archive/*` | docs | archive-level historical disclaimer | older docs cleanup |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-*.log` | evidence | current RUN_ID verification logs | evidence |

## 4. claim verification matrix

| claim | status | strongest current evidence | representative files | why |
|---|---|---|---|---|
| C1 | accepted | `20260418T210850Z-server-focused-maven.log`, `20260418T210850Z-server-static-analysis-verify.log` | existing ORCA connection source/tests | reserved `default` and userinfo URL invariants stayed green |
| C2 | accepted | `20260418T210850Z-server-focused-maven.log`, `20260418T210850Z-server-static-analysis-verify.log` | existing admin ORCA connection source/tests | raw target material remains sanitized |
| C3 | accepted | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-web-ci.log` | existing chart/print source/tests | row-local positive signal invariant stayed green |
| C5 | accepted | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-web-ci.log` | `patients/api.ts`, `orcaPatientImportApi.ts` | canonical readback now gates on all-zero PatientBatchResponse business result |
| C6 | accepted | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-playwright-charts-msw.log` | `OrcaSummary.tsx`, chart e2e specs | ORCA income/correction/setting notes remain visible outside details |
| C7 | accepted | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-web-ci.log` | existing medical information gate source/tests | unspecified run field-presence failure invariant stayed green |
| R-OBS-01 | accepted | `20260418T210850Z-server-focused-maven.log`, `20260418T210850Z-server-static-analysis-verify.log` | `OperationsReadinessEvaluator.java`, `OperationsHealthResourceTest.java` | `clientAuthConfigured` truth remains while raw readiness details are hidden |
| T-NEG-01 | accepted | `20260418T210850Z-server-focused-maven.log`, `20260418T210850Z-server-static-analysis-verify.log` | existing ORCA HTTP/admin tests | raw URL/userinfo/host/secret path negative coverage stayed green |
| RT-01 | accepted | `20260418T210850Z-web-guard.log`, `20260418T210850Z-web-ci.log` | `orca-route-taxonomy-guard.mjs`, `orca-route-taxonomy.md` | repo-wide route strings are classified with category counts |
| older docs cleanup | accepted | current docs diff + `20260418T210850Z-web-guard.log` | scoped 2026-04-17 packages and archive READMEs | stale PASS/READY/closed wording is explicitly historical |
| pass area guard | accepted | `20260418T210850Z-web-ci.log`, `20260418T210850Z-playwright-charts-msw.log` | charts e2e specs, full web CI | broader web regression stayed green |

## 5. residual issue matrix

| residual | severity | root cause | affected area | why it remains |
|---|---|---|---|---|
| `runtime-ready-smoke` environment blocker | medium | paired backend was not running on `127.0.0.1:9080` | optional local runtime smoke | this task does not start live backend/ORCA; log preserved as blocker evidence |
| live ORCA / WebORCA not verified | high for release, out of static scope | dynamic trial was explicitly prohibited | dynamic ORCA acceptance | separate dynamic trial task must run `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` |

No residual static source/test/docs blocker remains for RT-01, C5 secondary gate, DADS disabled reason, health readiness contract, older docs cleanup, or final evidence alignment.

## 6. RT-01 route string classification table

| file path | route string | category | production/browser reachable? | why allowed |
|---|---|---|---|---|
| `web-client/src/features/outpatient/orcaQueueApi.ts` | `/api/orca/queue` | client production fail-close sentinel | no successful browser route; production code returns 410 unavailable before fetch | explicit fail-close response for historical route |
| `web-client/src/features/outpatient/orcaQueueApi.ts` | `/api/orca/pusheventgetv2` | client production fail-close sentinel | no successful browser route; production code returns 410 unavailable before fetch | explicit fail-close response for historical route |
| `web-client/src/mocks/handlers/orcaQueue.ts` | `/api/orca/queue` | MSW mock/test-only legacy route surface | no | isolated MSW legacy queue tests only |
| `web-client/src/mocks/handlers/orcaQueue.ts` | `/api/orca/pusheventgetv2` | MSW mock/test-only legacy route surface | no | isolated MSW push-event tests only |
| `web-client/plugins/flagged-mock-plugin.ts` | `/api/orca/queue` | e2e fixture/test-only surface | dev/preview fixture only, gated by mock controls | Playwright/dev fixture compatibility |
| `tests/charts/e2e-management-setting-visibility.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright fixture stub/assertion |
| `tests/charts/e2e-orca-billing-status.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright fixture stub/assertion |
| `tests/e2e/charts-outpatient-mainflow.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright fixture stub/assertion |
| `tests/e2e/charts/e2e-orca-claim-send.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright fixture stub/assertion |
| `tests/e2e/orca-delivery.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright fixture server/assertion |
| `tests/e2e/orca-fullflow.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright fixture blocked-route capture |
| `tests/images/e2e-mobile-patient-picker-phase1.spec.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | legacy patient-picker fixture assertion |
| `tests/playwright/utils/ui-helpers.ts` | `/api/orca/queue` | e2e fixture/test-only surface | no | Playwright helper, not production browser code |
| `web-client/scripts/qa-acceptmodv2-weborca.mjs` | `/api/orca/queue` | e2e fixture/test-only surface | no | network capture target for blocked-route evidence; not executed in this task |
| `web-client/scripts/qa-fullflow-weborca.mjs` | `/api/orca/queue` | e2e fixture/test-only surface | no | network capture target for blocked-route evidence; not executed in this task |
| `web-client/scripts/runtime-ready-smoke.mjs` | `/api/orca/queue` | blocked-route detector | no; detector fails if browser requests it | runtime smoke blocked-route failure detector |
| `web-client/scripts/runtime-ready-smoke.mjs` | `/api/orca/pusheventgetv2` | blocked-route detector | no; detector fails if browser requests it | runtime smoke blocked-route failure detector |
| `web-client/scripts/lib/orca-route-taxonomy-guard.mjs` | `/api/orca/queue` | blocked-route detector | no | guard allowlist/classifier owns monitored string |
| `web-client/scripts/lib/orca-route-taxonomy-guard.mjs` | `/api/orca/pusheventgetv2` | blocked-route detector | no | guard allowlist/classifier owns monitored string |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | `/api/orca/queue` | blocked-route detector | no | classifier fixture test |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | taxonomy-drift fixture string | blocked-route detector | no | negative classifier fixture for non-official/master route drift |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | boundary fixture string | blocked-route detector | no | classifier fixture string, not runtime route |
| `docs/contracts/orca-route-taxonomy.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | contract describes blocked non-public routes |
| `docs/runbooks/release-validation.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | validation instructions describe blocked-route handling |
| `docs/releases/orca-remediation-cutover.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | cutover instructions describe blocked-route handling |
| `docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/*` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | historical/current implementation packet references only |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | this classification table |

Guard result: `server public route=47`, `client production fail-close sentinel=2`, `MSW mock/test-only legacy route surface=2`, `e2e fixture/test-only surface=225`, `blocked-route detector=31`, `docs/reference=117`, skipped roots `none`.

## 7. accepted test evidence table

| command | cwd | exit | timestamp | log path | accepted? |
|---|---|---:|---|---|---|
| `npm run verify:web-guard` | `web-client` | 0 | `2026-04-18T21:28:15Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-guard.log` | yes |
| `npm test -- --run scripts/__tests__/medicalInformationGate.test.ts src/features/outpatient/__tests__/orcaPatientImportApi.test.ts src/features/patients/__tests__/api.test.ts src/features/patients/__tests__/PatientsPage.test.tsx src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx src/features/charts/__tests__/OrcaSummary.semantics.test.tsx src/mocks/handlers/orcaQueue.test.ts src/libs/http/httpClient.test.ts` | `web-client` | 0 | `2026-04-18T21:21:04Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-focused-vitest.log` | yes |
| `npm run typecheck` | `web-client` | 0 | `2026-04-18T21:21:21Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-typecheck.log` | yes |
| `npm run ci` | `web-client` | 0 | `2026-04-18T21:22:39Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-ci.log` | yes |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaConnectionConfigStoreTest,AdminOrcaConnectionResourceTest,AdminOrcaConnectionTestSupportTest,OrcaHttpClientLogTest,OrcaTransportRegistryTest,OperationsHealthResourceTest test` | repo root | 0 | `2026-04-18T21:22:51Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-server-focused-maven.log` | yes |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | repo root | 0 | `2026-04-18T21:24:13Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-server-static-analysis-verify.log` | yes |
| `npx playwright test tests/charts/e2e-billing-correction-note.spec.ts tests/charts/e2e-orca-billing-status.spec.ts` | repo root | 0 | `2026-04-18T21:24:30Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-playwright-charts-msw.log` | yes |
| `node scripts/runtime-ready-smoke.mjs` | `web-client` | 1 | `2026-04-18T21:24:37Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-runtime-ready-smoke.log` | yes, as environment blocker |

## 8. not run / not verified table

| item | status | reason |
|---|---|---|
| `node scripts/qa-acceptmodv2-weborca.mjs` | not run | dynamic ORCA/WebORCA trial was explicitly prohibited for this task |
| `node scripts/qa-fullflow-weborca.mjs` | not run | dynamic ORCA/WebORCA trial was explicitly prohibited for this task |
| live ORCA / WebORCA | not verified | no live ORCA endpoint was contacted; no live success is claimed |

## 9. runtime-ready-smoke handling

`runtime-ready-smoke` exited `1` with `TypeError: fetch failed` caused by `connect ECONNREFUSED 127.0.0.1:9080`. This is recorded as an environment blocker only. It is not a live success, and it is not promoted to dynamic ORCA evidence.

## 10. final recommendation

1. Static fix: accepted for RT-01, C5 secondary gate, DADS disabled reason, health readiness contract, older docs cleanup, and evidence alignment, while preserving C1/C2/C3/C5/C6/C7/R-OBS-01/T-NEG-01.
2. Docs/test alignment: accepted. Current truth is this report, contracts, runbooks, releases, source/tests/scripts, and the RUN_ID logs.
3. Dynamic ORCA trial check: ready to hand off as a separate task. Do not claim live success until `qa-acceptmodv2-weborca.mjs` and `qa-fullflow-weborca.mjs` are run under a live trial assignment.
