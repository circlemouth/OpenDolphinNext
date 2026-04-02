# ORCAオーダー是正 サブエージェント用プロンプト集

> 各サブエージェントは、担当範囲以外へ広げすぎず、必要最小限の横断変更だけを提案する。最終統合と競合解消は統括エージェントが行う。

---

## Agent A: canonical / 共通データモデル

あなたは ORCAオーダー是正の **canonical/entity/class・共通データモデル担当** です。

### 目的

- `testOrder / laboTest` の canonical 化
- `generalOrder / treatmentOrder` の canonical 化
- charge class meta の保持
- `bodyPart` / `adminCode` / row role / subtype / comment parameter / `setCode` provenance の共通方針策定と実装
- hidden field / silent drop の共通ルール整備

### 主対象ファイル

- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/orderRpRequirements.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`

### 必須達成項目

- 決定ログを埋めるための canonical proposal を作る
- mixed coded/uncoded と code-less row の共通 block 方針を実装する
- non-med class meta を form state で保持できるようにする
- 共通 XML/local-only 契約に必要な型変更を提案する
- 担当テストを追加する

---

## Agent B: 処方

あなたは ORCAオーダー是正の **処方担当** です。

### 目的

- 処方 save/send source of truth 一本化
- `genericFlg` の意味分離
- `rpNumber` 一意化
- input set 取込での RP semantics 維持
- `unit`、RPコメント、doctorComment、claim note、補助属性の扱い整理

### 主対象ファイル

- `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `web-client/src/features/charts/prescriptionOrderApi.ts`
- `web-client/src/features/charts/orderBundlePrescription.ts`（存在する場合）
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionOrderRepository.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderImportSupport.java`
- 関連 test 一式

### 必須達成項目

- 保存した処方がそのまま送信 payload に出るようにする
- `genericFlg` を 2 概念に分離する
- `rpNumber` を RP 識別子として一意にする
- `221/222/231/232` と input set の意味を壊さない
- `unit` と補助属性の送信方針を実装または閉じる
- 処方 happy path の save/fetch/send/XML テストを追加する

---

## Agent C: 注射

あなたは ORCAオーダー是正の **注射担当** です。

### 目的

- `admin` と `adminCode` の分離
- route / timing / frequency / speed / no-procedure の整理
- 点滴セット・手技+薬剤・薬剤のみの role 保持
- 注射 generic/comment/unit の round-trip 是正

### 主対象ファイル

- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/orderRpRequirements.ts`
- `web-client/src/features/charts/orcaOrderItemMeta.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- 関連 test 一式

### 必須達成項目

- sentinel memo に依存しない注射 no-procedure 実装か、機能削除のどちらかへ寄せる
- `adminCode` を first-class にする
- 注射の happy path を save/fetch/send/XML で成立させる
- mixed coded/uncoded row の silent drop をなくす
- 注射 unit / generic / comment の扱いを固定する

---

## Agent D: 400/700/800 系

あなたは ORCAオーダー是正の **処置・一般・その他・放射線担当** です。

### 目的

- `generalOrder / treatmentOrder` 整理
- 400 / 800 系の row role 保持
- radiology bodyPart / 本体 / 造影 / 材料の整合
- `otherOrder` の逃げ道化解消
- code-less row の block

### 主対象ファイル

- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`
- 関連 test 一式

### 必須達成項目

- `generalOrder` の canonical meaning を決めて実装へ落とす
- radiology の bodyPart を単一ソース化する
- 700 束の成立条件を validation へ入れる
- 400 / 800 系で role が潰れないようにするか、未対応入力を閉じる
- 種別ごとの save/fetch/send/XML テストを追加する

---

## Agent E: 600 系

あなたは ORCAオーダー是正の **検体・生理・細菌担当** です。

### 目的

- `testOrder / laboTest` canonical 化
- class 600 input set の整合
- specimen / culture / sensitivity / physiology subtype の扱い整理
- hidden bodyPart / hidden adminMemo の解消

### 主対象ファイル

- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/RightUtilityDrawer.tsx`
- `web-client/src/features/charts/SoapNotePanel.tsx`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
- 関連 test 一式

### 必須達成項目

- canonical entity を save / fetch / input set / send で統一する
- 600 系 subtype の意味を保持できるようにするか、UI を閉じる
- bacteria / physiology の最低限必要な入力を定義し validation に入れる
- 600 系の happy path と input set テストを追加する

---

## Agent F: テスト / XML / QA

あなたは ORCAオーダー是正の **テスト・XML・QA 担当** です。

### 目的

- actual XML テスト追加
- mock 依存を減らした統合テスト追加
- `save → fetch → normalize → XML` の smoke 整備
- `40/40` grouping や `Medical_Class` 粗粒度化の監視テスト追加

### 主対象ファイル

- `web-client/src/features/charts/__tests__/*`
- `server-modernized/src/test/java/open/dolphin/rest/orca/*`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `web-client/scripts/*`（必要な smoke 追加時のみ）

### 必須達成項目

- client の builder mock だけでは見えない欠陥を、server actual XML テストで捕捉する
- 代表 6 ケース（処方 / 注射 / charge / 400-800 / radiology / 600系）を追加する
- mixed coded/uncoded、bodyPart、unit、adminCode を含む否定/正例テストを揃える
- 最終的な test 実行コマンドと結果を統括へ返す
