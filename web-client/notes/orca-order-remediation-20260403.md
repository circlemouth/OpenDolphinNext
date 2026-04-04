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

- `classCode / classCodeSystem / className`
- `admin / adminCode / adminCodeSystem` (`medOrder`, `injectionOrder`)
- `bodyPart` (`radiologyOrder` と bodyPart 対応 bundle)
- 処方の `rpNumber`, `medicalClass`, `medicalClassNumber`, `usageCode`, `usageName`
- 処方 RP の `claimComments`
- 処方 drug の `genericChangeAllowed`, `isGeneralNamePrescription`, `drugComment`, `claimComments`

### local-only

- `bundleName`
- `startDate`
- `unit`
- 600系の `admin`（検査指示）
- free-form `memo`
- free-form `item.memo`
- 注射の `adminMemo`
- 処方の `prescriptionSettings` / `remarks`
- 構造化 first-class field に昇格していない院内補助情報

## Injection Recheck (`20260403T142706Z`)

- 注射は `admin/adminCode` を sendable、`memo/adminMemo/speed/route/timing/frequency` と行コメントを local-only に固定した。
- `recent usage` 由来の自由入力は `adminCode=''` のまま保持されるが、保存前 validation で fail-closed に止める。
- `classCode=310` 以外の `injectionOrder` は client/server とも reject に固定した。
- `genericFlg` は preserve-only で、editor の read-only 表示と comment 編集時の hidden meta 保持をテストで固定した。
- editor round-trip は `薬剤のみ / 手技+薬剤 / material+drug` の 3 経路で `rowRole` 保持を確認済み。

## 600系 Recheck (`20260403T142706Z`)

- `testOrder` / `physiologyOrder` は `admin / adminMemo / memo / item.memo / subtype` を save では保持しつつ、ORCA 送信は `classCode 600 + coded row` のみを使う local-only 契約で確定した。`admin` は UI 上も「院内」明示へ寄せ、silent drop を撤廃した。
- `bacteriaOrder` は `subtype` を first-class で保持するが、carrier 未対応のため `prepareMedicalModV2SendData` で `unsupported_bacteria_subtype` を返して fail-closed に止める。
- 600系 bundle の `admin / subtype / adminMemo / memo` は bundle 共通情報としてのみ扱い、複数項目を 1 bundle に積んでも item 個別 carrier は持たせない。
- `physiologyOrder` の識別は `Medical_Class_Name` 依存ではなく、entity 別 default subtype と stamp token 復元で固定されている。
- `medicalmodv2` の request 一覧にない `Medication_Unit_Code` / `Medication_Unit_Code_Name` は送信しない。単位は保存・表示専用で、ORCA payload/XML には含めない。internal JSON からも除外し、request contract 自体を送信可能 field のみに絞った。
- `otherOrder` の server/client hardening は `etensu category 8` 契約に合わせ、`8...` に加えて既存 smoke で使っている `18...` も許容する形へ補正した。
- 600系の複数 item/comment XML 網羅と `input set -> save -> fetch -> send` smoke を追加し、複数検査項目 + コメントコードでも崩れないことを固定した。

## ORCA official spec basis (`20260404T002958Z`)

- API overview では `/api21/medicalmodv2` が「中途データ登録/削除/変更」の official endpoint として定義されている。
- `medicalmodv2` request 一覧の `Medical_Information` 配下は `Medication_Code / Medication_Name / Medication_Number / Medication_Generic_Flg` までで、`Medication_Unit_Code*` は列挙されていない。
- `85XXXXXXX / 831XXXXXX` コメントコード補足では、中途データ登録側の carrier は `Medication_Code` と `Medication_Number` のみで説明されている。600系コメント行はこの carrier を使う。

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
- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx src/features/charts/__tests__/orderBundleItemActions.test.tsx`
  - Result: `3 files / 74 tests passed / 1 skipped`
- `npm --prefix web-client test -- --run src/features/charts/__tests__/orderBundleItemActions.test.tsx src/features/charts/__tests__/orderSendSmoke.test.ts src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderRpNormalization.test.ts`
  - Result: `4 files / 74 tests passed / 1 skipped`
- `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaOrderBundleRequestSupportTest,OrcaOrderBundleResource600Test test`
  - Result: `19 tests passed`

## Remaining Risks

- charge 系の explicit class meta を end-to-end で固定する専用回帰がまだ薄い。
- row role / subtype / comment parameter の first-class 化は未完了。
- `save -> fetch -> normalize -> XML` の単一 smoke suite はまだ無い。
- 600 系 subtype、charge、radiology row role の網羅テストは追加余地がある。
- `OrderBundleEditPanel` の item row key は連番を混ぜて衝突しにくくしたが、row identity の責務を component-local id allocator に寄せる余地は残る。

## Prescription 3-x Inventory

### 3-1. RP-level comment semantics

- `PrescriptionRp.claimComments`: 実装済み。`web-client/src/features/charts/prescriptionOrderApi.ts` と `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx` で RP first-class field を保持し、UI でも編集できる。
- input set `bundle.memo -> remark`: 実装済み。`toRpFromInputSetDetail()` で `detail.memo` を `remark` へ取り込む。`prescriptionOrderEditorPanel.orca-support.test.tsx` で確認済み。
- `rp.doctorComment` と order-level `doctorComment` の分離: 不足。first-class DTO は別 field を持つが、`prescriptionOrderApi.test.ts` の fetch/no-op save 系が赤く、互換 bundle 経路での round-trip は未閉塞。
- comment row を先頭薬剤へ寄せる暫定変換: editor/import 側は解消済み。recommendation と input set は RP-level へ格納するようになった。`save/fetch/send` まで通す API テストは未 green。
- 区分:
  `sendable`: RP-level `claimComments`
  `local-only`: `remark`, `doctorComment`
  `reject`: code なし RP-level claim comment
- 必要テスト:
  `prescriptionOrderApi.test.ts` の save/fetch/no-op save を RP-level claim comment 前提で green 化
  `orderSendSmoke.test.ts` に RP-level claim comment を含む `save -> fetch -> normalize -> send -> XML`

### 3-2. 一般名相当 / 後発品可否

- UI 方針: 実装済み。`PrescriptionOrderEditorPanel.tsx` に `銘柄指定/一般名指定` と `後発変更 可/不可` の独立トグルがある。
- first-class round-trip: editor 保存 payload は通る。`prescriptionOrderEditorPanel.orca-support.test.tsx` で `genericChangeAllowed` と `isGeneralNamePrescription` の独立保存を確認済み。
- `sourceBundles` compat: 不足。`StoredDrugMeta.isGeneralNamePrescription` を保持するコードは入れたが、`prescriptionOrderApi.test.ts` の既存 fetch/no-op suiteが赤いので互換経路の証明は未完。
- 区分:
  `sendable`: `genericChangeAllowed`, `isGeneralNamePrescription`
  `local-only`: なし
  `reject`: なし
- 必要テスト:
  `prescriptionOrderApi.test.ts` の sourceBundles 互換ケースを green 化
  `orderSendSmoke.test.ts` に一般名指定ありケースを追加

### 3-3. free-text usage / lower* / numberCode / supplemental sections

- free-text usage: 方針は `reject`。editor validate と `savePrescriptionOrder()` の両方で `usageCode` 未確定を block する。`prescriptionOrderEditorPanel.orca-support.test.tsx` の block は green。
- `lower*`: DTO / server payload 上の carrier は存在するが、回帰テストが不足。`prescriptionOrderApi.test.ts` の既存 suite 自体が赤く、完了扱い不可。
- `prescriptionSettings` / `remarks`: DTO と server payload には field があるが、green な round-trip 証明が未完。
- `numberCode`: 実装根拠が repo 内に見当たらない。方針未確定。
- 区分:
  `sendable`: `usageCode`, `lower*`（carrier はある）
  `local-only`: `remarks`, `prescriptionSettings` は現状 UI 非編集の preserve-only 表示方針
  `reject`: free-text usage without `usageCode`
- 必要テスト:
  `prescriptionOrderApi.test.ts` の fetch/no-op save 赤ケースを green 化
  class `211/221/222/231/232` を実 XML まで通す smoke 拡張

## Prescription Test Status

- green: `npm --prefix web-client test -- --run src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx`
- red: `npm --prefix web-client test -- --run src/features/charts/__tests__/prescriptionOrderApi.test.ts src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx`
  現状の失敗点:
  `buildPrescriptionMutationOperations()` が RP-level claim comment を bundle item 化していない期待との差分
  `fetchPrescriptionOrder()` / no-op save で `doctorComment` と RP-level fields の round-trip が未閉塞
  `sourceBundles` compat 経路の一般名指定・RP-level comment 保持が未証明
