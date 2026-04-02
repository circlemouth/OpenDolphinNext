# ORCA Order Remediation Notes (2026-04-03)

- RUN_ID: `20260402T233022Z`
- Scope: ORCA オーダーの canonical rule、送信前 block、処方 first-class DTO、bodyPart/adminCode/unit 契約の是正。

## Canonical Rules

- `testOrder` を 600 系 canonical entity とし、`laboTest` は ingress alias に限定する。
- `treatmentOrder` を 400 系 canonical entity とし、`generalOrder` は ingress alias に限定する。
- charge 系は `classCode / classCodeSystem / className` を entity default 再計算ではなく first-class 値として保持する。
- `rpNumber` は stable RP identifier とし、`Medical_Class_Number` と分離する。
- `genericFlg` は廃止し、`isGeneralNamePrescription` と `genericChangeAllowed` に分離する。

## Send Vs Local-only

### ORCA に送る

- `unit`
- `classCode / classCodeSystem / className`
- `admin / adminCode / adminCodeSystem` (`medOrder`, `injectionOrder`)
- `bodyPart` (`radiologyOrder` と bodyPart 対応 bundle)
- 処方の `rpNumber`, `medicalClass`, `medicalClassNumber`, `usageCode`, `usageName`
- 処方 drug の `genericChangeAllowed`, `isGeneralNamePrescription`, `drugComment`, `claimComments`

### local-only

- `bundleName`
- `startDate`
- free-form `memo`
- free-form `item.memo`
- 構造化 first-class field に昇格していない院内補助情報

## 主要変更ファイル

- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/orderRpRequirements.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `web-client/src/features/charts/prescriptionOrderApi.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationCollectorSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationFlowSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`
- `docs/web-client/product-improvement/orca-order-remediation-checklist.md`

## Test Commands

- `npm --prefix web-client test -- --run src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx`
  - Result: `3 files / 9 tests passed`
- `npm --prefix web-client test -- --run src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderBundleApi.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderCategoryRegistry.test.ts src/features/charts/__tests__/orderDockPanel.state-compat-and-rp-regression.test.tsx src/features/charts/__tests__/orderRpNormalization.test.ts src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx src/features/charts/__tests__/orderBundleBodyPart.test.tsx`
  - Result: `10 files / 73 tests passed`
- `npm --prefix web-client test -- --run src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderBundleApi.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderCategoryRegistry.test.ts src/features/charts/__tests__/orderDockPanel.state-compat-and-rp-regression.test.tsx src/features/charts/__tests__/orderRpNormalization.test.ts src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx`
  - Result: `9 files / 59 tests passed`
- `npm --prefix web-client run typecheck`
  - Result: `passed`
- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleBodyPart.test.tsx`
  - Result: `1 file / 6 tests passed`
- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderBundleValidation.test.ts`
  - Result: `3 files / 44 tests passed`
- `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportSupportTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleResourceTest,OrcaOrderBundleMutationSupportTest,OrcaOrderBundleRecommendationSupportTest test`
  - Result: `30 tests passed`
- `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaOrderInputSetMetadataSupportTest test`
  - Result: `2 tests passed`
- `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaChartSupportSupportTest,OrcaOrderBundleRequestSupportTest,OrcaOrderBundleResourceTest,OrcaOrderBundleMutationSupportTest,OrcaOrderBundleRecommendationSupportTest,OrcaOrderInputSetMetadataSupportTest,OrcaPrescriptionOrderImportSupportTest test`
  - Result: `38 tests passed`

## Remaining Risks

- charge 系の explicit class meta を end-to-end で固定する専用回帰がまだ薄い。
- row role / subtype / comment parameter の first-class 化は未完了。
- `save -> fetch -> normalize -> XML` の単一 smoke suite はまだ無い。
- 600 系 subtype、charge、radiology row role の網羅テストは追加余地がある。
- `OrderBundleEditPanel` の item row key は連番を混ぜて衝突しにくくしたが、row identity の責務を component-local id allocator に寄せる余地は残る。
