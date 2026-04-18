# OpenDolphinNext post-fix static remediation report

## 1. overall verdict

- `ACCEPT WORKER REPORT`

Manager rerun on 2026-04-18 closed the remaining static blockers in source/test/docs/scripts. Earlier failed reruns under the same packet were superseded by later source fixes plus later green reruns on the current tree.

## 2. dynamic handoff verdict

- `READY`

Meaning of `READY` here:

- static remediation is closed enough to hand off to a separate dynamic trial task
- live ORCA / WebORCA success is **not** claimed
- current local shell still had an environment blocker for `runtime-ready-smoke` because `127.0.0.1:9080` was not up

## 3. changed files

| path | change type | reason | linked claim |
|---|---|---|---|
| `web-client/scripts/qa-lib/medical-information-gate.mjs` | source | `medicalInformation` / `Medical_Information` field presence, empty string, null, zero-capture fail-close | C7 |
| `web-client/scripts/__tests__/medicalInformationGate.test.ts` | test | omission gate negatives and zero-request failure | C7 |
| `web-client/scripts/qa-acceptmodv2-weborca.mjs` | script | gate evidence summary reflects checked request count | C7 |
| `web-client/scripts/qa-fullflow-weborca.mjs` | script | gate evidence summary reflects checked request count | C7 |
| `web-client/scripts/runtime-ready-smoke.mjs` | script | blocked legacy route hit is treated as failure | RT-01 |
| `web-client/scripts/verify-no-blocked-orca-route-strings.mjs` | script | production fail-close sentinel and mock/test-only legacy surface are separated explicitly | RT-01 |
| `web-client/src/features/outpatient/orcaPatientImportApi.ts` | source | import full-success semantics require all-zero business status, zero skipped/errors, count consistency, canonical readback | C5 |
| `web-client/src/features/outpatient/__tests__/orcaPatientImportApi.test.ts` | test | partial/warning/fail-close import semantics | C5 |
| `web-client/src/features/patients/PatientsPage.tsx` | source | skipped-only and canonical-readback-failed import paths stay warning/not ok | C5 |
| `web-client/src/features/patients/__tests__/PatientsPage.test.tsx` | test | import partial/warning UI and audit summary | C5 |
| `web-client/src/features/patients/api.ts` | source | patient mutation/readback semantics stay final-ok based | C5 |
| `web-client/src/features/patients/__tests__/api.test.ts` | test | canonical readback failure is not treated as success | C5 |
| `web-client/src/features/shared/orcaApiResponse.ts` | source | shared `Api_Result` / business-ok parsing | C5 |
| `web-client/src/features/charts/DocumentTimeline.tsx` | source | row-local claim/send closure; patient/latest fallback cannot create positive signal | C3 |
| `web-client/src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx` | test | row-local negative recovery cases | C3 |
| `web-client/src/features/charts/print/useOrcaReportPrint.ts` | source | print prefill uses row-local invoice only | C3 |
| `web-client/src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx` | test | print row-local regression guard | C3 |
| `web-client/src/features/charts/OrcaSummary.tsx` | source | must-visible labels remain outside details fold | C6 |
| `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx` | test | visibility assertions for correction note / setting note / ORCA income summary | C6 |
| `tests/charts/e2e-billing-correction-note.spec.ts` | e2e test | correction note visibility lock | C6 |
| `tests/charts/e2e-orca-billing-status.spec.ts` | e2e test | send success != paid guard with `incomeinfv2` | pass area guard |
| `web-client/src/features/outpatient/orcaQueueApi.ts` | source | blocked legacy route strings remain only as production fail-close sentinel | RT-01 |
| `web-client/src/mocks/handlers/orcaQueue.ts` | source | mock/test-only legacy route surface | RT-01 |
| `web-client/src/mocks/handlers/orcaQueue.test.ts` | test | sentinel/mock route contract | RT-01 |
| `web-client/src/libs/http/httpClient.test.ts` | test | route taxonomy guard references current constants | RT-01 |
| `server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java` | source | reject reserved `default`, reject userinfo URL, fail closed for facility selection | C1, C2 |
| `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSecurityPolicy.java` | source | userinfo reject and policy error classification | C1, C2 |
| `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java` | source | sanitize admin save/get failure details and view payload | C2, T-NEG-01 |
| `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaHttpClient.java` | source | raw target material masked in detail/summary logging | T-NEG-01 |
| `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java` | source | preserve `clientAuthConfigured` truth while failing closed | R-OBS-01 |
| `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java` | source | preserve current config truth for readiness/admin surfaces | R-OBS-01 |
| `server-modernized/src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java` | source | transport reload/readiness stays aligned with sanitized config handling | R-OBS-01 |
| `server-modernized/src/test/java/open/dolphin/orca/config/OrcaConnectionConfigStoreTest.java` | test | reserved literal / userinfo / fail-close facility selection | C1, C2 |
| `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java` | test | sanitized admin save/get behavior | C2, T-NEG-01 |
| `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaHttpClientLogTest.java` | test | raw target material masked in logs | T-NEG-01 |
| `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaTransportRegistryTest.java` | test | `clientAuthConfigured` truth stays visible | R-OBS-01 |
| `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java` | test | readiness preserves truth without leaking raw target details | R-OBS-01, C2 |
| `server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionTestSupportTest.java` | test | save/test support path stays sanitized | C2, T-NEG-01 |
| `server-modernized/src/test/java/open/dolphin/orca/transport/OrcaTransportSettingsExternalConfigTest.java` | test | external config sanitize/readiness regression guard | C2, R-OBS-01 |
| `server-modernized/src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java` | test | transport reload/readiness regression guard | R-OBS-01 |
| `server-modernized/src/test/java/open/dolphin/rest/OrcaGatewayExceptionMapperTest.java` | test | no raw target material in mapped failures | T-NEG-01 |
| `docs/contracts/orca-route-taxonomy.md` | docs | taxonomy categories and allowed legacy-route surfaces fixed to current contract | RT-01 |
| `docs/contracts/orca-connection.md` | docs | reserved `default`, userinfo reject, sanitized admin/readiness behavior | C1, C2, T-NEG-01, R-OBS-01 |
| `docs/runbooks/release-validation.md` | docs | static gate updated for omission invariant, taxonomy guard, blocked-route handling | C7, RT-01 |
| `docs/releases/orca-remediation-cutover.md` | docs | cutover conditions updated for omission invariant and blocked legacy route behavior | C7, RT-01 |
| `docs/implementation/opendolphin-webclient-remaining-followup-package-20260417/*` | docs | stale carry-forward PASS language reduced in current manager-facing packet | older docs cleanup |

## 4. claim verification matrix

| claim | status | strongest evidence | representative files | evidence type | why |
|---|---|---|---|---|---|
| C1 | accepted | `20260418T123334Z-server-focused-mvn-current-rerun.log` | `OrcaConnectionConfigStore.java`, `OrcaConnectionConfigStoreTest.java` | source + rerun | reserved `default` and userinfo URL are rejected fail-closed in config/store path |
| C2 | accepted | `20260418T123334Z-server-focused-mvn-current-rerun.log` | `AdminOrcaConnectionResource.java`, `AdminOrcaConnectionResourceTest.java` | source + rerun | admin failure/view surfaces no longer return raw URL/userinfo/host/secret path |
| C3 | accepted | `20260418T123246Z-web-focused-vitest-current-rerun.log` | `DocumentTimeline.tsx`, `DocumentTimeline.recovery-order.test.tsx`, `useOrcaReportPrint.ts` | source + rerun | row-local claim/send and print prefill closure passed on current tree |
| C5 | accepted | `20260418T123246Z-web-focused-vitest-current-rerun.log` | `orcaPatientImportApi.ts`, `orcaPatientImportApi.test.ts`, `PatientsPage.tsx` | source + rerun | full success now requires zero skipped/errors, count consistency, canonical readback |
| C6 | accepted | `20260418T123632Z-playwright-charts-msw-current-rerun.log`, `20260418T123246Z-web-focused-vitest-current-rerun.log` | `OrcaSummary.tsx`, `OrcaSummary.semantics.test.tsx`, `e2e-billing-correction-note.spec.ts` | source + rerun | must-visible labels are outside details and checked by visibility, not DOM presence only |
| C7 | accepted | `20260418T123246Z-web-focused-vitest-current-rerun.log` | `medical-information-gate.mjs`, `medicalInformationGate.test.ts` | source + rerun | unspecified run fails on field presence including empty string/null and zero target mutation capture |
| R-OBS-01 | accepted | `20260418T123334Z-server-focused-mvn-current-rerun.log` | `OrcaTransportRegistry.java`, `OperationsHealthResourceTest.java` | source + rerun | readiness/admin surfaces preserve `clientAuthConfigured` truth without leaking target material |
| T-NEG-01 | accepted | `20260418T123334Z-server-focused-mvn-current-rerun.log` | `OrcaHttpClient.java`, `OrcaHttpClientLogTest.java`, `OrcaGatewayExceptionMapperTest.java` | source + rerun | raw URL/userinfo/host/secret path do not appear in log/admin/audit failure surfaces |
| RT-01 | accepted | `20260418T123143Z-verify-web-guard-current.log`, `20260418T123632Z-playwright-charts-msw-current-rerun.log` | `verify-no-blocked-orca-route-strings.mjs`, `orcaQueueApi.ts`, `orca-route-taxonomy.md` | guard + rerun + docs | server public surface, client fail-close sentinel, and mock/test surface are aligned |
| older docs cleanup | partial | source review of current docs set | current packet docs above | docs-only | current manager-facing packet was corrected, but old archived/historical closeout docs still contain stale PASS wording |
| pass area guard | accepted | `20260418T123632Z-playwright-charts-msw-current-rerun.log`, `20260418T123403Z-web-ci-current.log` | charts e2e specs, full `npm run ci` | rerun | charts direction and broader web regression bundle stayed green on current tree |

## 5. blocker closure table

| area | status | strongest evidence | note |
|---|---|---|---|
| C1 | closed | `20260418T123334Z-server-focused-mvn-current-rerun.log` | `default` literal rejected fail-closed |
| C2 | closed | `20260418T123334Z-server-focused-mvn-current-rerun.log` | userinfo/raw target material no longer exposed |
| C3 | closed | `20260418T123246Z-web-focused-vitest-current-rerun.log` | row-local closure and print prefill pass |
| C5 | closed | `20260418T123246Z-web-focused-vitest-current-rerun.log` | skipped-only partial stays warning/not ok |
| C6 | closed | `20260418T123632Z-playwright-charts-msw-current-rerun.log` | must-visible labels checked by visibility |
| C7 | closed | `20260418T123246Z-web-focused-vitest-current-rerun.log` | omission gate closed |
| R-OBS-01 | closed | `20260418T123334Z-server-focused-mvn-current-rerun.log` | readiness truth preserved |
| T-NEG-01 | closed | `20260418T123334Z-server-focused-mvn-current-rerun.log` | sanitize negative coverage green |
| RT-01 | closed | `20260418T123143Z-verify-web-guard-current.log` | taxonomy guard/docs aligned |
| older docs | partial | current docs review | archived/historical stale PASS wording remains outside current source of truth |
| pass area guard | closed | `20260418T123403Z-web-ci-current.log`, `20260418T123632Z-playwright-charts-msw-current-rerun.log` | no static regression found in current reruns |

## 6. test execution evidence

| command | cwd | exit | timestamp | log path | accepted? | note |
|---|---|---:|---|---|---|---|
| `npm run verify:web-guard` | `web-client` | 0 | `2026-04-18T12:31:43Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123143Z-verify-web-guard-current.log` | yes | current taxonomy/secret/auth guard |
| `npm test -- --run scripts/__tests__/medicalInformationGate.test.ts src/features/outpatient/__tests__/orcaPatientImportApi.test.ts src/features/patients/__tests__/PatientsPage.test.tsx src/features/charts/__tests__/DocumentTimeline.recovery-order.test.tsx src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx src/features/charts/__tests__/OrcaSummary.semantics.test.tsx src/mocks/handlers/orcaQueue.test.ts src/libs/http/httpClient.test.ts` | `web-client` | 0 | `2026-04-18T12:32:46Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123246Z-web-focused-vitest-current-rerun.log` | yes | current focused web closure bundle |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaConnectionConfigStoreTest,AdminOrcaConnectionResourceTest,AdminOrcaConnectionTestSupportTest,OrcaHttpClientLogTest,OrcaTransportRegistryTest,OperationsHealthResourceTest test` | repo root | 0 | `2026-04-18T12:33:34Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123334Z-server-focused-mvn-current-rerun.log` | yes | current focused server closure bundle |
| `npm run typecheck` | `web-client` | 0 | `2026-04-18T12:34:03Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123403Z-web-typecheck-current.log` | yes | current typecheck |
| `npm run ci` | `web-client` | 0 | `2026-04-18T12:34:03Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123403Z-web-ci-current.log` | yes | current full web guard/typecheck/test/build |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | repo root | 0 | `2026-04-18T12:34:03Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123403Z-server-static-analysis-verify-current.log` | yes | current full server static-analysis verify |
| `npx playwright test tests/charts/e2e-billing-correction-note.spec.ts tests/charts/e2e-orca-billing-status.spec.ts` | repo root | 0 | `2026-04-18T12:36:32Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123632Z-playwright-charts-msw-current-rerun.log` | yes | MSW-only charts e2e, not live ORCA |
| `node scripts/runtime-ready-smoke.mjs` | `web-client` | 1 | `2026-04-18T12:36:54Z` | `docs/implementation/opendolphin-postfix-static-remediation-20260418/test-logs/20260418T123654Z-runtime-ready-smoke-current.log` | yes | environment blocker: `ECONNREFUSED 127.0.0.1:9080` |
| `node scripts/qa-acceptmodv2-weborca.mjs` | `web-client` | not run | — | — | no | live WebORCA task was intentionally not executed in this static remediation |
| `node scripts/qa-fullflow-weborca.mjs` | `web-client` | not run | — | — | no | live WebORCA task was intentionally not executed in this static remediation |

## 7. residual unknowns

| area | status | why |
|---|---|---|
| runtime-ready local environment | environment blocker | paired backend on `127.0.0.1:9080` was not running, so smoke could not authenticate/bootstrap |
| live ORCA / WebORCA | not run | task explicitly separated static remediation from dynamic ORCA trial |
| archived / historical docs wording | residual docs drift | some old closeout/reference docs still contain stale PASS/closed language, though current source of truth docs were updated |

## 8. exact reasons no live ORCA success is claimed

1. This task explicitly prohibited live ORCA / WebORCA dynamic execution as acceptance evidence.
2. `qa-acceptmodv2-weborca.mjs` was not run in this turn.
3. `qa-fullflow-weborca.mjs` was not run in this turn.
4. Current Playwright evidence is MSW-only and does not touch live ORCA.
5. `runtime-ready-smoke` failed before app/backend bootstrap because `127.0.0.1:9080` refused connections, so it cannot be promoted to any live success claim.

## 9. final recommendation

1. Static fix status: closed in source/test/docs/scripts for C1/C2/C3/C5/C6/C7/R-OBS-01/T-NEG-01/RT-01.
2. Docs/test alignment: sufficient for handoff, with residual historical-doc wording drift kept outside current truth.
3. Dynamic ORCA trial check readiness: `READY`, but dynamic trial must be run as a separate task and no live success is pre-claimed here.
