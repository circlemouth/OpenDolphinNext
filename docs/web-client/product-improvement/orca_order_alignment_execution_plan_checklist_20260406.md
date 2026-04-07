# OpenDolphinNext ORCAオーダー整合 是正実装作業計画書（チェックリスト）

## 0. この計画書の前提

- 本計画は **「確実に ORCA と通信できる最小送信契約」** を実装するためのものとする。
- **ORCA一次資料で outbound carrier が確認できたものだけ送る**。確認できないものは **local-only / import-only / send-block** に倒す。
- **後方互換性は考慮しない**。旧DB資産・過去入力互換のための複雑な救済は入れない。
- **build成果物は無視**し、コードと notes と ORCA一次資料だけを見る。
- **推測実装は禁止**。未確定事項は仕様拡張せず、必ず fail-closed にする。
- `otherOrder` / `physiologyOrder` / `bacteriaOrder` はこの計画では **ORCA outbound 非対応** とする。
- `medOrder` の usage carrier は一次確認未了のため、この計画では **usage がある処方は outbound block** とする。
- `injectionOrder` の `admin/adminCode` は一次資料で outbound root 不確認のため、この計画では **local-only** とする。
- `surgeryOrder` の `520/540/541/542`、`radiologyOrder` の `710/711/712/713/720/721/723/724`、`injectionOrder` の `335/332/352` はこの計画では **send-block** とする。
- `selection comment` の `Item_Number / Item_Number_Branch` は **local-only / import-only** とし、generic `medicalmodv2` outbound には一切出さない。

## 1. 完了条件（Definition of Done）

- [ ] client / server / tests / notes が **同じ送信契約**を参照する。
- [ ] `startsWith("5")`、`startsWith("6")`、`800..890`、`110..125`、`130..150`、`700台` のような **broad判定を全廃**する。
- [ ] `Medical_Class` は **exact class allowlist** でのみ判定する。
- [ ] `Medical_Class_Name` は **official class-specific label** で送る。
- [ ] `otherOrder` / `physiologyOrder` / `bacteriaOrder` は ORCA送信経路から完全に除外される。
- [ ] `medOrder` は raw `Medical_Class` と tri-state `Medication_Generic_Flg` を lossless に保持できる。
- [ ] `8501/8511/8521/831/842/830` は family-specific carrier でのみ送る。
- [ ] `Item_Number / Item_Number_Branch` は save/import では保持できても send payload / XML には出ない。
- [ ] `unit` / `admin` / `adminMemo` / `memo` / `started` / `rowRole` / `rowSubtype` / item memo は ORCA payload / XML に出ない。
- [ ] 主要 send smoke / mutation validation / XML serialization / import round-trip tests が更新される。
- [ ] notes が最新仕様に更新される。

---

## 2. 送信契約の最終スコープ（今回の実装で確定するもの）

### 2.1 ORCA outbound 対応 entity

- [ ] `medOrder`
- [ ] `injectionOrder`
- [ ] `treatmentOrder`
- [ ] `surgeryOrder`
- [ ] `testOrder`
- [ ] `radiologyOrder`
- [ ] `baseChargeOrder`
- [ ] `instractionChargeOrder`

### 2.2 ORCA outbound 非対応 entity

- [ ] `otherOrder` → local-only / send-block
- [ ] `physiologyOrder` → import-only + local save/fetch 可、send-block
- [ ] `bacteriaOrder` → local-only + local save/fetch 可、send-block

### 2.3 exact Medical_Class allowlist

#### medOrder
- [ ] `210/211/212/213`
- [ ] `220/221/222/223`
- [ ] `230/231/232/233`
- [ ] `290/291/292`
- [ ] `293/294/295`
- [ ] `296/297/298`

#### injectionOrder
- [ ] `310/311/312`
- [ ] `320/321`
- [ ] `330/331/334`
- [ ] `340`
- [ ] `350`
- [ ] `335/332/352` は send-block

#### treatmentOrder
- [ ] `400/401/402/403/409`

#### surgeryOrder
- [ ] `500/501/502/510`
- [ ] `520/540/541/542` は send-block

#### testOrder
- [ ] `600/601/602/603/610`
- [ ] `640/643` は pathology として send-block

#### radiologyOrder
- [ ] `700/701/702/703/704/731/732`
- [ ] `710/711/712/713/720/721/723/724` は send-block

#### baseChargeOrder
- [ ] `110/114/120/124`

#### instractionChargeOrder
- [ ] `130/132/133/140/141/142/143/148/149`
- [ ] `131/144/145/146/147/150` は reject

---

## 3. 横断実装タスク（最優先）

### 3.1 exact class / official label カタログを新設する

**目的:** class 判定・class 名・entity 対応・editor mode・sendability を 1 か所に集約する。

#### client
- [ ] `web-client/src/features/charts/` 配下に **新規** `orcaMedicalClassCatalog.ts` を作成する。
- [ ] `orcaMedicalClassCatalog.ts` には以下を持たせる。
  - [ ] `entity -> exact class list`
  - [ ] `classCode -> official className`
  - [ ] `classCode -> editor mode`
  - [ ] `classCode -> outbound status(sendable/local-only/blocked/unconfirmed)`
  - [ ] `classCode -> bodyPart policy`
  - [ ] `classCode -> requiresMainRow`
  - [ ] `classCode -> supportsStandaloneDrugOnly / MaterialOnly / AddOnOnly`
- [ ] `orderCategoryRegistry.ts` から broad range / broad className を削除し、上記 catalog 参照へ置換する。
- [ ] `orderChargeClassSupport.ts` の `110..125` / `130..150` range rule を廃止し、explicit table に置換する。
- [ ] radiology の className canonical を `放射線` から `画像診断` 系 official label に置換する。

#### server
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/` 配下に **新規** `OrcaMedicalClassCatalog.java` を作成する。
- [ ] `OrcaChargeClassSupport.java` の range 判定を explicit table に置換する。
- [ ] `OrcaChargeClassCanonicalSupport.java` の broad canonical (`基本診療料`, `医学管理等`, `放射線`) を廃止し、exact class map に置換する。
- [ ] `OrcaOrderBundleRequestSupport.java` の broad class compatibility を explicit table 参照へ置換する。
- [ ] `OrcaOrderInputSetMetadataSupport.java` / `OrcaOrderBundle600SubtypeSupport.java` / `OrcaOrderBundleRecommendationSupport.java` の broad class 推定を explicit table に置換する。

#### 完了条件
- [ ] TS と Java で **同一 allowlist** が実装される。
- [ ] broad range / prefix 判定が消える。
- [ ] `Medical_Class_Name` の official label が exact class 単位で引ける。

### 3.2 comment family carrier ルールを table-driven 化する

**目的:** `830/842/8501/8511/8521/831` を generic comment と分離し、`Medication_Name` / `Medication_Number` carrier を固定する。

#### 実装仕様
- [ ] **新規** `orcaCommentCarrierRules.ts` / `OrcaCommentCarrierRules.java` を作成する。
- [ ] 次の family を明示定義する。
  - [ ] `830 -> Medication_Name`
  - [ ] `842 -> Medication_Number`
  - [ ] `8501 -> Medication_Number`
  - [ ] `8511 -> Medication_Number`
  - [ ] `8521 -> Medication_Number`
  - [ ] `831 -> Medication_Number`
- [ ] 上記 family は **structured comment** として扱い、一般コメントと同じ `name` / `note` UI で曖昧に扱わない。
- [ ] `830` は text 未入力なら reject。
- [ ] `842/8501/8511/8521/831` は structured value 未入力なら reject。
- [ ] unknown comment family は send-block。
- [ ] `Item_Number / Item_Number_Branch` は family rule と分離し、常に local-only にする。

#### 影響ファイル
- [ ] `orderRpNormalization.ts`
- [ ] `orderBundleApi.ts`
- [ ] `bacteriaOrderSupport.ts`
- [ ] `prescriptionOrderApi.ts`
- [ ] `OrcaOrderBundleMutationExecutionSupport.java`
- [ ] `OrcaPrescriptionOrderResource.java`
- [ ] `OrcaChartSupportSupport.java`

#### 完了条件
- [ ] `830` は `Medication_Name` にだけ出る。
- [ ] `842/8501/8511/8521/831` は `Medication_Number` にだけ出る。
- [ ] structured value の無い row は save/send とも block される。

### 3.3 local-only / import-only / send-block を 1 か所で管理する

**目的:** panel / API / normalization / server mutation / XML builder で判定が割れないようにする。

- [ ] **新規** `orcaSendabilityPolicy.ts` / `OrcaSendabilityPolicy.java` を作成する。
- [ ] entity 単位の送信可否を定義する。
  - [ ] sendable: `medOrder`, `injectionOrder`, `treatmentOrder`, `surgeryOrder`, `testOrder`, `radiologyOrder`, `baseChargeOrder`, `instractionChargeOrder`
  - [ ] blocked/local-only: `otherOrder`, `physiologyOrder`, `bacteriaOrder`
- [ ] `ORCA_SEND_ORDER_ENTITIES` を catalog ベース生成に置換する。
- [ ] `orcaClaimApi.ts` の preflight block を catalog 参照へ置換する。
- [ ] `OrderBundleEditPanel.tsx` の guidance / save validation / send button disable を catalog 参照へ置換する。
- [ ] `OrcaOrderBundleMutationExecutionSupport.java` と `OrcaOrderBundleRequestSupport.java` の entity sendability 判定を同じ policy に寄せる。

#### 完了条件
- [ ] same input に対する save/send 判定が client/server で一致する。
- [ ] local-only entity は local save できるが ORCA send だけ止まる。

### 3.4 class selector を editor に導入する

**目的:** `Medical_Class` を hidden default ではなく first-class にし、raw exact class を保持する。

- [ ] `OrderBundleEditPanel.tsx` に **class selector UI** を追加する。
- [ ] class selector 対象 entity:
  - [ ] `injectionOrder`
  - [ ] `treatmentOrder`
  - [ ] `surgeryOrder`
  - [ ] `testOrder`
  - [ ] `radiologyOrder`
  - [ ] `baseChargeOrder`
  - [ ] `instractionChargeOrder`
- [ ] default 値は entity の最小 sendable class にする。
- [ ] class selection 後に incompatible row がある場合は save/send block にする。
- [ ] auto-switch は **新規空 bundle に最初の official item を追加した直後の 1 回のみ許可**し、それ以外は silent change を禁止する。
- [ ] `classCode` / `className` は selector の値を source of truth とし、bundleName からの推定を禁止する。

#### 完了条件
- [ ] multi-class entity で hidden default 依存が消える。
- [ ] exact class が UI・保存・送信で維持される。

### 3.5 local-only field を ORCA payload から完全排除する

- [ ] payload / XML に出してはいけない field の denylist を明文化する。
  - [ ] `unit`
  - [ ] `admin`
  - [ ] `adminCode`
  - [ ] `adminCodeSystem`
  - [ ] `adminMemo`
  - [ ] `memo`
  - [ ] `started/startDate`
  - [ ] `rowRole`
  - [ ] `rowSubtype`
  - [ ] `item memo`
  - [ ] `sourceSetCode`
  - [ ] `itemNumber`
  - [ ] `itemNumberBranch`
  - [ ] `selectionCommentItemNumber`
  - [ ] `selectionCommentItemNumberBranch`
- [ ] `orderRpNormalization.ts` に denylist assertion を追加する。
- [ ] `OrcaChartSupportSupport.java` に XML builder regression test を追加する。

---

## 4. entity別 実装タスク

## 4.1 medOrder

### 4.1.1 DTO / model 是正
- [ ] `web-client/src/features/charts/prescriptionOrderApi.ts`
  - [ ] `PRESCRIPTION_CLASS_CODES` を廃止し、exact allowlist へ置換する。
  - [ ] `medicalClass` を RP の source of truth にする。
  - [ ] `category/location` から classCode を再構成する処理を廃止する。
  - [ ] `isGeneralNamePrescription:boolean` を `genericFlag: 'yes' | 'no' | 'inherit'` に変更する。
  - [ ] comment を `plain` と `structured` に分離する。
  - [ ] structured comment family (`830/842/8501/8511/8521/831`) と structuredValue を first-class にする。
- [ ] `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
  - [ ] RP class selector を full class list に差し替える。
  - [ ] generic flag UI を tri-state に変更する。
  - [ ] structured comment family ごとに入力 UI を分岐する。
  - [ ] free-text usage しか無い RP は send-block と表示する。
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderImportSupport.java`
  - [ ] raw `Medical_Class` を lossless import する。
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
  - [ ] save/send validation を exact class + structured comment rule に変更する。

### 4.1.2 outbound ルール
- [ ] `830` は `Medication_Name` に text を載せる。
- [ ] `842/8501/8511/8521/831` は `Medication_Number` に structuredValue を載せる。
- [ ] structuredValue の無い family row は send-block。
- [ ] `Medication_Generic_Flg` は `yes/no/inherit` を lossless に round-trip する。
- [ ] usage carrier は一次確認未了のため、**usageCode または usageName が存在する RP は outbound block** にする。
- [ ] `Item_Number / Item_Number_Branch` を持つ comment は send-block にする。

### 4.1.3 テスト
- [ ] `prescriptionOrderApi.test.ts`
  - [ ] 210/213, 220/223, 230/233 を round-trip で潰さない。
  - [ ] tri-state generic flag を保持する。
  - [ ] structured comment family ごとの serialize を固定する。
  - [ ] usage 存在時 send-block を固定する。
- [ ] `OrcaPrescriptionOrderResourceTest.java`
  - [ ] structured comment missing value reject。
  - [ ] 85/831 family serialize の XML/assertion を追加。

## 4.2 injectionOrder

### 4.2.1 class / local-only 見直し
- [ ] `orderCategoryRegistry.ts`
  - [ ] injection class selector option を `310/311/312/320/321/330/331/334/340/350` に変更する。
  - [ ] guidance から `admin/adminCode を送る` 旨を削除する。
- [ ] `orderBundleContract.ts`
  - [ ] `classCode == 310 only` を廃止する。
  - [ ] `adminCode required` を廃止する。
  - [ ] `admin/adminCode/adminMemo/speed` を local-only 扱いに変更する。
- [ ] `OrderBundleEditPanel.tsx`
  - [ ] class selector を実装する。
  - [ ] bodyPart 入力 UI を injection で完全非表示・reject にする。
  - [ ] `335/332/352` は「未確認 class」として send-block 表示にする。
- [ ] `orderRpNormalization.ts`
  - [ ] synthetic `adminCode` row 生成を削除する。
  - [ ] injection send payload に `admin*` を一切出さない。
- [ ] `OrcaOrderBundleRequestSupport.java`
  - [ ] `310 only` 互換判定を explicit allowlist に置換する。
- [ ] `OrcaOrderBundleMutationExecutionSupport.java`
  - [ ] `adminCode required` を削除する。
  - [ ] unsupported class (`335/332/352`) block を実装する。

### 4.2.2 最小 send contract
- [ ] sendable class は `310/311/312/320/321/330/331/334/340/350` のみ。
- [ ] rows は coded row + allowed comment row のみ。
- [ ] comment-only injection bundle は current minimum contract では block。
- [ ] `Medication_Generic_Flg` は drug row にだけ出す。

### 4.2.3 テスト
- [ ] `orderBundleValidation.test.ts`
  - [ ] `310 only` 前提 test を廃止し、explicit allowlist へ更新。
  - [ ] `adminCode required` test を削除し、local-only に更新。
  - [ ] `335/332/352` block test を追加。
- [ ] `orderRpNormalization.test.ts`
  - [ ] synthetic admin row が出ないことを固定。
- [ ] `orderSendSmoke.test.ts`
  - [ ] `4101/4102/4103` 先頭 row 期待を削除。
  - [ ] exact class send smoke を追加。
- [ ] `OrcaOrderBundleRequestSupportTest.java`
  - [ ] explicit allowlist / bodyPart reject / admin local-only を追加。

## 4.3 treatmentOrder

### 4.3.1 class-aware editor mode
- [ ] class selector options: `400/401/402/403/409`
- [ ] `400/409` = procedure-capable mode
  - [ ] at least one main coded row 必須
  - [ ] add-on / drug / material / comment row を許可
- [ ] `401` = drug-only mode
  - [ ] procedure/bodyPart/material を禁止
  - [ ] drug + comment のみ許可
- [ ] `402` = material-only mode
  - [ ] procedure/bodyPart/drug を禁止
  - [ ] material + comment のみ許可
- [ ] `403` = add-on-only mode
  - [ ] procedure/bodyPart/drug/material を禁止
  - [ ] add-on + comment のみ許可

### 4.3.2 bodyPart 廃止
- [ ] `OrderBundleEditPanel.tsx` で treatment の bodyPart field を廃止する。
- [ ] `orderRpNormalization.ts` で treatment bodyPart row 出力を削除する。
- [ ] `OrcaOrderBundleRequestSupport.java` / `OrcaOrderBundleMutationExecutionSupport.java` で treatment bodyPart 許可を削除する。
- [ ] `unsupported_body_part` メッセージを treatment で明示する。

### 4.3.3 テスト
- [ ] `401` drug-only standalone accept。
- [ ] `402` material-only standalone accept。
- [ ] `403` add-on-only standalone accept。
- [ ] `409` を `400` に潰さない。
- [ ] treatment bodyPart reject を client/server 両方で追加。

## 4.4 surgeryOrder

### 4.4.1 entity 再定義
- [ ] この作業では `surgeryOrder` の outbound scope を `500/501/502/510` に限定する。
- [ ] `520/540/541/542` は import/local save は許可しても outbound block にする。
- [ ] UI label は必要なら維持してよいが、送信契約は exact class first に変更する。

### 4.4.2 class-aware editor mode
- [ ] `500` = procedure-capable mode
- [ ] `501` = drug-only mode
- [ ] `502` = material-only mode
- [ ] `510` = procedure-capable mode

### 4.4.3 rowRole 不整合解消
- [ ] surgery の `material rowRole` / `auxiliary rowRole` を outbound 判定から外す。
- [ ] editor/save/send/server で surgery row を **flat coded rows** に統一する。
- [ ] `orderBundleContract.ts` の surgery material 前提を削除または local-only 表現に閉じる。
- [ ] `OrcaOrderBundleRowRoleSupport.java` の surgery material reject と editor/save の食い違いを解消する。
- [ ] surgery bodyPart は reject。

### 4.4.4 テスト
- [ ] `500/501/502/510` sendable。
- [ ] `520/540/541/542` outbound block。
- [ ] surgery material rowRole に依存しない save/send consistency。
- [ ] 9桁コード以外 main row reject。

## 4.5 testOrder / physiologyOrder / bacteriaOrder

### 4.5.1 testOrder の exact class 対応
- [ ] class selector options: `600/601/602/603/610`
- [ ] `600/610` = test main mode
  - [ ] at least one main coded row 必須
  - [ ] add-on / drug / material / comment を許可
- [ ] `601` = drug-only mode
- [ ] `602` = material-only mode
- [ ] `603` = add-on-only mode
- [ ] `640/643` pathology は `testOrder` で reject。
- [ ] `startsWith("6")` compatibility を全廃する。

### 4.5.2 physiologyOrder を import-only に統一
- [ ] `ORCA_SEND_ORDER_ENTITIES` から `physiologyOrder` を削除する。
- [ ] `orcaClaimApi.ts` の send block は維持する。
- [ ] `OrderBundleEditPanel.tsx` の physiology local save exception throw を削除し、**local save/fetch は許可**する。
- [ ] server lower layer でも physiology outbound を block する。
- [ ] guidance を「entity固有 carrier はない。generic test carrier に正規化しない限り送れない」に修正する。

### 4.5.3 bacteriaOrder を local-only に統一
- [ ] `ORCA_SEND_ORDER_ENTITIES` から `bacteriaOrder` を削除する。
- [ ] `subtype required` validation を削除する。
- [ ] `culture/sensitivity` は optional local-only metadata にする。
- [ ] send path は entity 単位で block する。
- [ ] `830/842/831/8501/8511/8521` carrier 実装は generic comment rule 側に集約し、`bacteriaOrder` entity では使わない。
- [ ] specimen は dedicated field ではなく local convenience とし、future generic test send 時は comment row flatten 前提にする。

### 4.5.4 テスト
- [ ] `testOrder` allowlist (`600/601/602/603/610`)。
- [ ] `640/643` reject。
- [ ] physiology local save/fetch allowed + ORCA send blocked。
- [ ] bacteria local save/fetch allowed + ORCA send blocked。
- [ ] bacteria subtype required test を削除し、optional local-only test へ変更。

## 4.6 radiologyOrder

### 4.6.1 class / class name 是正
- [ ] default className を `放射線` から `画像診断` に変更する。
- [ ] class selector options: `700/701/702/703/704/731/732`
- [ ] `710/711/712/713/720/721/723/724` は outbound block。

### 4.6.2 modality-aware bodyPart ルール
- [ ] bodyPart policy enum を導入する。
  - [ ] `plain_xray_or_photo` -> 002 row 許可
  - [ ] `ct_mri` -> 002 row 禁止、selection comment bodyPart 必須
  - [ ] `mammography` -> bodyPart 任意
  - [ ] `standalone_class` (`701/702/703/704/731/732`) -> dedicated bodyPart field なし
- [ ] CT/MRI で 002 bodyPart と selection comment bodyPart が両方ある場合は **reject** する。
- [ ] CT/MRI で selection comment bodyPart が無い場合は reject。
- [ ] plain X-ray / 写真診断で 002 bodyPart を row として送る。
- [ ] mammography は bodyPart 空でも通す。
- [ ] blanket `missing_body_part` rule を廃止し、policy-based validation に置換する。

### 4.6.3 standalone class 対応
- [ ] `701/702/703/704/731/732` では `700 main row required` を掛けない。
- [ ] `731/732` は standalone official class として送る。
- [ ] radiology `contrastDrug/material` rowSubtype は local-only にする。
- [ ] official carrier 不明な subtype canonicalization はやめる。

### 4.6.4 テスト
- [ ] `700` plain X-ray official sample 相当。
- [ ] CT/MRI bodyPart = selection comment only。
- [ ] `701/702/703/704/731/732` standalone。
- [ ] `710..724` block。
- [ ] mammography bodyPart optional。
- [ ] className `画像診断` 固定。

## 4.7 baseChargeOrder

### 4.7.1 exact class / exact name
- [ ] allowlist を `110/114/120/124` のみにする。
- [ ] `基本診療料` umbrella canonicalization を廃止する。
- [ ] official class-specific name map を使う。
- [ ] `110..125` blanket validation を削除する。

### 4.7.2 one bundle = one exact class
- [ ] bundle 内 main row の `masterCategory` が複数 class にまたがる場合は save/send reject。
- [ ] class selector を `110/114/120/124` に限定する。
- [ ] `bundleNumber -> Medical_Class_Number` は exact-class bundle のみ有効にする。

### 4.7.3 テスト
- [ ] `120 -> 再診` 系 official label。
- [ ] `110/114/120/124` allowlist。
- [ ] mixed-class charge bundle reject。
- [ ] XML に umbrella 名が出ない。

## 4.8 instractionChargeOrder

### 4.8.1 exact class / exact name
- [ ] allowlist を `130/132/133/140/141/142/143/148/149` のみにする。
- [ ] `医学管理等` umbrella canonicalization を廃止する。
- [ ] 13系 / 14系 official label を exact map で送る。
- [ ] `130..150` blanket validation を削除する。

### 4.8.2 entity 粒度の扱い
- [ ] entity は UI grouping としては維持可。
- [ ] ただし send DTO / XML は exact `Medical_Class` source of truth にする。
- [ ] class-specific grammar 未確認部分は拡張しない。coded row + exact class のみで最小対応する。

### 4.8.3 テスト
- [ ] `130/132/133/140/141/142/143/148/149` allowlist。
- [ ] `131/144/145/146/147/150` reject。
- [ ] exact class name mapping。
- [ ] XML に `医学管理等` umbrella 名が出ない。

## 4.9 otherOrder

### 4.9.1 今回の扱い
- [ ] ORCA outbound 対象から除外する。
- [ ] `ORCA_SEND_ORDER_ENTITIES` から削除する。
- [ ] `orcaClaimApi.ts` / normalization / server mutation で `otherOrder` は explicit send-block にする。
- [ ] local save/fetch は維持する。
- [ ] UI guidance を「ORCA送信対象外」に変える。

### 4.9.2 将来 redesign を残すが今回実装しないもの
- [ ] `820/830/831/850/851/852` family typed subtype 化
- [ ] `.820/.830/.890/.950/.960/.980/.990` 再設計
- [ ] `18...` blanket acceptance 廃止後の新契約

### 4.9.3 テスト
- [ ] otherOrder ORCA send blocked。
- [ ] local save/fetch は維持。

---

## 5. 共通 validation / normalization 実装ルール

### 5.1 save と send を一致させる
- [ ] save できるが send できない row を原則禁止する。
- [ ] ただし local-only / import-only entity は **save 可・send 不可** を明示仕様にする。
- [ ] send DTO に入らない field は UI guidance / save validation / server validation でも local-only と明記する。

### 5.2 9桁コード前提を厳格化する
- [ ] `Medication_Code` は input code 不可のため、sendable coded row は official resolved code のみ許可する。
- [ ] manual free input で 9桁未満 / 非数値 / unresolved code を保存する場合は local-only にする。
- [ ] send path では unresolved code を reject する。

### 5.3 selection comment parameter は全段 block
- [ ] picker 段階 block
- [ ] save 段階 block
- [ ] server mutation block
- [ ] send normalization block
- [ ] same error key / same reason message に統一する

### 5.4 `Medical_Class_Name` は classCode からのみ引く
- [ ] bundleName fallback 禁止
- [ ] entity broad label fallback 禁止
- [ ] exact class unknown のときは outbound block

---

## 6. テスト計画（追加・修正必須）

### 6.1 client unit / integration
- [ ] `orderCategoryRegistry.test.ts`
- [ ] `orderBundleValidation.test.ts`
- [ ] `orderRpNormalization.test.ts`
- [ ] `orderSendSmoke.test.ts`
- [ ] `orderSend600SubtypeSmoke.test.ts`
- [ ] `orderBundleOrcaSupport.test.tsx`
- [ ] `chartsActionBar.orca-send.test.tsx`
- [ ] `prescriptionOrderApi.test.ts`
- [ ] `OrderBundleEditPanel.600-subtype.test.tsx`
- [ ] `orderDetailDisplayViewModel.test.ts`

### 6.2 server unit / integration
- [ ] `OrcaOrderBundleRequestSupportTest.java`
- [ ] `OrcaOrderBundleMutationExecutionSupportTest.java`
- [ ] `OrcaOrderBundle600SubtypeSupportTest.java`
- [ ] `OrcaPrescriptionOrderResourceTest.java`
- [ ] `OrcaOrderBundleRecommendationSupportTest.java`
- [ ] XML serialization regression for `OrcaChartSupportSupport.java`

### 6.3 smoke scenario 必須一覧
- [ ] medOrder raw class round-trip
- [ ] medOrder tri-state generic flag
- [ ] medOrder structured comment family
- [ ] medOrder usage send-block
- [ ] injection no-admin outbound
- [ ] treatment 401/402/403 standalone
- [ ] surgery 500/501/502/510 only
- [ ] test 600/601/602/603/610 only
- [ ] physiology local-only
- [ ] bacteria local-only
- [ ] radiology plain X-ray
- [ ] radiology CT/MRI selection comment bodyPart
- [ ] baseCharge exact class exact name
- [ ] instractionCharge exact class exact name
- [ ] otherOrder send-block

---

## 7. notes / ドキュメント更新

- [ ] `web-client/notes/orca-order-remediation-20260403.md`
  - [ ] medOrder tri-state / structured comment / usage block に更新
  - [ ] injection admin local-only に更新
  - [ ] physiology/bacteria local-only に更新
- [ ] `web-client/notes/orca-order-contract-cleanup-20260404.md`
  - [ ] treatment bodyPart 廃止
  - [ ] class-aware exact allowlist に更新
- [ ] `web-client/notes/radiology-order-canonical-contract-20260404.md`
  - [ ] `放射線` canonical 廃止
  - [ ] class 700固定廃止
  - [ ] CT/MRI selection comment bodyPart に更新
- [ ] `web-client/notes/orca-charge-canonicalization-20260404.md`
  - [ ] baseCharge / instractionCharge の explicit class map に更新
  - [ ] unit 非送信、selection comment parameter block を code と一致させる

---

## 8. 実装順序（担当者向けの着手順）

### Phase 1: 横断基盤
- [ ] `orcaMedicalClassCatalog.*` を client/server に追加
- [ ] `orcaCommentCarrierRules.*` を client/server に追加
- [ ] `orcaSendabilityPolicy.*` を client/server に追加
- [ ] broad range / prefix 判定を catalog 呼び出しへ置換

### Phase 2: 送信停止 / local-only 統一
- [ ] `otherOrder` outbound block
- [ ] `physiologyOrder` local save/fetch + send block
- [ ] `bacteriaOrder` local save/fetch + send block
- [ ] injection admin local-only 化

### Phase 3: charge / radiology / treatment / surgery / test の exact class 化
- [ ] baseCharge
- [ ] instractionCharge
- [ ] treatment
- [ ] surgery
- [ ] test
- [ ] radiology

### Phase 4: medOrder の lossless 化
- [ ] raw class
- [ ] tri-state generic flag
- [ ] structured comment family
- [ ] usage send-block

### Phase 5: テスト / notes / cleanup
- [ ] client tests
- [ ] server tests
- [ ] notes 更新
- [ ] dead helper / dead note / obsolete broad-range test を削除

---

## 9. 作業中に絶対にやってはいけないこと

- [ ] broad range / broad prefix を新規追加しない
- [ ] official root 不明の carrier を独自追加しない
- [ ] `Item_Number / Item_Number_Branch` を outbound payload に出さない
- [ ] `bundleName` や UI label を `Medical_Class_Name` の source にしない
- [ ] `admin/adminCode` を注射 outbound row に戻さない
- [ ] treatment bodyPart を復活させない
- [ ] radiology を `700 + 放射線 + 002必須` に戻さない
- [ ] `physiologyOrder` / `bacteriaOrder` / `otherOrder` を送信対象へ戻さない
- [ ] medOrder で usage carrier 未確認のまま row を送らない

