# ORCAオーダー整合 残課題クローズパケット 2026-04-08

この文書は、差し替え後コードに対する静的監査結果を、Codex が hidden report なしで使えるように整理したものです。外部資料や過去会話は参照しません。ここに書かれた残課題を、現在のコードベース上で閉じてください。

## 目的

既に入っている exact `Medical_Class` 化と sendability policy を前提に、残っている不整合を収束させる。

完了の定義は、次の 4 点です。

1. 規則の source-of-truth が client/server で一貫している。
2. save / send / server mutation / XML / tests / notes / help text が同じ契約を語る。
3. fail-closed にすると決めた箇所は全段で block される。
4. stale な期待値や説明が current code と一致する。

## 既に成立している前提

次は壊してはいけません。

- `baseChargeOrder` は `110/114/120/124` のみ。
- `instractionChargeOrder` は `130/132/133/140/141/142/143/148/149` のみ。
- `radiologyOrder` は `700/701/702/703/704/731/732` allow、`710..724` block。
- `testOrder` は `600/601/602/603/610` allow、`640/643` block 予定。
- `surgeryOrder` は `500/501/502/510` allow、`520/540/541/542` block。
- `treatmentOrder` は `400/401/402/403/409` family。
- `injectionOrder` は `310/311/312/320/321/330/331/334/340/350` allow、`332/335/352` block。
- `otherOrder` は `local-only + send-block`。
- `physiologyOrder` は `import-only + local save/fetch 可 + send-block` が intended contract。
- `bacteriaOrder` は `local-only + local save/fetch 可 + send-block`。
- `Item_Number / Item_Number_Branch` は outbound 不可。
- `admin/adminCode/adminMemo/speed` は injection wire carrier にしない。
- `bodyPart` は radiology 以外 reject。

## P0: 最優先で閉じる残課題

### P0-1. source-of-truth の一本化

#### 現在の問題
- client の `orcaCommentCarrierRules.ts` は exact match、server の `OrcaCommentCarrierRules.java` は prefix match。
- client の production code は `orcaCommentCarrierRules.ts` を十分に使っていない。
- client に exact class/name map の重複が残っている。
  - `OrderBundleEditPanel.tsx`
  - `orderRpNormalization.ts`
  - `orderDetailDisplayViewModel.ts`
- server の input-set 系に broad range と legacy radiology label が残っている。
  - `OrcaOrderInputSetMetadataSupport.java`

#### やること
- comment family 判定を client/server で同一方式に統一する。**full code を prefix family へ解決する方式**に揃える。
- client の通常 order-bundle comment pipeline が shared helper を通るように配線する。
- radiology / charge の exact class map・canonical className map を target helper 以外から削除し、catalog/helper 経由へ寄せる。
- server input-set metadata から broad numeric range を除去し、exact class / shared catalog / canonical label に寄せる。
- `放射線` の legacy label を input-set 系から除去し、少なくとも radiology canonical で drift しないようにする。

#### 完了条件
- `orcaCommentCarrierRules` の family 解決と unknown family reject が client/server で一致。
- radiology / charge の exact map が `OrderBundleEditPanel.tsx` / `orderRpNormalization.ts` / `orderDetailDisplayViewModel.ts` から消えるか、少なくとも helper 呼び出しへ一本化される。
- `OrcaOrderInputSetMetadataSupport.java` に broad `500..599`, `600..699`, `700..799`, `800..899` が残らない。

### P0-2. treatment / surgery の class-aware grammar

#### 現在の問題
- allowlist はあるが、save / send / mutation の grammar が generic `main row 必須` に寄っている。
- `401/402/403/409` standalone が intended contract に揃っていない。
- 特に `402` material-only は main row 不在で潰れる。
- surgery は catalog/server mutation gate は exact だが、client save/send 側の exact-class enforcement が弱い。
- surgery material row mismatch が未解消。
  - explicit `rowRole=material` は reject
  - 同じ 7xxxx 行を無印で持つと main として通りうる

#### やること
- treatment family に per-class grammar を入れる。
  - `400`: procedure-capable main row 前提
  - `401`: standalone positive case を許可
  - `402`: material-only standalone を許可
  - `403`: add-on-only standalone を許可
  - `409`: exact class を保持したまま `400` 相当の grammar
- generic `main row 必須` を treatment family 全体に一律適用しない。
- surgery の client save/send でも exact allowlist / blocked list を明示適用する。
- surgery material row mismatch は **一つの方針に寄せる**。
  - 推奨: surgery では rowRole-based material を使わず、exact class `502` で表現する。少なくとも explicit `rowRole=material` と implicit main fallback が食い違わないようにする。
- bodyPart reject は維持する。

#### 完了条件
- `401/402/403/409` の standalone が tests で明示される。
- `402 material-only` が intended policy どおり通るか、fail-close するならその理由が class-aware に固定される。
- surgery 7xxxx 行の explicit/implicit rowRole が同じ結論になる。
- client save/send と server mutation で surgery exact-class enforcement が一致する。

### P0-3. 600 family / physiology / bacteria / radiology の最終収束

#### 現在の問題
- `testOrder` の `640/643` reject が send 正規化まで閉じていない。
- `physiologyOrder` は intended では local save/fetch 可だが、editor 側 mutation が throw して save continuity を壊している。
- `bacteriaOrder` は local-only/send-block は揃うが、830/842 以外の structured family fence が緩い。
- radiology は exact class allowlist はあるが、canonical class/name と bodyPart policy が end-to-end で揃っていない。
- `orderCategoryRegistry.ts` に `requiresBodyPart: true` の legacy metadata が残っている。
- notes では CT/MRI selection-comment bodyPart を語るが、current running path で未実装に見える。

#### やること
- `testOrder` で `640/643` を fetch/save/send の全段で fail-close する。少なくとも send 正規化では必ず止める。
- `physiologyOrder` の editor save throw を除去し、**import-only + local save/fetch 可 + send-block** に合わせる。
- `bacteriaOrder` の comment family handling を shared rule に寄せ、unknown structured family は fail-close する。
- radiology は次のどちらか一つに **統一**する。
  - A. modality-aware bodyPart policy を本当に実装する。
  - B. current running path に合わせて fail-close し、notes/help/test をその実装に揃える。
- どちらを選んでも、次は必須。
  - legacy `放射線` を canonical 名に戻さない
  - `710..724` は block 維持
  - `requiresBodyPart: true` の stale metadata は 제거または current behavior に合わせる
  - `bodyPart` policy と `ChartsActionBar` / `OrderBundleEditPanel` / send normalization / server mutation / notes が同じことを言う

#### 完了条件
- `640/643` が send path に流れない。
- `physiologyOrder` が local save/fetch できる。
- `bacteriaOrder` の structured family 判定が shared helper に揃う。
- radiology の canonical 名と bodyPart policy が tests / help / notes / save / send / server で一致する。

### P0-4. charge / otherOrder / selection comment の fail-closed 補強

#### 現在の問題
- charge exact allowlist は揃っているが、server は mixed-class bundle を単独 fail-close できていない。
- otherOrder は send-block できているが、save-side に旧 `800..890` / `8...|18...` 契約が残る。
- selection comment の `Item_Number/Branch` block は揃っているが、unknown family reject が client で弱い。

#### やること
- charge bundle で、`bundle.classCode` と main row `masterCategory` の不一致を **server mutation でも reject** する。
- send 正規化で「最初の main row masterCategory を拾うだけ」の挙動を mixed-class 前提で残さない。
- otherOrder の save-side 契約を client/server で統一する。
  - 送信不能なのは維持
  - 旧 ORCA-shape regex を save 契約として温存しない
- selection comment の family 判定を shared helper 化し、unknown structured family を client/save/send/server 全段で fail-close する。

#### 完了条件
- charge mixed-class bundle が server 単独でも reject される。
- otherOrder save 契約が client/server で一致する。
- unknown structured comment family が全段で reject される。

## P1: 完了前に必ずやる同期作業

### P1-1. stale tests / notes / UI guidance の更新

#### 主な stale 箇所
- `orderBundleOrcaSupport.test.tsx`
  - `testOrder=600 only`
  - `injection で admin/adminCode を送信で使う`
- `OrderBundleEditPanel.tsx`
  - `testOrder` help
  - `injectionOrder` help
  - `physiologyOrder` guidance
  - `bacteriaOrder` guidance
- server `OrcaOrderBundleResourceTest`
  - treatment bodyPart 受理前提
- `radiology-order-canonical-contract-20260404.md`
- `orca-charge-canonicalization-20260404.md` と display fallback のズレ

#### 完了条件
- stale 文字列固定テストが current behavior に一致する。
- notes が current running path と同じ contract を語る。
- UI guidance が wire contract と矛盾しない。

## P2: 余力があれば仕上げる箇所

### P2-1. medOrder / injectionOrder helper semantics の磨き込み

#### medOrder
- raw class / tri-state / usage send-block は概ね成立。
- ただし family 判定ロジックが client 内で不統一。
- `genericChangeAllowed` が helper 経由で固定 `true` になる箇所がある。

#### injectionOrder
- wire contract は概ね成立。
- ただし `admin/adminCode` が local save/fetch では残るので、help / helper 名称が誤解を招きやすい。

## 変更候補ファイル

### client
- `web-client/src/features/charts/orcaCommentCarrierRules.ts`
- `web-client/src/features/charts/orcaMedicalClassCatalog.ts`
- `web-client/src/features/charts/orcaSendabilityPolicy.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/orderDetailDisplayViewModel.ts`
- `web-client/src/features/charts/orderBundleContract.ts`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/prescriptionOrderApi.ts`
- `web-client/src/features/charts/bacteriaOrderSupport.ts`
- `web-client/src/features/charts/otherOrderContract.ts`

### server
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaCommentCarrierRules.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaSendabilityPolicy.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`
- 必要なら `OrcaOrderBundleRecommendationSupport.java`

### tests / notes
- `web-client/src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
- `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
- `web-client/src/features/charts/__tests__/orderBundleValidation.test.ts`
- `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `web-client/src/features/charts/__tests__/orderRpNormalization.test.ts`
- `web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupportTest.java`
- `web-client/notes/orca-order-remediation-20260403.md`
- `web-client/notes/orca-order-contract-cleanup-20260404.md`
- `web-client/notes/radiology-order-canonical-contract-20260404.md`
- `web-client/notes/orca-charge-canonicalization-20260404.md`

## 検証コマンド

### client
- `npm run typecheck`
- `npm exec vitest run src/features/charts/__tests__/orderBundleValidation.test.ts src/features/charts/__tests__/orderRpNormalization.test.ts src/features/charts/__tests__/orderSendSmoke.test.ts src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/prescriptionOrderApi.test.ts`

### server
- `mvn -pl server-modernized -Dtest=OrcaOrderBundleRequestSupportTest,OrcaOrderBundleMutationExecutionSupportTest,OrcaOrderInputSetMetadataSupportTest test`
- 必要なら追加で
  - `OrcaOrderBundleResourceTest`
  - `OrcaOrderBundleRecommendationSupportTest`
  - `OrcaPrescriptionOrderResourceTest`

## 完了条件

- broad range / broad prefix の残骸が shared source-of-truth の外に残らない。
- client/server の comment family semantics が一致。
- treatment / surgery の grammar が class-aware になる。
- physiology local save continuity が回復する。
- radiology policy と notes/help/tests が一致する。
- mixed-class charge を server 単独でも fail-close できる。
- otherOrder save 契約が client/server で一致する。
- unknown structured comment family が全段 reject になる。
- stale tests / notes / help text が current behavior と一致する。
