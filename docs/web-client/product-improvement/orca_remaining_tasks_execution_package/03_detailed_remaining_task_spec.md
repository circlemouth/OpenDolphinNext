# ORCA残タスク 詳細実装仕様書

## 1. この仕様書の役割

この仕様書は、最新の再検証で残件と判定された論点を **そのまま実装タスクに落とした最終仕様** である。
Codex はこの文書を source of truth として扱い、曖昧な解釈をしないこと。

## 2. 非交渉ルール

- 後方互換は不要
- 過去の DB 遺産はない前提
- build 生成物は無視し、コードだけを見る
- broad range / broad regex / legacy fallback / resurrection は残さない
- local-only / import-only / sendable の境界は曖昧にしない
- 「helper を追加しただけ」で production path が古いままなら未完了
- current contract は `save / send / server mutation / read / help / test` が全部一致してはじめて成立
- 既に解消済みとみなせる領域を壊さない

## 3. 今回の最終 expected current contract

## 3.1 entity 共通ルール
- entity canonicalization は client/server とも中央 helper に統一する
- charge / radiology canonicalization は catalog 委譲に一本化する
- `Item_Number / Item_Number_Branch` は outbound 不可を維持する
- unknown structured family reject は既存の解消状態を維持する
- help / notes / tests は current behavior と同期する

## 3.2 今回修正が必要な entity contract

### medOrder
- raw class 保持は維持
- tri-state generic flag と `genericChangeAllowed` round-trip は維持
- RP-level structured claim comment `note` は source bundle 経由でも失われない
- usage 系フィールドは **local-only** として保持してよいが、**wire には出さない**
- send path / ORCA payload / XML build は usage row を作らない
- server は usageCode/adminCode を ORCA-wire 必須項目として要求しない

### injectionOrder
- allow=`310/311/312/320/321/330/331/334/340/350`
- block=`332/335/352`
- `admin/adminCode/adminMemo/speed` は local save/fetch では保持可能
- ただし send path / ORCA payload / XML build では一切使わない
- synthetic admin row を作らない
- server validation は「admin があるなら adminCode 必須」のような wire 前提ロジックを持たない
- bodyPart は引き続き reject

### otherOrder
- local-only + send-block を維持
- save-side は legacy `800..890` / `8...|18...` shape を廃止
- **explicit local-only contract** に置き換える
- numeric ORCA-like class range で妥当性判定しない
- ORCA send normalization / XML build / ORCA className resolution の対象外

### surgeryOrder
- allow=`500/501/502/510`
- block=`520/540/541/542`
- `501/502` は standalone 扱いで、generic main-row 必須にしない
- rowRole semantics は validation / persistence / fetch / display で一致させる
- `material` を path ごとに `main` / `auxiliary` / `material` に揺らさない

### testOrder
- allow=`600/601/602/603/610`
- reject=`640/643`
- save / send / server のどこかだけ strict ではなく、**共通 fail-close** にする
- allowlist 外全体 reject を save でも担保する

## 3.3 no-regression で守る領域

以下は current code で概ね成立している前提で、壊してはいけない。

- physiology: import-only + local save/fetch 可 + send-block + `classCode=600 exact`
- bacteria: local-only + local save/fetch 可 + send-block + `830/842` strict
- radiology: exact allow/block、bodyPart は `700` のみ
- selection comment の `Item_Number / Item_Number_Branch` outbound block
- first-class prescription の unknown structured family reject
- `genericChangeAllowed` の round-trip

## 4. タスク仕様

# Task P0-01: injection local-only wire-off を end-to-end で閉じる

## 背景
現状は policy では local-only なのに、send 正規化と server validation がまだ `admin/adminCode` を wire 前提で扱っている。

## 期待する最終状態
- local save/fetch では `admin/adminCode/adminMemo/speed` を保持できる
- send path ではそれらを payload 化しない
- ORCA XML にはそれらが一切出ない
- server は injection の `admin/adminCode` を ORCA-wire 必須項目として扱わない
- help / tests もこの挙動を説明する

## client 実装指示
### `web-client/src/features/charts/orcaSendabilityPolicy.ts`
- injection の local-only field 定義を authoritative source として維持
- sendable 必須項目として扱っている箇所があれば除去

### `web-client/src/features/charts/orderRpNormalization.ts`
- injection entity では `admin/adminCode/adminMemo/speed` を send row 生成に使わない
- injection send bundle の先頭に usage/admin row を prepend しない
- injection send payload に local-only field を残さない
- injection bodyPart reject は維持
- blockedClasses `332/335/352` は維持

### `web-client/src/features/charts/orderBundleContract.ts`
- injection local save では local-only field を許容する
- ただし wire contract の required field と混同しない

### `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- validation/guidance を local-only 契約に合わせる
- help text を「local 保存用。ORCA outbound には含めない」に修正

## server 実装指示
### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- injection の `admin -> adminCode required` ロジックを削除
- injection local-only field を sendability validation に使わない
- local save path では optional local metadata として受ける

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- injection local-only field を local persistence に残す
- claim item / ORCA wire 用 row へ変換しない

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
- local-only field を local fetch へ戻す
- ORCA wire builder が再び参照しないよう責務を分離

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- injection admin 系 carrier を emit しない状態を維持
- 追加 carrier を作らない

## tests 実装指示
- injection local save/fetch round-trip test
- injection send smoke で `admin/adminCode/adminMemo/speed` が payload に出ない test
- server mutation test で `admin` 単独でも validation error にしない test
- help text snapshot/text test

## 受け入れ条件
- local save/fetch OK
- send payload/XML に local-only field が 0
- `adminCode required` 系 server validation が消える
- stale help/test が消える

---

# Task P0-02: med usage send-block を end-to-end で閉じる

## 背景
policy は send-block だが、prescription save/send と server resource が usageCode/adminCode をまだ wire 前提で扱っている。

## 期待する最終状態
- med usage/admin/adminCode/adminMemo は local-only editor/source-helper 情報として保持可能
- first-class prescription send bundle は usage row を生成しない
- ORCA payload / XML は med usage を出さない
- server resource は usageCode を sendable 必須項目として要求しない
- editor 復元時に `usageCode <- adminMemo` バグがない

## client 実装指示
### `web-client/src/features/charts/prescriptionOrderApi.ts`
- send bundle build で usage/admin/adminCode/adminMemo を wire row にしない
- local save/fetch / source bundle では local-only meta として保持する
- RP meta keep 条件で claimComments を含める
- med local-only field と send DTO の責務を分離する

### `web-client/src/features/charts/orderRpNormalization.ts`
- med entity で usage row を追加しない
- usage を持っていても send block/strip の一貫した動作にする

### `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `usageCode` 復元元を `adminMemo` ではなく正しい field に修正する
- editor 表示の local-only 文言を current contract に揃える

## server 実装指示
### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- usageCode/adminCode 必須前提を削除
- first-class prescription save で local-only usage を保持するなら local metadata として扱う
- ORCA-wire 用 DTO には usage carrier を入れない

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- med usage row を XML に出さない

## tests 実装指示
- med with usage local save/fetch round-trip test
- first-class prescription send DTO に usage row が出ない test
- server resource test: usageCode 不在でも current contract どおり扱える test
- editor restore test

## 受け入れ条件
- med usage send-block が client/server 一致
- wire に usage/admin/adminCode/adminMemo が出ない
- local save/fetch/source-helper は壊れない

---

# Task P0-03: otherOrder を explicit local-only contract に置き換える

## 背景
otherOrder は send-block 自体はあるが、save-side が legacy `800..890` / `8...|18...` shape に依存している。

## 決める contract
この task では otherOrder を ORCA-like code validation から切り離し、**entity 主導の local-only contract** に変更する。

## canonical contract
- entity = `otherOrder`
- send = 不可
- classCode は validation の根拠にしない
- 型都合で classCode が必要なら、**1つの shared local-only sentinel** を使う
- sentinel は numeric ORCA range を使わない
- rowRole は `main` と `comment` のみ許可
- 1 件以上の `main` row を要求
- `main` row の `name` は必須
- `code` は opaque local identifier として扱ってよいが、`8...|18...` regex で縛らない
- bodyPart / selection comment parameter / ORCA-specific coded shape は許可しない

## client 実装指示
### `web-client/src/features/charts/otherOrderContract.ts`
- legacy range/regex を削除
- explicit local-only contract を 1 箇所で定義
- sentinel を使う場合はここで一元定義する

### `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- otherOrder save validation を新 contract へ切り替える
- numeric ORCA-like class/range 依存を削除

### `web-client/src/features/charts/orderRpNormalization.ts`
- otherOrder send-block は維持
- send path に otherOrder local data を流さない

## server 実装指示
### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `800..890` / `8...|18...` validation を削除
- entity-aware な explicit local-only validation に変更

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- otherOrder の rowRole を `main/comment` のみ許可
- legacy coded-shape ベースの role 判定をやめる

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- send-block 維持
- invalid message は new local-only contract に沿わせる

## tests 実装指示
- client save test: explicit local-only contract で通る
- client save test: legacy `800..890` / `8...|18...` 前提が不要になっている
- server request/save test: ORCA-like regex なしで通る
- send test: otherOrder は送れない

## 受け入れ条件
- production code から `800..890` / `8...|18...` が消える
- otherOrder は explicit local-only contract で保存できる
- send は block のまま

---

# Task P0-04: surgery `501/502` standalone と rowRole semantics を一本化する

## 背景
allow/block 自体はあるが、main-row rule と rowRole semantics が client/server/fetch で割れている。

## canonical grammar
### class grammar
- `500`, `510`: 1 件以上の `main` row 必須
- `501`, `502`: standalone 可。`main` row がなくても bundle 成立可
- `520/540/541/542`: reject

### rowRole grammar
- surgery の canonical rowRole は `main`, `material`, `comment`
- `material` は canonical role として明示的に扱う
- `material` を `main` や `auxiliary` に暗黙変換しない
- `auxiliary` は surgery canonical grammar では使わない
- explicit `material` は validation / persistence / fetch / display でそのまま往復する

## client 実装指示
### `web-client/src/features/charts/orderBundleContract.ts`
- surgery role resolver を canonical grammar に変更
- `material -> main` の暗黙変換をやめる

### `web-client/src/features/charts/orderRpNormalization.ts`
- surgery send normalization でも `material` を `auxiliary` に落とさない
- `501/502` standalone では generic main-row required を適用しない

### `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- local save validation を canonical grammar に合わせる

## server 実装指示
### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- surgery rowRole を single source にする
- validation と persistence/fetch の分裂を止める

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupport.java`
- fetch/recommendation でも canonical surgery rowRole を返す
- explicit `material` を保持する

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- persistence 時も canonical role を保存する

### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- surgery main-row rule を class-aware にする
- `501/502` standalone を helper で表現する

## tests 実装指示
- `501` standalone allow test
- `502` standalone allow test
- `500` main row required test
- rowRole `material` round-trip test
- `material` が path により `main/auxiliary/material` に揺れない test

## 受け入れ条件
- surgery standalone と rowRole が client/server/fetch で一致
- `material` semantics が 1 つに固定される

---

# Task P0-05: RP-level structured claim comment note の round-trip 漏れを塞ぐ

## 背景
first-class prescription save/fetch はかなり改善したが、source bundle 化で `claimComments` を keep 条件に含めておらず、RP-level note が欠落する。

## 期待する最終状態
- RP-level claim comment `note` が local save -> source bundle -> send bundle -> fetch -> editor の全経路で保持される
- `85/831` 系の structured value が link marker に化けない
- 既存の unknown family reject は壊さない

## client 実装指示
### `web-client/src/features/charts/prescriptionOrderApi.ts`
- `StoredRpMeta` に `claimComments` を保持
- `toOrderBundleItems()` で RP-level claimComments を item 化する
- `toRpFromBundle()` で RP-level claimComments を meta へ戻す
- `buildPrescriptionOrderSendBundles()` で RP-level structured note を落とさない
- source bundle keep predicate に `claimComments` を含める
- memo/link-marker fallback ではなく structured field を優先する

## server 実装指示
### `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- RP-level structured claim comment を受理・保持・返却できるよう DTO/mapper を合わせる
- unknown family reject は維持

## tests 実装指示
- RP-level `85/831` note round-trip test
- source bundle 化で note が落ちない test
- save/fetch/editor 復元 test

## 受け入れ条件
- RP-level structured note 欠落経路がなくなる

---

# Task P0-06: help / tests / notes / 実行証跡を同期する

## 背景
実装だけでなく help/tests/docs の stale が残り、さらに build/test/verify/static-analysis のログが未提出。

## 更新対象
### help / UI text
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
  - 注射説明を local-only 契約へ修正

### client tests
- `web-client/src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
  - 注射 help 文言を同期
- `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
  - injection payload に `4101/4102/4103` usage row を期待しない
- `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
  - treatment bodyPart warning/caching 前提を current reject 契約へ合わせる
- `web-client/src/features/charts/__tests__/orderBundleBodyPart.test.tsx`
  - current reject 契約維持を確認

### notes / docs
- radiology wording を exact class map に合わせる
- 注射 local-only 説明を current wire contract に合わせる
- `画像診断` 統一を崩す記述を除去

### 証跡
- `04_acceptance_and_verification_matrix.md` 記載コマンドを全部実行
- ログを最終報告に貼る
- 失敗が出たらそのまま隠さず報告する

## 受け入れ条件
- stale help/test/doc が残らない
- 実行証跡がある

---

# Task P1-01: source-of-truth の重複 canonicalization を畳む

## 対象
- `web-client/src/features/charts/orderRpRequirements.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`

## 方針
- entity canonicalization は `resolveCanonicalOrcaOrderEntity()` / `OrcaMedicalClassCatalog.normalizeEntity()` だけを使う
- 重複 alias map を削除する
- `isSendableInjectionAdminCode` は削除または本実装へ昇格する

## 受け入れ条件
- production path に独自 canonicalization が残らない

---

# Task P1-02: charge / radiology canonicalization を catalog 委譲へ寄せる

## 対象
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassCanonicalSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- 必要なら `OrcaMedicalClassCatalog.java`

## 方針
- exact class/name map は catalog に集約
- support/canonical helper は delegation only にするか、不要なら統合削除
- request/fetch/send で別々の fallback を持たない

## 受け入れ条件
- charge/radiology canonicalization の実 map が 1 箇所

---

# Task P1-03: testOrder の exact fail-close を shared 化し証明する

## 背景
catalog allowlist はあるが、save/send/server の実装と test 証跡が共有化されていない。

## expected contract
- allow=`600/601/602/603/610`
- reject=`640/643`
- 上記 allowlist 以外も reject
- save/send/server が同じ helper/table を見る

## 実装指示
### client
- `OrderBundleEditPanel.tsx` の save validation で allowlist 外全体 reject
- `orderRpNormalization.ts` / `ChartsActionBar.tsx` と同じ helper を使う

### server
- `OrcaMedicalClassCatalog.java` / `OrcaOrderBundleRequestSupport.java` / `OrcaOrderBundleMutationExecutionSupport.java` の参照先を統一

### tests
- allow: `600/601/602/603/610`
- reject: `640/643/611/699`
- save/send/server 各 path で証明

## 受け入れ条件
- testOrder の exact fail-close が code と test の両方で裏づく

---

# Task P1-04: no-regression 固定

## 目的
既にかなり整った領域を再度壊さない。

## 必須 no-regression 項目
- physiology `classCode=600 exact`, local save/fetch, send-block
- bacteria `830/842` strict, local-only, send-block
- radiology `700 only` bodyPart, allow/block exact
- selection comment outbound block
- unknown structured family reject
- `genericChangeAllowed` round-trip

## 実装指示
- 既存 test を残しつつ、不足している no-regression case を追加
- 変更多発ファイルに focused tests を入れる

---

# Task P2-01: editor 復元・stale helper・grep gate

## 実装指示
- `PrescriptionOrderEditorPanel.tsx` の `usageCode <- adminMemo` を修正
- `isSendableInjectionAdminCode` は削除または validation へ正規配線
- grep gate を `04` のコマンドに沿って実行し、必要なら scripts/CI に追加

## 受け入れ条件
- editor bug がない
- stale helper の扱いが説明可能
- grep gate が継続運用できる

## 5. 変更対象ファイル一覧

### client 本体
- `src/features/charts/orcaSendabilityPolicy.ts`
- `src/features/charts/orderRpNormalization.ts`
- `src/features/charts/orderBundleContract.ts`
- `src/features/charts/OrderBundleEditPanel.tsx`
- `src/features/charts/prescriptionOrderApi.ts`
- `src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `src/features/charts/otherOrderContract.ts`
- `src/features/charts/orderRpRequirements.ts`
- 必要に応じて `src/features/charts/orderCategoryRegistry.ts`

### server 本体
- `src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- `src/main/java/open/dolphin/rest/orca/OrcaChargeClassSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaChargeClassCanonicalSupport.java`
- `src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`

### tests / docs
- `src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
- `src/features/charts/__tests__/orderSendSmoke.test.ts`
- `src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `src/features/charts/__tests__/orderBundleBodyPart.test.tsx`
- `src/features/charts/__tests__/prescriptionOrderApi.test.ts`
- `src/features/charts/__tests__/orderRpNormalization.test.ts`
- server ORCA tests 一式
- `notes/*.md` の ORCA 関連文書

## 6. 禁止事項

- injection / med の local-only field を ORCA payload に戻すこと
- otherOrder で `800..890` / `8...|18...` を残すこと
- surgery `material` を path ごとに別 role へ変換すること
- testOrder を save だけ緩く残すこと
- help/tests/docs を未更新のままにすること
- ログなしで verify/static-analysis pass と主張すること

## 7. 実装判断ルール

曖昧になったときは、次の優先順位で判断する。

1. この仕様書
2. `04_acceptance_and_verification_matrix.md`
3. current code の整合性
4. ORCA API 仕様の一次資料

「旧実装がそうだった」は理由にならない。
