# OpenDolphinNext post-fix static remediation report

RUN_ID: `20260418T210850Z`
Alignment update RUN_ID: `20260419T120442Z`

Current source of truth for this closure is this report plus current `docs/contracts/`, `docs/runbooks/`, `docs/releases/`, source, tests, scripts, and the RUN_ID test logs listed below. The 2026-04-19 alignment update refreshes RT-01 wording/category names against the current guard output without creating a new review support zip. Older 2026-04-17 planning packages and `docs/archive/` are historical context only.

## 1. overall verdict

- `ACCEPT`

The residual static review items are closed in current source/test/docs/scripts. Worker reports were treated as claims only; acceptance is based on current repo diffs and the RUN_ID evidence logs.

## 2. dynamic handoff verdict

- `STATIC READY / DYNAMIC PARTIAL`

Static remediation was ready for dynamic ORCA/WebORCA trial. The later dynamic run accepted Phase 1 runtime-ready and Phase 2 read-only preflight, but Phase 3 mutation was business-rejected and Phase 4 fullflow was not executed. This report does **not** claim live mutation or fullflow success.

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
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/09_dynamic_orca_trial_report.md` | docs | dynamic evidence truth aligned to accepted/rejected/not verified buckets | evidence |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/REVIEW_LOG_INCLUSIONS_MANIFEST.txt` | docs | static and dynamic log package inclusion manifest | evidence |
| `scripts/create-review-package.sh` | script | optional review-log manifest inclusion and no-clean-checkout package truth | evidence package |
| `tests/review-package/create-review-package.test.mjs` | test | package manifest and review-log inclusion coverage | evidence package |
| `scripts/tools/README.md` | docs | package support workflow docs | evidence package |
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
| C3 | static accepted / dynamic not verified | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-web-ci.log`; dynamic fullflow not run | existing chart/print source/tests | row-local positive signal invariant stayed green, but live chart fullflow was not executed |
| C5 | static accepted / dynamic not verified | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-web-ci.log`; dynamic import/canonical flow not run | `patients/api.ts`, `orcaPatientImportApi.ts` | canonical readback gates on all-zero PatientBatchResponse business result, but live import/canonical readback was not executed |
| C6 | static accepted / dynamic not verified | `20260418T210850Z-web-focused-vitest.log`, `20260418T210850Z-playwright-charts-msw.log`; dynamic fullflow not run | `OrcaSummary.tsx`, chart e2e specs | ORCA income/correction/setting notes remain visible outside details, but live income/claim/fullflow was not executed |
| C7 | static accepted / dynamic partial | static logs plus `20260418T224551Z-qa-acceptmodv2-weborca-final.log` | medical-information gate source/tests and `accept-summary.json` | field-presence gate checked one mutation request with zero violations; business mutation rejected with `apiResult=10` |
| R-OBS-01 | accepted | `20260418T210850Z-server-focused-maven.log`, `20260418T210850Z-server-static-analysis-verify.log` | `OperationsReadinessEvaluator.java`, `OperationsHealthResourceTest.java` | `clientAuthConfigured` truth remains while raw readiness details are hidden |
| T-NEG-01 | accepted | `20260418T210850Z-server-focused-maven.log`, `20260418T210850Z-server-static-analysis-verify.log` | existing ORCA HTTP/admin tests | raw URL/userinfo/host/secret path negative coverage stayed green |
| RT-01 | accepted | `20260418T210850Z-web-guard.log`, `20260418T210850Z-web-ci.log`; current rerun `20260419T120442Z` guard output | `orca-route-taxonomy-guard.mjs`, `orca-route-taxonomy.md` | repo-wide route strings are classified with aligned category counts |
| older docs cleanup | accepted | current docs diff + `20260418T210850Z-web-guard.log` | scoped 2026-04-17 packages and archive READMEs | stale PASS/READY/closed wording is explicitly historical |
| pass area guard | accepted | `20260418T210850Z-web-ci.log`, `20260418T210850Z-playwright-charts-msw.log` | charts e2e specs, full web CI | broader web regression stayed green |

## 5. residual issue matrix

| residual | severity | root cause | affected area | why it remains |
|---|---|---|---|---|
| `runtime-ready-smoke` environment blocker | medium | paired backend was not running on `127.0.0.1:9080` | optional local runtime smoke | this task does not start live backend/ORCA; log preserved as blocker evidence |
| live ORCA / WebORCA not verified | high for release, out of static scope | dynamic trial was explicitly prohibited | dynamic ORCA acceptance | separate dynamic trial task must run `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` |

No residual static source/test/docs blocker remains for RT-01, C5 secondary gate, DADS disabled reason, health readiness contract, older docs cleanup, or final evidence alignment. Dynamic C3/C5/C6 remain not verified until Phase 4 fullflow runs after an accepted Phase 3 mutation.

## 6. RT-01 route string classification table

| file path | route string | category | production/browser reachable? | why allowed |
|---|---|---|---|---|
| `web-client/src/features/outpatient/orcaQueueApi.ts` | `/api/orca/queue` | production fail-close sentinel | no successful browser route; production code returns 410 unavailable before fetch | explicit fail-close response for historical route |
| `web-client/src/features/outpatient/orcaQueueApi.ts` | `/api/orca/pusheventgetv2` | production fail-close sentinel | no successful browser route; production code returns 410 unavailable before fetch | explicit fail-close response for historical route |
| `web-client/src/mocks/handlers/orcaQueue.ts` | `/api/orca/queue` | MSW mock/test-only legacy route surface | no | isolated MSW legacy queue tests only |
| `web-client/src/mocks/handlers/orcaQueue.ts` | `/api/orca/pusheventgetv2` | MSW mock/test-only legacy route surface | no | isolated MSW push-event tests only |
| `web-client/plugins/flagged-mock-plugin.ts` | `/api/orca/queue` | e2e/QA fixture surface | dev/preview fixture only, gated by mock controls | Playwright/dev fixture compatibility |
| `tests/charts/e2e-management-setting-visibility.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright fixture stub/assertion |
| `tests/charts/e2e-orca-billing-status.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright fixture stub/assertion |
| `tests/e2e/charts-outpatient-mainflow.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright fixture stub/assertion |
| `tests/e2e/charts/e2e-orca-claim-send.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright fixture stub/assertion |
| `tests/e2e/orca-delivery.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright fixture server/assertion |
| `tests/e2e/orca-fullflow.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright fixture blocked-route capture |
| `tests/images/e2e-mobile-patient-picker-phase1.spec.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | legacy patient-picker fixture assertion |
| `tests/playwright/utils/ui-helpers.ts` | `/api/orca/queue` | e2e/QA fixture surface | no | Playwright helper, not production browser code |
| `web-client/scripts/qa-acceptmodv2-weborca.mjs` | `/api/orca/queue` | e2e/QA fixture surface | no | network capture target for blocked-route evidence; not executed in this task |
| `web-client/scripts/qa-fullflow-weborca.mjs` | `/api/orca/queue` | e2e/QA fixture surface | no | network capture target for blocked-route evidence; not executed in this task |
| `web-client/scripts/runtime-ready-smoke.mjs` | `/api/orca/queue` | blocked-route detector | no; detector fails if browser requests it | detector only; not a success route |
| `web-client/scripts/runtime-ready-smoke.mjs` | `/api/orca/pusheventgetv2` | blocked-route detector | no; detector fails if browser requests it | detector only; not a success route |
| `web-client/scripts/lib/orca-route-taxonomy-guard.mjs` | `/api/orca/queue` | blocked-route detector | no | guard allowlist/classifier owns monitored string |
| `web-client/scripts/lib/orca-route-taxonomy-guard.mjs` | `/api/orca/pusheventgetv2` | blocked-route detector | no | guard allowlist/classifier owns monitored string |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | `/api/orca/queue` | blocked-route detector | no | classifier fixture test |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | taxonomy-drift fixture string | blocked-route detector | no | negative classifier fixture for non-official/master route drift |
| `web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts` | boundary fixture string | blocked-route detector | no | classifier fixture string, not runtime route |
| `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | server route inventory negative assertion | no | test asserts legacy routes are absent from server inventory |
| `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | web.xml exposure negative assertion | no | test asserts legacy routes are absent from web.xml exposure |
| `docs/contracts/orca-route-taxonomy.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | contract describes blocked non-public routes |
| `docs/runbooks/release-validation.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | validation instructions describe blocked-route handling |
| `docs/releases/orca-remediation-cutover.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | cutover instructions describe blocked-route handling |
| `docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/*` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | historical/current implementation packet references only |
| `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` | `/api/orca/queue`, `/api/orca/pusheventgetv2` | docs/reference | no | this classification table |

Current guard result for alignment RUN_ID `20260419T120442Z`: scanned roots `9`, files `953`; category counts: `production fail-close sentinel=2`, `MSW mock/test-only legacy route surface=2`, `e2e/QA fixture surface=236`, `blocked-route detector=37`, `docs/reference=152`, `server route inventory negative assertion=2`, `web.xml exposure negative assertion=3`; skipped roots `none`.

Route taxonomy note: the only public `/api/orca/*` routes are official and master. The production fail-close sentinel, MSW mock/test-only legacy route surface, e2e/QA fixture surface, blocked-route detector, docs/reference, server route inventory negative assertion, and web.xml exposure negative assertion strings are category-classified retained strings or negative assertions, not public routes.

## 7. accepted test evidence table

These logs are accepted package evidence only when the generated review support zip contains `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` and the listed `test-logs/20260418T210850Z-*.log` entries.

| command | cwd | exit | timestamp | log path | package evidence? |
|---|---|---:|---|---|---|
| `npm run verify:web-guard` | `web-client` | 0 | `2026-04-18T21:28:15Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-guard.log` | yes, listed in `REVIEW_LOG_INCLUSIONS_MANIFEST.txt` |
| `npm test -- --run scripts/__tests__/medicalInformationGate.test.ts src/features/outpatient/__tests__/orcaPatientImportApi.test.ts src/features/patients/__tests__/api.test.ts src/features/patients/__tests__/PatientsPage.test.tsx src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx src/features/charts/__tests__/OrcaSummary.semantics.test.tsx src/mocks/handlers/orcaQueue.test.ts src/libs/http/httpClient.test.ts` | `web-client` | 0 | `2026-04-18T21:21:04Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-focused-vitest.log` | yes, listed |
| `npm run typecheck` | `web-client` | 0 | `2026-04-18T21:21:21Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-typecheck.log` | yes, listed |
| `npm run ci` | `web-client` | 0 | `2026-04-18T21:22:39Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-web-ci.log` | yes, listed |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaConnectionConfigStoreTest,AdminOrcaConnectionResourceTest,AdminOrcaConnectionTestSupportTest,OrcaHttpClientLogTest,OrcaTransportRegistryTest,OperationsHealthResourceTest test` | repo root | 0 | `2026-04-18T21:22:51Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-server-focused-maven.log` | yes, listed |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | repo root | 0 | `2026-04-18T21:24:13Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-server-static-analysis-verify.log` | yes, listed |
| `npx playwright test tests/charts/e2e-billing-correction-note.spec.ts tests/charts/e2e-orca-billing-status.spec.ts` | repo root | 0 | `2026-04-18T21:24:30Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-playwright-charts-msw.log` | yes, listed |
| `node scripts/runtime-ready-smoke.mjs` | `web-client` | 1 | `2026-04-18T21:24:37Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T210850Z-runtime-ready-smoke.log` | yes, listed as environment-blocker evidence |

## 8. not run / not verified table

| item | status | reason |
|---|---|---|
| `node scripts/qa-acceptmodv2-weborca.mjs` | not run | dynamic ORCA/WebORCA trial was explicitly prohibited for this task |
| `node scripts/qa-fullflow-weborca.mjs` | not run | dynamic ORCA/WebORCA trial was explicitly prohibited for this task |
| live ORCA / WebORCA | not verified | no live ORCA endpoint was contacted; no live success is claimed |

## 9. runtime-ready-smoke handling

`runtime-ready-smoke` exited `1` with `TypeError: fetch failed` caused by `connect ECONNREFUSED 127.0.0.1:9080`. This is recorded as an environment blocker only. It is not a live success, and it is not promoted to dynamic ORCA evidence.

## 10. package evidence alignment

- No current review support zip was generated for alignment RUN_ID `20260419T120442Z`.
- Historical support zip metadata from prior 2026-04-18/2026-04-19 package attempts is not current acceptance metadata for this report, and old package hash/size values are intentionally omitted here.
- Package evidence manifest remains `docs/implementation/opendolphin-postfix-static-remediation-20260418/REVIEW_LOG_INCLUSIONS_MANIFEST.txt` for the historical static/dynamic log inclusion set.
- Clean checkout truth is not asserted by any support zip. Use reviewer submission packet for `.git`-backed clean checkout evidence.

## 11. final recommendation

1. Static fix: accepted for RT-01, C5 secondary gate, DADS disabled reason, health readiness contract, older docs cleanup, and evidence alignment, while preserving C1/C2/C3/C5/C6/C7/R-OBS-01/T-NEG-01.
2. Docs/test alignment: accepted. Current truth is this report, contracts, runbooks, releases, source/tests/scripts, and the RUN_ID logs.
3. Dynamic ORCA trial check: Phase 1/2 accepted, Phase 3 partial/rejected, Phase 4 not verified. Do not claim live mutation/fullflow success until `qa-acceptmodv2-weborca.mjs` and `qa-fullflow-weborca.mjs` pass under a live trial assignment.
