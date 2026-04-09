# ORCA 残タスク 受け入れマトリクス

## AC: 実装受け入れ条件

| ID | 受け入れ条件 | 確認方法 | 必須証跡 |
|---|---|---|---|
| AC-01 | Phase 0 decision table が全 disputed point を `confirmed mismatch / already conforming / not applicable` に分類している | `07_phase0_contract_freeze_checklist.md` を埋める | file:line 付き decision table |
| AC-02 | med usage の契約が `local-only persisted / outbound strip` に一本化されている | code + tests + help + notes | policy diff, smoke test, notes diff |
| AC-03 | med send path が usage の存在だけで fail しない | targeted test | client test log |
| AC-04 | med outbound payload / XML に usage row / usage carrier が出ない | client smoke + server XML test | test log |
| AC-05 | RP-level / drug-level claim comment に note UI がある | editor test | screenshot/log or test output |
| AC-06 | structured claim comment が save/fetch/source bundle で round-trip する | client tests | test log |
| AC-07 | structured claim comment の family carrier が correct | server/client tests | payload / XML assertions |
| AC-08 | unknown structured family が first-class save でも fail-close | client + server tests | test log |
| AC-09 | `speed` overclaim が消えている | grep + doc diff | grep output |
| AC-10 | canonicalization の独自 map/fallback が production path から消える | code review + grep | grep output + changed files |
| AC-11 | `放射線` / `\u653e\u5c04\u7dda` fallback が codebase から消える | grep | grep output |
| AC-12 | exact-class entities の `null classCode` が client/server で reject | client/server tests | test log |
| AC-13 | injection help / related tests が current runtime と一致 | file diff + tests | changed help/test files |
| AC-14 | `orderSendSmoke.test.ts` の radiology fixture が exact className に更新されている | file diff + test | changed test |
| AC-15 | `rejects bodyPart resurrection` が実ケースを使う | test code review | changed test |
| AC-16 | disputed family が mismatch なら修正済み、already conforming なら locking test 追加済み | Phase 0 + final diff | decision table + tests |
| AC-17 | targeted client tests が通る | command log | raw log |
| AC-18 | full client tests / build が通る | command log | raw log |
| AC-19 | targeted server tests が通る | command log | raw log |
| AC-20 | full server `test` / `verify` / `-Pstatic-analysis verify` が通る | command log | raw log |
| AC-21 | grep gate の説明不能 hit が 0 | grep output | raw log |
| AC-22 | Final Auditor が blocker 0 と判定 | audit report | audit memo |

## NR: 回帰禁止条件

| ID | 回帰禁止条件 | 確認方法 |
|---|---|---|
| NR-01 | injection admin/adminCode/adminMemo が ORCA wire に漏れない | smoke + XML test |
| NR-02 | selection comment `Item_Number / Item_Number_Branch` が outbound 不可のまま | client/server tests |
| NR-03 | radiology bodyPart は 700 のみ | bodyPart tests |
| NR-04 | bacteria local-only / send-block が崩れない | send-block tests |
| NR-05 | charge mixed-class reject が維持 | server tests |
| NR-06 | physiology send-block が維持 | smoke tests |
| NR-07 | exact class allow/block list が catalog と一致 | catalog tests |

## 推奨実行順

### client targeted
```bash
cd web-client
npm ci
npm run typecheck
npm run test:ci -- src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderEditorPanel.local-only.test.tsx src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx
npm run test:ci -- src/features/charts/__tests__/orderRpNormalization.test.ts src/features/charts/__tests__/orderSendSmoke.test.ts
npm run test:ci -- src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx
npm run test:ci -- src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleContract.test.ts src/features/charts/__tests__/otherOrderContract.test.ts src/features/charts/__tests__/orderRpRequirements.test.ts
npm run test:ci
npm run build
```

### server targeted
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaPrescriptionOrderResourceTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleMutationExecutionSupportTest,OrcaOrderBundleFetchSupportTest,OrcaOrderBundle600SubtypeSupportTest,OrcaOrderBundleMutationSupportTest,OrcaOrderBundleRecommendationSupportTest,OrcaOrderBundleResourceTest,OrcaChartSupportSupportTest,OrcaOrderBundleResource600Test -Dsurefire.failIfNoSpecifiedTests=false test
mvn -f pom.server-modernized.xml -pl server-modernized -am test
mvn -f pom.server-modernized.xml -pl server-modernized -am verify
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

## grep gate
```bash
rg -n "sendable-with-blocked-usage|medUsageBlocked" web-client/src
rg -n "\bspeed\b" web-client/src/features/charts server-modernized/src/main web-client/notes
rg -n "放射線|\u653e\u5c04\u7dda" web-client/src server-modernized/src/main web-client/notes
rg -n "800\.\.890|8\.\.\.\|18\.\.\." web-client/src server-modernized/src/main
rg -n "genericChangeAllowed:\s*true" web-client/src/features/charts/prescriptionOrderApi.ts
rg -n "className:\s*'Radiology'|rejects bodyPart resurrection" web-client/src/features/charts/__tests__
rg -n "missing_admin_code|unsupported_admin_memo" web-client/src/features/charts
rg -n "resolveCanonicalClassName|OrcaChargeClassCanonicalSupport|OrcaChargeClassSupport" server-modernized/src/main/java/open/dolphin/rest/orca
```
