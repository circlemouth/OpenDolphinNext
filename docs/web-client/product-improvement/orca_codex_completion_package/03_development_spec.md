# ORCA整合 完遂 開発仕様書

## 1. 目的

OpenDolphinNext の ORCA order 実装を、**現在コード** を基準に次の状態まで持っていく。

- source-of-truth が production path まで一本化されている
- order family ごとの contract が `save / send / server mutation / read / help / test` まで閉じている
- first-class prescription save と bundle path の rule が矛盾しない
- stale help / tests / notes / label が current behavior に同期している
- legacy fallback と broad rule が除去されている
- production-ready なコードになっている

## 2. 非交渉前提

- **後方互換性は不要**
- 過去の DB 遺産はない前提
- build 成果物や生成物は無視し、コードだけを見る
- `catalog に定義を足す` だけでは完了扱いにしない
- hidden report / 前回レビュー結果 / 外部メモを根拠にしない
- broad range / broad regex / legacy resurrection を温存しない
- local-only / import-only / sendable の境界を曖昧にしない

## 3. canonical current contract

### 3.1 entity 共通ルール
- canonical entity alias は client/server で 1 箇所へ集約する
- production path は中央 helper を参照し、重複 canonicalization を持たない
- local-only / import-only / sendable は entity ごとに明示する
- exact class allowlist / blocklist / className / classMode は中央 catalog を基準にする
- `Item_Number / Item_Number_Branch` は outbound 不可
- unknown structured comment family は reject
- broad range / broad regex は使わない

### 3.2 entity 別 contract

| entity | local save | local fetch | send | class policy | bodyPart | 備考 |
|---|---|---:|---:|---|---|---|
| medOrder | 可 | 可 | 可 | raw class 保持 | 不可 | tri-state generic flag、`genericChangeAllowed` round-trip、`85/831` family、usage send-block |
| injectionOrder | 可 | 可 | 可 | allow=`310/311/312/320/321/330/331/334/340/350`、block=`332/335/352` | 不可 | `admin/adminCode/adminMemo/speed` は local-only、wire 不可 |
| treatmentOrder | 可 | 可 | 可 | allow=`400/401/402/403/409`、class-aware | 不可 | `400/409` は procedure-capable、`401/402/403` は class-aware standalone |
| surgeryOrder | 可 | 可 | 可 | allow=`500/501/502/510`、block=`520/540/541/542`、class-aware | 不可 | `501/502` standalone、rowRole semantics 単一化 |
| testOrder | 可 | 可 | 可 | allow=`600/601/602/603/610`、reject=`640/643` を save/send/server 共通化 | 不可 | class-aware grammar |
| physiologyOrder | 可 | 可 | 不可 | `classCode=600` exact | 不可 | import-only + local save/fetch 可 + send-block |
| bacteriaOrder | 可 | 可 | 不可 | ORCA class send なし | 不可 | local-only + `830/842` structured family のみ round-trip |
| radiologyOrder | 可 | 可 | 可 | allow=`700/701/702/703/704/731/732`、block=`710..724`、class-aware | `700` のみ可 | `700` 以外は bodyPart 不可、legacy 002 resurrection 不可 |
| baseChargeOrder | 可 | 可 | 可 | exact=`110/114/120/124` | 不可 | mixed-class bundle reject |
| instractionChargeOrder | 可 | 可 | 可 | exact=`130/132/133/140/141/142/143/148/149` | 不可 | mixed-class bundle reject |
| otherOrder | 可 | 可 | 不可 | **legacy ORCA range を持たない explicit local-only contract** | 不可 | `800..890` / `8...|18...` 廃止 |

### 3.3 comment family contract
- family 解決は prefix family helper に統一する
- bundle path と first-class prescription save path の両方で同じ fail-close を使う
- supported family で required value がない場合は reject
- unknown structured family は reject
- `Item_Number / Item_Number_Branch` 付き選択コメントは local-only で保存しても outbound しない

## 4. 現在の未完了クラスタ

### 4.1 source-of-truth 未一本化
対処必須:
- client/server に重複した entity canonicalization が残っている
- server に charge / radiology canonicalization の独自 map が残っている
- input-set metadata に broad fallback が残っている
- `放射線` hardcode が UI / fixture / tests に残っている
- comment family 判定の regex 直書きが production path に残っている
- otherOrder save-side 契約に legacy range が残っている

### 4.2 prescription / comment family
対処必須:
- first-class prescription save で unknown structured family reject が抜けている
- `genericChangeAllowed` が source helper round-trip で消える
- RP-level structured claim comment note が source bundle で壊れる

### 4.3 family contract closure
対処必須:
- surgery `501/502` standalone を generic main-row rule が潰している
- surgery rowRole semantics が validation / persistence / fetch で分裂
- test save validator が allowlist fail-close になっていない
- physiology local save が block されたまま
- physiology `classCode=600 exact` が help にしかない
- bacteria read fallback が `830/842` 以外も metadata 化する
- radiology bodyPart UI が全 class で出る
- legacy `002` bodyPart resurrection が read/display/fetch に残る
- treatment も read/display の resurrection により閉じ切っていない

### 4.4 help / docs / tests
対処必須:
- injection help text が stale
- `orderBundleOrcaSupport.test.tsx` が stale help を固定
- `orderBundleBodyPart.test.tsx` が treatment bodyPart 受理前提
- radiology notes / fixtures に stale wording が残る
- dead code / unused helper が残る

## 5. 実装ストリーム

## Stream A: SoT / canonicalization / broad rule 除去
### 目的
rule table と canonicalization を中央化し、production path から重複を剥がす。

### 変更方針
1. client
   - `orderCategoryRegistry.ts` の entity canonicalization を `resolveCanonicalOrcaOrderEntity` へ委譲
   - radiology label hardcode を registry / catalog 参照へ寄せる
   - `otherOrderContract.ts` の legacy range/regex を廃止
2. server
   - `OrcaMedicalClassCatalog.normalizeEntity()` を唯一の canonicalization 入口にする
   - `prescriptionOrder -> medOrder` alias をここに追加
   - `OrcaOrderBundleRequestSupport.canonicalizeEntity` 相当の重複を除去
   - `OrcaChargeClassSupport` / `OrcaChargeClassCanonicalSupport` の map を廃止または catalog 委譲だけにする
   - `OrcaOrderInputSetMetadataSupport` の `200..299` / `300..399` fallback を削除
   - comment family regex 直書きを `OrcaCommentCarrierRules` に寄せる

### 終了条件
- production path で中央 helper 以外の canonicalization / class map / broad fallback が残っていない
- `放射線` hardcode が UI / tests / docs から除去されている

## Stream B: first-class prescription save / medOrder source helper 修復
### 目的
bundle path だけでなく prescription save path でも fail-close を成立させ、source helper 意味論を壊さない。

### 変更方針
1. `prescriptionOrderApi.ts`
   - unknown structured family reject を追加
   - `StoredDrugMeta` に `genericChangeAllowed` を保持
   - `normalizeDrugMeta()` / `toDrugFromItem()` / `toSourceBundlesFromServerOrder()` で round-trip
   - `StoredRpMeta` に RP-level claimComments を保持
   - `toOrderBundleItems()` / `toRpFromBundle()` / send bundle build で `85/831` note を維持
2. `OrcaPrescriptionOrderResource.java`
   - unknown structured family reject を追加
   - bundle path と同じ family helper / fail-close を使用
3. tests
   - unknown family reject
   - `genericChangeAllowed` round-trip
   - RP-level structured note round-trip

### 終了条件
- first-class prescription save と bundle path が family rule で一致
- `genericChangeAllowed` と RP-level structured note が往復で失われない

## Stream C: family contract closure
### C-1 treatment
- exact class allowlist を維持
- `400/409` と `401/402/403` の class-aware grammar を save/send/server に統一
- legacy `002` bodyPart resurrection を client/server read/display から削除
- help/test も reject 契約に揃える

### C-2 surgery
- `500/501/502/510` allow, `520/540/541/542` block を維持
- `501/502` を standalone として main-row 非必須にする
- rowRole resolver を validation / persistence / fetch で 1 本化
- `material` が path により通る/落ちる差をなくす

### C-3 test
- save/send/server すべて同じ exact allowlist fail-close を使う
- `640/643` reject に加え、allowlist 外全体 reject を save でも担保
- read/display の legacy 002 resurrection を消す

### C-4 physiology
- client local save hard-block を撤去
- import-only + local save/fetch 可 + send-block を実装
- `classCode=600 exact` を client/server で強制
- bodyPart 不可、legacy resurrection 不可

### C-5 bacteria
- local-only + local save/fetch 可 + send-block を維持
- `830/842` family だけを metadata 化・保存・再取得
- read fallback で他 family を metadata 化しない
- mutation writer も `830/842` 以外を emit しない

### C-6 radiology
- exact allow/block を維持
- bodyPart は `700` のみ
- UI bodyPart search も `classCode===700` のときだけ表示
- legacy `002` bodyPart resurrection を client/server から削除
- className / label / docs / tests を exact class map に揃える

### C-7 otherOrder
- legacy ORCA shape (`800..890` / `8...|18...`) を廃止
- local-only + send-block に必要な明示的契約を client/server で 1 つにする
- acceptable end state:
  - ORCA-shaped validationを持たない完全 local-only bundle
  - もしくは 1 箇所に定義した explicit local-only sentinel 契約
- unacceptable end state:
  - broad range / regex を残したまま「client/server で一致」と言うこと

## Stream D: help / docs / tests / dead code
### 目的
コードが直っても説明とテストが古いまま残る状態を防ぐ。

### 必須変更
- `OrderBundleEditPanel.tsx` の injection help text を current wire contract に合わせる
- `orderBundleOrcaSupport.test.tsx` を同期
- `orderBundleBodyPart.test.tsx` を reject 契約に更新
- radiology notes を exact class map に合わせる
- `放射線` fixture / label を `画像診断` に統一
- 未使用 helper (`isSendableInjectionAdminCode` など) は使うか削除する

## 6. 変更対象ファイルの優先度

### P0（最優先）
#### client
- `src/features/charts/orcaMedicalClassCatalog.ts`
- `src/features/charts/orderCategoryRegistry.ts`
- `src/features/charts/orderBundleContract.ts`
- `src/features/charts/orderRpNormalization.ts`
- `src/features/charts/OrderBundleEditPanel.tsx`
- `src/features/charts/prescriptionOrderApi.ts`
- `src/features/charts/bacteriaOrderSupport.ts`
- `src/features/charts/orderDetailDisplayViewModel.ts`
- `src/features/charts/orderDetailFormatters.ts`
- `src/features/charts/otherOrderContract.ts`

#### server
- `src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- `src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundle600SubtypeSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaChargeClassSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaChargeClassCanonicalSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`

### P1（同スプリントで完了）
#### client tests
- `src/features/charts/__tests__/prescriptionOrderApi.test.ts`
- `src/features/charts/__tests__/orderRpNormalization.test.ts`
- `src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
- `src/features/charts/__tests__/orderBundleBodyPart.test.tsx`
- `src/features/charts/__tests__/orderSendSmoke.test.ts`
- `src/features/charts/orderBundleApi.600-subtype.test.ts`
- `src/features/charts/OrderBundleEditPanel.600-subtype.test.tsx`

#### server tests
- `src/test/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResourceTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupportTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupportTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupportTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundle600SubtypeSupportTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupportTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupportTest.java`
- `src/test/java/open/dolphin/rest/orca/OrcaOrderBundleResourceTest.java`

### P2（同時に締める）
- `web-client/notes/orca-order-remediation-20260403.md`
- `web-client/notes/orca-order-contract-cleanup-20260404.md`
- `web-client/notes/radiology-order-canonical-contract-20260404.md`
- `src/features/charts/OrderDockPanel.tsx`
- `src/features/charts/StampLibraryPanel.tsx`
- `src/features/charts/PastHubPanel.tsx`
- `src/features/charts/OrderRecommendationModal.tsx`

## 7. 実装順序

### Phase 1
- SoT / canonicalization / broad rule / radiology label
- comment family helper 共通化
- first-class prescription save fail-close の土台

### Phase 2
- medOrder source helper (`genericChangeAllowed`, RP-level note)
- first-class prescription save 完了
- targeted prescription tests 実行

### Phase 3
- treatment / surgery / test / physiology / bacteria / radiology / other
- rowRole 単一化
- legacy 002 resurrection 削除
- targeted order bundle tests 実行

### Phase 4
- help / docs / stale tests / fixtures / dead code
- full tests / build / grep gate / final audit

## 8. コーディング原則
- explicit allowlist / blocklist / classMode を優先
- helper は「追加」ではなく「唯一の参照先」にする
- rule が複数箇所に必要なら共通化し、片側だけにコピペしない
- rowRole / bodyPart / comment family は UI 層・send 層・server 層で意味を統一する
- fail-close を徹底する
- local-only 情報は payload / XML に出さない
- import-only entity は send しないが local save/fetch 契約は明示する

## 9. Definition of Done
以下を全部満たしたら完了。
1. `04_verification_matrix.md` の全項目が達成
2. client/server で重複 canonicalization / broad rule / stale label が消えている
3. first-class prescription save と bundle path の family rule が一致
4. surgery rowRole、physiology local save、bacteria strict read、radiology 700 only が閉じている
5. legacy `002` bodyPart resurrection が read/display/fetch から消えている
6. stale help / docs / tests が同期
7. targeted tests / full tests / build / typecheck / verify が通る
8. 未解決ゼロ
