# ORCA Remediation Closeout Report

## 1. 総合 verdict

- FAIL
- 再オープン推奨
- source / tests / grep / runtime evidence を current merged branch で再確認した結果、G0, G1, G2, G3, G4, G5, G7 は source/test/doc 観点で閉じましたが、G6 は FAIL のままです。`artifacts/orca-remediation/closeout/20260413T104000Z/qa/fullflow/summary.json` が示すとおり live fullflow は `order save -> finish -> ORCA send` まで到達せず、`medicalmodv2.xml` を採取できませんでした。blocker は単一原因ではなく、test-data blocker、`/api/orca/official/patients/import` の 500、`/api/orca/official/appointments/medical-information` の 502 が重なっています。

## 2. 実施サマリ

- 読んだ文書:
  - `AGENTS.md`
  - `docs/runbooks/release-validation.md`
  - `docs/releases/orca-remediation-cutover.md`
  - `docs/contracts/orca-route-taxonomy.md`
  - `docs/operations/ORCA_CERTIFICATION_ONLY.md`
  - `web-client/notes/ui-current-contract.md`
  - `docs/implementation/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/00_remaining_tasks_matrix.md`
  - `docs/implementation/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/01_merge_strategy.md`
  - `docs/implementation/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/30_evidence_bundle_spec.md`
  - `docs/implementation/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/31_final_report_template.md`
- 起動したサブエージェント:
  - SA-20 route/shared/policy
  - SA-21 reception/handoff
  - SA-22 charts/ui
  - SA-23 runtime/qa
  - SA-24 validation/docs
- merge 順:
  - 実コミット順は `SA-22 (9a1f640f0) -> SA-20+SA-21 integrated (1c8eb05309fe86671b67e4f0da31ccbc0d9f6ccf)`。
  - SA-23 の runtime helper 差分と SA-24 の docs / evidence 整形は current worktree 差分として確認しました。
- 実行した主要コマンド:
  - git provenance 一式
  - taxonomy / stale wording / handoff / result policy / fullflow routing grep
  - `npm run verify:web-guard`
  - `npm run ci`
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
  - `node web-client/scripts/runtime-ready-smoke.mjs`
  - `node web-client/scripts/qa-acceptmodv2-weborca.mjs`
  - `node web-client/scripts/qa-fullflow-weborca.mjs`
  - `node --check` for runtime helper scripts
- full validation の範囲:
  - committed diff の server/web build + test
  - runtime-ready smoke
  - live accept/fullflow attempt
  - evidence bundle 整形
  - closeout report 作成

## 3. 変更差分サマリ

- merge-base: `2825106d4949acf67f6c80a4158ee283a630ac0e`
- HEAD: `1c8eb05309fe86671b67e4f0da31ccbc0d9f6ccf`
- committed 変更ファイル数: `43` files changed (`artifacts/orca-remediation/closeout/20260413T104000Z/git/git-diff-stat-current.txt`)
- 主要 area:
  - server audit taxonomy / route metadata
  - reception canonical handoff
  - charts local-only wording / DADS
  - shared ORCA result policy
  - runtime helper artifacts
  - docs / closeout bundle
- shared files の統合修正:
  - `web-client/src/features/charts/ChartsActionBar.tsx`
  - `web-client/notes/ui-current-contract.md`
  - `docs/runbooks/release-validation.md`
  - `docs/releases/orca-remediation-cutover.md`

## 4. サブエージェント別成果

### SA-20
- 要約: audit action naming を `ORCA_OFFICIAL_* / ORCA_MASTER_* / LOCAL_*` へ寄せ、shared ORCA result policy 導入の前提を整えた。
- 主な changed files:
  - `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaRestResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaWrapperResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/OrcaPatientApiResource.java`
  - `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
  - `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- tests:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/server-targeted.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/server-verify.log`
- unresolved:
  - none in source/test scope
- main agent の統合判断:
  - PASS。route taxonomy と audit scope の整合を確認。
- conflict 解消:
  - SA-21 と shared docs / ChartsActionBar overlap を統合コミットで吸収。

### SA-21
- 要約: reception canonical handoff を `scheduleKey` / `encounterKey` 基準へ固定し、display string 再解析 helper を撤去した。
- 主な changed files:
  - `web-client/src/features/reception/receptionHandoff.ts`
  - `web-client/src/features/reception/pages/ReceptionPage.tsx`
  - `web-client/src/features/reception/acceptmodv2Result.ts`
  - `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx`
  - `web-client/src/features/reception/__tests__/receptionHandoff.test.ts`
- tests:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/web-targeted.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/web-ci.log`
- unresolved:
  - live fullflow の accept candidate が test-data blocker で止まり、accept 後 canonical handoff を live で閉じ切れていない
- main agent の統合判断:
  - source/tests/grep は PASS、live handoff close は FAIL
- conflict 解消:
  - SA-22 が先行していた `ChartsActionBar.tsx` と整合するよう main agent が統合。

### SA-22
- 要約: charts local-only wording を official 風 copy から切り離し、DADS に反する `<details>` 隠蔽を除去した。
- 主な changed files:
  - `web-client/src/features/charts/pages/ChartsPage.tsx`
  - `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`
  - `web-client/src/features/charts/styles.ts`
  - `web-client/src/features/charts/__tests__/MedicalOutpatientRecordPanel.test.tsx`
  - `web-client/src/features/charts/__tests__/chartsLocalSummarySemantics.test.tsx`
- tests:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/web-targeted.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/web-ci.log`
- unresolved:
  - none in wording / DADS scope
- main agent の統合判断:
  - PASS
- conflict 解消:
  - 先行コミット `9a1f640f0` を current branch に保持し、その後の shared integration で `ChartsActionBar.tsx` を再調整。

### SA-23
- 要約: runtime helper scripts を evidence-first に拡張し、live fullflow failure を test-data / repo-defect / external blocker に切り分けた。
- 主な changed files:
  - `web-client/scripts/qa-lib/session-auth.mjs`
  - `web-client/scripts/qa-acceptmodv2-weborca.mjs`
  - `web-client/scripts/qa-fullflow-weborca.mjs`
  - `artifacts/orca-remediation/20260413T104000Z/reports/sa23-runtime-summary.md`
- tests / scripts:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/runtime-ready-smoke.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/qa-acceptmodv2-weborca.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/qa-fullflow-weborca.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/node-check-session-auth.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/node-check-qa-acceptmodv2.log`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/node-check-qa-fullflow.log`
- unresolved:
  - `qa/fullflow/request-xml/medicalmodv2.xml` 未採取
  - `/api/orca/official/patients/import` 500
  - `/api/orca/official/appointments/medical-information` 502
- main agent の統合判断:
  - evidence packaging は PASS、live fullflow は FAIL
- conflict 解消:
  - なし。current worktree 差分として保持。

### SA-24
- 要約: closeout bundle を `artifacts/orca-remediation/closeout/20260413T104000Z/` に整形し、runbook / cutover / managerdocs の drift を是正した。
- 主な changed files:
  - `docs/runbooks/release-validation.md`
  - `docs/releases/orca-remediation-cutover.md`
  - `docs/managerdocs/01_current_state_and_decision_rules.md`
  - `artifacts/orca-remediation/20260413T104000Z/qa/acceptmodv2/accept-summary.md`
  - `artifacts/orca-remediation/20260413T104000Z/qa/acceptmodv2/accept-summary.json`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/reports/final-report.md`
- tests / logs:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/git/*.txt`
  - `artifacts/orca-remediation/closeout/20260413T104000Z/grep/*.log`
- unresolved:
  - release verdict は FAIL のまま
- main agent の統合判断:
  - PASS as validation/docs sweep, but overall release remains blocked by G6
- conflict 解消:
  - なし

## 5. PR0〜PR6 判定表

| PR | 判定 | 根拠 | 閉じていない項目 |
| --- | --- | --- | --- |
| PR0 | PASS | `docs/contracts/orca-route-taxonomy.md`, `server-modernized/src/main/java/open/dolphin/rest/orca/AbstractOrcaRestResource.java`, `artifacts/orca-remediation/closeout/20260413T104000Z/tests/server-targeted.log` | なし |
| PR1 | PASS | `web-client/src/features/charts/ChartsActionBar.tsx`, `web-client/src/features/charts/__tests__/chartsActionBar.test.tsx`, `artifacts/orca-remediation/closeout/20260413T104000Z/tests/web-ci.log` | live fullflow では未実踏破 |
| PR2 | PASS | `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`, `server-modernized/src/test/java/open/dolphin/rest/PatientModV2OutpatientSupportTest.java`, `artifacts/orca-remediation/closeout/20260413T104000Z/tests/server-verify.log` | なし |
| PR3 | FAIL | `web-client/src/features/reception/receptionHandoff.ts`, `artifacts/orca-remediation/closeout/20260413T104000Z/qa/fullflow/summary.json`, `artifacts/orca-remediation/closeout/20260413T104000Z/qa/fullflow/steps.log` | live accept -> charts handoff を fullflow で閉じられていない |
| PR4 | PASS | `web-client/src/features/administration/__tests__/AdministrationPage.connection.test.tsx`, `web-client/src/features/administration/__tests__/AdministrationPage.internalWrapper.test.tsx`, `artifacts/orca-remediation/closeout/20260413T104000Z/tests/web-ci.log` | なし |
| PR5 | PASS | `web-client/src/features/charts/pages/ChartsPage.tsx`, `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`, `artifacts/orca-remediation/closeout/20260413T104000Z/grep/06-stale-wording.log` | なし |
| PR6 | FAIL | `docs/runbooks/release-validation.md`, `docs/releases/orca-remediation-cutover.md`, `artifacts/orca-remediation/closeout/20260413T104000Z/reports/final-report.md` | live fullflow fail, `medicalmodv2.xml` absent |

## 6. W1〜W6 coverage 判定表

| W | 判定 | 代表根拠 | 一言結論 |
| --- | --- | --- | --- |
| W1 | Closed | admin tests in `web-ci.log`, `docs/operations/ORCA_CERTIFICATION_ONLY.md` | admin wording / capability evidence は揃った |
| W2 | Still Open | `qa/acceptmodv2/accept-summary.json`, `qa/fullflow/summary.json` | reception runtime close は duplicate/test-data blocker で残る |
| W3 | Closed | patients tests in `web-ci.log`, `server-verify.log` | official create/update/import は source/tests で固定 |
| W4 | Closed | chart support tests in `web-ci.log` | contraindication / medication contract は source/test 上で整合 |
| W5 | Still Open | `qa/fullflow/summary.json`, `qa/fullflow/steps.log` | `medicalmodv2` live send と XML 採取が未達 |
| W6 | Closed | `docs/contracts/orca-route-taxonomy.md`, `orcaApiResultPolicy.ts`, charts wording tests | local-only naming / policy drift は閉じた |

## 7. G0〜G7 判定表

| Gate | 判定 | 根拠 | 一言結論 |
| --- | --- | --- | --- |
| G0 | PASS | `AbstractOrcaRestResource.java`, `PublicRouteInventoryContractTest.java`, `grep/01-route-taxonomy.log` | route/shared/audit taxonomy は固定 |
| G1 | PASS | patients tests in `web-ci.log`, `server-verify.log` | patients official flows は source/test で閉じた |
| G2 | PASS | `ReceptionPage.tsx`, `receptionHandoff.test.ts`, `grep/05-reception-legacy-helpers.log` | canonical handling は source/test で閉じた |
| G3 | PASS | `ChartsActionBar.tsx`, charts tests in `web-targeted.log` | chart hotpath の source/test drift は閉じた |
| G4 | PASS | administration tests in `web-ci.log` | admin semantics は evidence 化済み |
| G5 | PASS | charts wording tests, `grep/06-stale-wording.log` | local-only naming / support wording は閉じた |
| G6 | FAIL | `qa/fullflow/summary.json`, `qa/acceptmodv2/accept-summary.json`, `evidence/sa23-patient-import-01423.json` | full validation / live fullflow / final acceptance は未達 |
| G7 | PASS | `ChartsPage.tsx`, `MedicalOutpatientRecordPanel.tsx`, DADS-aligned tests | UI / DADS gate は閉じた |

## 8. 主要18論点 closure matrix

| 論点 | 判定 | 根拠 | 一言結論 |
| --- | --- | --- | --- |
| 1. audit taxonomy naming | Closed | `AbstractOrcaRestResource.java`, `grep/07-audit-actions.log` | `ORCA_OFFICIAL_* / ORCA_MASTER_* / LOCAL_*` に収束 |
| 2. shared ORCA Api_Result policy | Closed | `web-client/src/libs/orca/orcaApiResultPolicy.ts` | shared policy 化済み |
| 3. stale audit constants removal | Closed | `grep/07-audit-actions.log` | stale action 名は source から除去 |
| 4. display string reverse parse removal | Closed | `grep/05-reception-legacy-helpers.log` | helper hit 0 |
| 5. accept 21/60 mapping | Closed | `acceptmodv2Result.ts`, reception tests | result semantics は固定 |
| 6. `Medical_Information` optional send | Closed | runbook docs, reception tests | 未指定時未送信 contract を維持 |
| 7. canonical accept -> charts handoff in source | Closed | `receptionHandoff.ts`, tests | source/test 上は canonical key ベース |
| 8. canonical accept -> charts handoff in live run | Still Open | `qa/fullflow/summary.json` | duplicate/test-data blocker で live close 不可 |
| 9. `ChartsPage` から `ORCA 記録（要約）` 除去 | Closed | charts tests, `grep/06-stale-wording.log` | stale wording は source から消えた |
| 10. local summary を `<details>` に隠さない | Closed | `MedicalOutpatientRecordPanel.tsx` | DADS 違反を解消 |
| 11. local summary と official income 分離 | Closed | `ui-current-contract.md`, charts tests | wording / role を分離 |
| 12. patients official create/update/import 分離 | Closed | patients tests, `server-verify.log` | source/test で固定 |
| 13. admin wording / capability drift | Closed | admin tests, `grep/06-stale-wording.log` | stale wording は deny/assert test だけ |
| 14. `?patientId=` fallback 除去 | Closed | committed `qa-fullflow-weborca.mjs`, `grep/09-fullflow-routing.log` | qa-fullflow 自体から fallback を除去 |
| 15. `appendChild null` / screenshot-after-close | Closed | `session-auth.mjs`, node-check logs | repo-side helper defect を回避 |
| 16. evidence bundle packaging | Closed | `artifacts/orca-remediation/closeout/20260413T104000Z/` | third party 再読可能な束を作成 |
| 17. `/api/orca/official/patients/import` 500 | Still Open | `evidence/sa23-patient-import-01423.json` | repo-side defect が残る |
| 18. live `medicalmodv2.xml` 採取 | Still Open | `qa/fullflow/summary.json` | send 未到達で XML なし |

## 9. 実行コマンド一覧

### git / diff
- `git status --short`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git remote show origin`
- `git merge-base HEAD origin/main || git merge-base HEAD origin/master`
- `git diff --stat <merge-base>..HEAD`

### grep / rg
- `rg -n "/api/orca/official/|/api/orca/master/|/api/local/" web-client server-modernized docs`
- `rg -n "/api/orca/patient/mutation|chart/subjectives|/api/orca/order/bundles|/api/orca/prescription-orders" web-client server-modernized docs`
- `rg -n "medicalmodv23" web-client server-modernized docs`
- `rg -n "todayString\\(|\\?\\?\\s*today|Perform_Date" web-client server-modernized`
- `rg -n "resolveDepartmentCode|normalizeDepartmentCode|resolvePhysicianCodeSelection" web-client/src/features/reception`
- `rg -n "症状詳記（ORCA）|ORCAへ反映|今すぐ同期|認証済み|一括疎通（グループ）|ORCA 記録（要約）" web-client server-modernized docs`
- `rg -n "PATIENTMODV2_OUTPATIENT|OFFICIAL_PATIENT_CREATE|OFFICIAL_PATIENT_UPDATE|ORCA_PATIENT_SYNC|ACTION_PATIENT_SYNC|ORCA_APPOINTMENT_OUTPATIENT" web-client server-modernized`
- `rg -n "isApiResultOk\\(|resolveOrcaResultTone\\(|isOrcaSuccessResult\\(" web-client`
- `rg -n "\\?patientId=|patientId=\\$\\{|medicalmodv2" web-client/scripts web-client/src`

### tests / build
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,OrcaPatientApiResourceRunIdTest,OrcaAppointmentResourceTest,LocalOrderBundleResourceTest test`
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm test -- --run src/features/reception/__tests__/ReceptionPage.test.tsx src/features/reception/__tests__/receptionHandoff.test.ts src/features/charts/__tests__/MedicalOutpatientRecordPanel.test.tsx src/features/charts/__tests__/chartsActionBar.test.tsx src/features/charts/__tests__/chartsLocalSummarySemantics.test.tsx src/routes/__tests__/useAppNavigation.test.tsx`
- `cd web-client && npm run ci`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- `node --check web-client/scripts/qa-lib/session-auth.mjs`
- `node --check web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `node --check web-client/scripts/qa-fullflow-weborca.mjs`

### runtime / QA
- `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
- `cd web-client && node scripts/runtime-ready-smoke.mjs`
- `cd web-client && QA_PATIENT_ID=<current local-searchable patientId> node scripts/qa-acceptmodv2-weborca.mjs`
- `cd web-client && QA_PATIENT_ID=<current local-searchable patientId with unique active entry> node scripts/qa-fullflow-weborca.mjs`

## 10. テスト結果

- server:
  - targeted pass (`tests/server-targeted.log`)
  - static-analysis verify pass (`tests/server-verify.log`)
- web-client:
  - verify:web-guard pass (`logs/11_verify_web_guard.log`, copied as evidence summary via final report)
  - targeted pass (`tests/web-targeted.log`)
  - full ci pass (`tests/web-ci.log`)
- runtime-ready smoke:
  - PASS (`qa/runtime-ready/runtime-ready-result.json`)
  - reception -> charts open 自体は成立
- qa-acceptmodv2:
  - FAIL as live candidate gate
  - duplicate acceptance `apiResult=16`
- qa-fullflow:
  - FAIL
  - `reception row status=unknown`
  - `charts handoff status=error`
  - order save / send 未実行
- live ORCA:
  - live request は発生したが PASS ではない
  - `medicalmodv2.xml` なし

## 11. docs / mock / inventory / exposure / QA scripts 追随状況

- 更新:
  - `docs/runbooks/release-validation.md`
  - `docs/releases/orca-remediation-cutover.md`
  - `docs/managerdocs/01_current_state_and_decision_rules.md`
- 追随内容:
  - fixed seed `01415` 前提を削除
  - closeout bundle path を `artifacts/orca-remediation/closeout/<RUN_ID>/` に統一
  - blocker classification と request XML 採取条件を明文化
- source 差分との整合:
  - route/shared/policy/handoff/Charts wording は docs と source で一致
  - live fullflow の未達は docs で success と書かず blocker 扱いに変更

## 12. evidence bundle 一覧

- base artifact root:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/`
- git evidence path:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/git/`
- test logs path:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/tests/`
- grep logs path:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/grep/`
- qa/fullflow path:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/qa/fullflow/`
- qa/acceptmodv2 path:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/qa/acceptmodv2/`
- medicalmodv2.xml path:
  - not present; send step not reached
- final report path:
  - `artifacts/orca-remediation/closeout/20260413T104000Z/reports/final-report.md`

## 13. 重大な未完了事項

- Critical
  - `artifacts/orca-remediation/closeout/20260413T104000Z/qa/fullflow/summary.json`
  - live fullflow が `order save -> finish -> ORCA send` まで到達していないため、release close 条件を満たしません。
- High
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java:49`
  - runtime evidence `evidence/sa23-patient-import-01423.json` で `/api/orca/official/patients/import` が 500。患者 import を使った rerun の再建ができません。
- High
  - `web-client/scripts/qa-fullflow-weborca.mjs:85`
  - script は `QA_PATIENT_ID` 必須に修正済みですが、current facility で unique active entry を満たす live candidate を確保できていません。
- Medium
  - `artifacts/orca-remediation/closeout/20260413T104000Z/qa/fullflow/console.json`
  - `/api/orca/official/appointments/medical-information` の 502 が繰り返し発生しており、external blocker の切り分けはできたが解消は未了です。

## 14. 最終結論

- 再オープン推奨
- 最小残作業:
  - runtime:
    - current facility で local-searchable かつ重複受付にならない patient seed を確保する
    - same RUN 条件で `qa-acceptmodv2` -> `qa-fullflow` を再実行し、`medicalmodv2.xml` を採取する
  - server:
    - `/api/orca/official/patients/import` 500 の root cause を修正し、import rerun path を回復する
  - environment:
    - ORCA DB / appointments medical-information 502 を安定化し、external blocker が消えた状態で rerun する
