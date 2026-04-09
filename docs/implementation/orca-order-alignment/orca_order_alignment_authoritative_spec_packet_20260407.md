# OpenDolphinNext ORCAオーダー整合 是正実装 補助仕様書（自己完結版）

## 0. この文書の役割

この文書は、**Codex が隠れた報告書を参照できない前提**で、ORCAオーダー整合の是正実装を完了するための自己完結した仕様書である。

Codex に渡すべきファイルは次の 4 点だけでよい。

1. `orca_order_alignment_execution_plan_checklist_self_contained_20260407.md`
2. `orca_order_alignment_authoritative_spec_packet_20260407.md`（本書）
3. `orca_order_alignment_authoritative_tables_20260407.json`
4. `codex_prompt_orca_order_alignment_self_contained_20260407.md`

隠れたレビュー、別スレッドの結論、口頭補足は参照しないこと。必要な決定事項はすべて本書と JSON に埋め込んである。

---

## 1. 前提

### 1.1 リポジトリ前提

- サーバは multi-module Maven 構成の `server-modernized` モジュールを持つ。
- Web は `web-client` の TypeScript / React アプリである。
- 実装対象は **コード・テスト・notes** であり、build 成果物は無視する。
- 後方互換性や旧 DB 資産は考慮しない。

### 1.2 公式資料の参照元

参照してよい ORCA 一次資料は以下のみ。

- API overview
  - https://www.orca.med.or.jp/receipt/users/tec/api/overview.html
- medicalmodv2
  - https://www.orca.med.or.jp/receipt/users/tec/api/medicalmod.html
- medicationgetv2
  - https://www.orca.med.or.jp/receipt/users/tec/api/medicationgetv2.html
- comment 85 / 831
  - https://www.orca.med.or.jp/receipt/users/tec/api/comment85-831-api.html
- comment 842 / 830 / 撮影部位
  - https://www.orca.med.or.jp/receipt/users/tec/api/comment842-830-bui-api.html
- medicalsetv2
  - https://www.orca.med.or.jp/receipt/users/tec/api/medicalset.html
- setcode
  - https://www.orca.med.or.jp/receipt/users/tec/api/setcode.html
- acsimulatev2
  - https://www.orca.med.or.jp/receipt/tec/api/acsimulate.html
- 外来マニュアル
  - 基本診療料: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-1/
  - 投薬: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-4/
  - 注射: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-5/
  - 処置: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-6/
  - 手術: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-7/
  - 検査: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-9/
  - 画像診断: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-10/
  - 病理診断: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-12/
- ORCA 公式 PDF
  - DB 定義書: https://ftp.orca.med.or.jp/pub/data/receipt/tec/database-table-definition-edition-20240426.pdf
  - 2020 コメント資料: https://ftp.orca.med.or.jp/pub/data/receipt/outline/update/improvement/pdf/2020comment-2020-10-27.pdf
  - 画像診断追補: https://ftp.orca.med.or.jp/pub/data/receipt/outline/revision/pdf/202004-kaisei-taiou-219_20200527.pdf
  - 運用ガイド: https://ftp.orca.med.or.jp/pub/data/qualified/operator/operation_guide-basic-2014.pdf

非公式ブログ、Qiita、個人記事、社内口頭伝承、生成 AI 要約は禁止。

---

## 2. 非交渉ルール

1. **ORCA 公式に outbound carrier が明示されているものだけ送る。**
2. **確認できないものは local-only / import-only / send-block に倒す。**
3. **silent drop 禁止。** send 不可な情報は明示的に block する。
4. **送信の source of truth は entity 名ではなく exact `Medical_Class` + official carrier。**
5. **broad range / broad prefix を新規追加しない。**
6. **client / server / tests / notes を同時に直す。**
7. **selection comment の `Item_Number / Item_Number_Branch` は generic `medicalmodv2` へ送らない。**
8. **`admin/adminCode` を注射の独自 wire carrier として送らない。**
9. **`Medical_Class_Name` を UI broad label から決めない。**
10. **コード未解決 row は送らない。** `Medication_Code` は official resolved code のみ。

---

## 3. ORCA outbound の基本モデル

### 3.1 送信口

正式な outbound は `/api21/medicalmodv2` である。

### 3.2 正本構造

ORCA へ送る最小単位は `Medical_Information_child`。

bundle-level field:

- `Medical_Class`
- `Medical_Class_Name`
- `Medical_Class_Number`

row-level field:

- `Medication_Code`
- `Medication_Name`
- `Medication_Number`
- `Medication_Generic_Flg`
- `Medication_Continue`
- `Medication_Internal_Kinds`

### 3.3 即ち何をしてはいけないか

- `rowRole` を XML first-class field にしない。
- `rowSubtype` を XML first-class field にしない。
- `bodyPart` 専用 field を generic に作らない。
- `adminCode` 専用 field を作らない。
- `Item_Number / Item_Number_Branch` を generic send payload に積まない。

---

## 4. 今回の最終製品判断

### 4.1 sendable entity

- `medOrder`
- `injectionOrder`
- `treatmentOrder`
- `surgeryOrder`
- `testOrder`
- `radiologyOrder`
- `baseChargeOrder`
- `instractionChargeOrder`

### 4.2 send-block / local-only entity

- `otherOrder` = local-only + send-block
- `physiologyOrder` = import-only + local save/fetch 可 + send-block
- `bacteriaOrder` = local-only + local save/fetch 可 + send-block

### 4.3 alias

- `generalOrder -> treatmentOrder`
- `laboTest -> testOrder`
- `instructionChargeOrder -> instractionChargeOrder`

ただし ORCA は entity token を見ない。送信 canonical は exact `Medical_Class` と row carrier である。

---

## 5. exact `Medical_Class` allowlist（確定版）

### 5.1 medOrder

sendable class:

- `210/211/212/213`
- `220/221/222/223`
- `230/231/232/233`
- `290/291/292`
- `293/294/295`
- `296/297/298`

### 5.2 injectionOrder

sendable class:

- `310/311/312`
- `320/321`
- `330/331/334`
- `340`
- `350`

blocked / pending:

- `335`
- `332`
- `352`

### 5.3 treatmentOrder

sendable class:

- `400`
- `401`
- `402`
- `403`
- `409`

### 5.4 surgeryOrder

sendable class:

- `500`
- `501`
- `502`
- `510`

blocked / pending:

- `520`
- `540`
- `541`
- `542`

### 5.5 testOrder

sendable class:

- `600`
- `601`
- `602`
- `603`
- `610`

blocked:

- `640`
- `643`

### 5.6 radiologyOrder

sendable class:

- `700`
- `701`
- `702`
- `703`
- `704`
- `731`
- `732`

blocked / pending:

- `710`
- `711`
- `712`
- `713`
- `720`
- `721`
- `723`
- `724`

### 5.7 baseChargeOrder

sendable class:

- `110`
- `114`
- `120`
- `124`

### 5.8 instractionChargeOrder

sendable class:

- `130`
- `132`
- `133`
- `140`
- `141`
- `142`
- `143`
- `148`
- `149`

reject:

- `131`
- `144`
- `145`
- `146`
- `147`
- `150`

---

## 6. `Medical_Class_Name` source of truth（確定版）

送信で使う `Medical_Class_Name` は **classCode exact map** とする。UI broad label は送信 source に使わない。

- `110 -> 初診料`
- `114 -> 初診加算料`
- `120 -> 再診`
- `124 -> 再診加算料`
- `130 -> 管理料`
- `132 -> 管理材料`
- `133 -> 管理加算料`
- `140 -> 在宅料`
- `141 -> 在宅薬剤`
- `142 -> 在宅材料`
- `143 -> 在宅加算料`
- `148 -> 在宅薬剤（院外処方）`
- `149 -> 在宅材料（院外処方）`
- `400 -> 処置`
- `401 -> 処置薬剤`
- `402 -> 処置材料`
- `403 -> 処置加算料`
- `409 -> 処置`
- `500 -> 手術`
- `501 -> 手術薬剤`
- `502 -> 手術材料`
- `510 -> 輸血`
- `600 -> 検査`
- `601 -> 検査薬剤`
- `602 -> 検査材料`
- `603 -> 検査加算料`
- `610 -> 検査`
- `700 -> 画像診断`
- `701 -> 画像診断薬剤`
- `702 -> 画像診断材料`
- `703 -> X線フィルム`
- `704 -> 画像診断加算料`
- `731 -> 造影剤・注入手技`
- `732 -> 造影剤・注入手技`

注意:

- `基本診療料`、`医学管理等`、`放射線` は UI broad label としては許容しても、送信 canonical としては不採用。
- ORCA が class name を厳密検証するかは未確定だが、少なくとも broad umbrella 名を送る根拠はない。

---

## 7. comment family の公式 carrier（確定版）

- `830XXXXXX -> Medication_Name`
- `842XXXXXX -> Medication_Number`
- `8501XXXXX -> Medication_Number`
- `8511XXXXX -> Medication_Number`
- `8521XXXXX -> Medication_Number`
- `831XXXXXX -> Medication_Number`

運用ルール:

- `830` は text value 必須。
- `842` は number value 必須。
- `8501/8511/8521/831` は structured value 必須。
- unknown comment family は send-block。
- general free-text comment と structured comment を同じ曖昧 field で扱わない。

### 7.1 selection comment parameter

- `medicationgetv2` で `Item_Number / Item_Number_Branch / Category` を取得してよい。
- ただし generic `medicalmodv2` outbound には出さない。
- picker / save / server mutation / send normalization の全段で block する。

---

## 8. local-only field 規則（確定版）

次は保存してよいが ORCA send payload / XML に出してはいけない。

- `bundleName`
- `admin`
- `adminCode`
- `adminCodeSystem`
- `adminMemo`
- `memo`
- `started`
- `startDate`
- `rowRole`
- `rowSubtype`
- `unit`
- `sourceSetCode`
- `itemMemo`
- `itemNumber`
- `itemNumberBranch`
- `selectionCommentItemNumber`
- `selectionCommentItemNumberBranch`
- `genericChangeAllowed`
- `doctorComment`
- `remarks`
- `prescriptionSettings`
- `numberCode*`
- `lower*`

`physiologyOrder.subtype`、`bacteriaOrder.subtype`、`specimen` も local-only。

---

## 9. entity ごとの設計決定

## 9.1 medOrder

### 保持すべきもの

- raw `Medical_Class`
- `Medical_Class_Number`
- `Medication_Generic_Flg` tri-state (`yes/no/inherit`)
- 85/831 family の raw structured value

### 今回の決定

- raw class を潰さない。
- `210/213`、`220/223`、`230/233` を round-trip で保持する。
- `Medication_Generic_Flg` は boolean ではなく tri-state にする。
- 85/831 family を general note から分離する。

### fail-closed

- 用法 carrier は一次確認未了。**usage がある RP は送信 block**。
- selection comment parameter は block。
- 85/831 family で structured value が欠けている row は block。

### やってはいけないこと

- `PRESCRIPTION_CLASS_CODES` を 211/212/221/222/231/232 のみで固定する。
- generic flag 未指定を `no` に丸める。
- 85/831 系 code を code+name だけで通す。

## 9.2 injectionOrder

### 今回の決定

- sendable class は `310/311/312/320/321/330/331/334/340/350`。
- `admin/adminCode/adminMemo/speed` は local-only。
- bodyPart は reject。
- `335/332/352` は current minimum contract から外す。
- synthetic admin row は作らない。

### やってはいけないこと

- `classCode == 310 only` を維持する。
- `adminCode required` を維持する。
- `adminCode` を `Medication_Code` へ直送する。

## 9.3 treatmentOrder

### class-aware grammar

- `400/409` = procedure-capable
  - main coded row 必須
  - add-on / drug / material / comment 許可
- `401` = drug-only
  - drug + comment のみ
  - procedure / material / bodyPart 禁止
- `402` = material-only
  - material + comment のみ
  - procedure / drug / bodyPart 禁止
- `403` = add-on-only
  - add-on + comment のみ
  - procedure / drug / material / bodyPart 禁止

### 今回の決定

- treatment bodyPart は reject。
- `400` 固定をやめる。
- `401/402/403` standalone を正式対応する。

## 9.4 surgeryOrder

### 今回の決定

- sendable は `500/501/502/510`。
- `520/540/541/542` は send-block。
- ORCA 送信では flat coded rows に統一する。
- surgery material rowRole / auxiliary rowRole を ORCA contract にしない。
- bodyPart は reject。

### やってはいけないこと

- `startsWith("5")` を送信可判定に使う。
- material rowRole の UI 表現と save/send/server の意味を変える。

## 9.5 testOrder / physiologyOrder / bacteriaOrder

### testOrder

- sendable class は `600/601/602/603/610`。
- `640/643` は reject。
- `startsWith("6")` をやめる。

class-aware grammar:

- `600/610` = main test mode
- `601` = drug-only
- `602` = material-only
- `603` = add-on-only

### physiologyOrder

- import-only。
- local save/fetch は許可。
- ORCA send は block。
- bodyPart は reject。
- sendable にしたい場合は generic `testOrder` / 600 family に正規化する。

### bacteriaOrder

- local-only。
- local save/fetch は許可。
- ORCA send は block。
- `culture/sensitivity` は optional local-only metadata。
- specimen は comment row flatten 予定の local convenience。

## 9.6 radiologyOrder

### 今回の決定

- sendable class は `700/701/702/703/704/731/732`。
- `710..724` は current minimum contract から外す。
- `Medical_Class_Name` canonical は `画像診断`。
- `放射線` canonical は廃止。

### modality-aware bodyPart

- plain X-ray / 写真診断: `002` row 許可
- CT/MRI: `002` row 禁止、selection comment bodyPart 必須
- mammography: bodyPart 任意
- standalone `701/702/703/704/731/732`: dedicated bodyPart field なし

### 今回の決定

- blanket `002 bodyPart 必須` を廃止する。
- `731/732` は standalone class として扱う。
- `contrastDrug/material` rowSubtype は local-only。

## 9.7 baseChargeOrder

### 今回の決定

- sendable class は `110/114/120/124` のみ。
- `基本診療料` umbrella canonicalization は廃止。
- 1 bundle = 1 exact `Medical_Class`。
- mixed-class charge bundle は reject または送信前 split。

## 9.8 instractionChargeOrder

### 今回の決定

- sendable class は `130/132/133/140/141/142/143/148/149` のみ。
- `医学管理等` umbrella canonicalization は廃止。
- class-specific grammar が未確定な部分は coded row + exact class の最小対応に留める。

## 9.9 otherOrder

### 今回の決定

- ORCA outbound から外す。
- local save/fetch のみ残す。
- `800..890` blanket acceptance を撤去する。

---

## 10. save / send 一貫性ルール

### 10.1 原則

- sendable entity では、save できるが send できない row を極力作らない。
- local-only / import-only entity だけは `save 可 / send 不可` を明示仕様とする。

### 10.2 明示例外

- `physiologyOrder`: save/fetch 可、send 不可
- `bacteriaOrder`: save/fetch 可、send 不可
- `otherOrder`: save/fetch 可、send 不可

### 10.3 selection comment

- `Item_Number / Item_Number_Branch` は UI 候補でも save でも send でも block。
- error key / message を統一する。

---

## 11. 新設すべき source-of-truth コンポーネント

### client

- `web-client/src/features/charts/orcaMedicalClassCatalog.ts`
- `web-client/src/features/charts/orcaCommentCarrierRules.ts`
- `web-client/src/features/charts/orcaSendabilityPolicy.ts`

### server

- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaCommentCarrierRules.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaSendabilityPolicy.java`

### 必須内容

- entity -> exact class allowlist
- classCode -> official className
- classCode -> editor mode
- comment family -> carrier rule
- entity -> local-only / import-only / send-block policy
- bodyPart policy by entity/class/modality

---

## 12. ホットスポットファイル

### client

- `web-client/src/features/charts/orderCategoryRegistry.ts`
- `web-client/src/features/charts/orderChargeClassSupport.ts`
- `web-client/src/features/charts/orderBundleContract.ts`
- `web-client/src/features/charts/orderBundleApi.ts`
- `web-client/src/features/charts/orderRpNormalization.ts`
- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/orcaClaimApi.ts`
- `web-client/src/features/charts/orderRpRequirements.ts`
- `web-client/src/features/charts/prescriptionOrderApi.ts`
- `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `web-client/src/features/charts/bacteriaOrderSupport.ts`
- `web-client/src/features/charts/orderDetailDisplayViewModel.ts`

### server

- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundle600SubtypeSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderImportSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassCanonicalSupport.java`

### tests

- `web-client/src/features/charts/__tests__/orderCategoryRegistry.test.ts`
- `web-client/src/features/charts/__tests__/orderBundleValidation.test.ts`
- `web-client/src/features/charts/__tests__/orderRpNormalization.test.ts`
- `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
- `web-client/src/features/charts/__tests__/orderSend600SubtypeSmoke.test.ts`
- `web-client/src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
- `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts`
- `web-client/src/features/charts/__tests__/OrderBundleEditPanel.600-subtype.test.tsx`
- `web-client/src/features/charts/__tests__/orderDetailDisplayViewModel.test.ts`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundle600SubtypeSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupportTest.java`

---

## 13. entity 別 acceptance criteria

### medOrder

- raw class round-trip で `210/213`、`220/223`、`230/233` を潰さない
- tri-state generic flag を lossless に round-trip
- 85/831 family を family-specific carrier で扱う
- usage ありなら send-block

### injectionOrder

- exact allowlist のみ送信可
- `admin/adminCode` local-only
- synthetic admin row なし
- bodyPart reject
- `335/332/352` block

### treatmentOrder

- `401/402/403` standalone を通す
- `409` を `400` に潰さない
- bodyPart reject

### surgeryOrder

- `500/501/502/510` のみ送信可
- `520/540/541/542` block
- surgery material rowRole の不整合解消

### testOrder / physiologyOrder / bacteriaOrder

- `testOrder` は `600/601/602/603/610` のみ
- `640/643` reject
- physiology は import-only
- bacteria は local-only

### radiologyOrder

- `700/701/702/703/704/731/732` のみ
- `Medical_Class_Name=画像診断`
- CT/MRI は selection comment bodyPart
- plain X-ray は `002` bodyPart 可
- mammography は bodyPart optional

### baseChargeOrder

- `110/114/120/124` のみ
- umbrella 名送信なし
- mixed-class bundle reject または split

### instractionChargeOrder

- `130/132/133/140/141/142/143/148/149` のみ
- umbrella 名送信なし
- `130..150` blanket acceptance なし

### otherOrder

- ORCA send block

---

## 14. notes 更新方針

更新対象:

- `web-client/notes/orca-order-remediation-20260403.md`
- `web-client/notes/orca-order-contract-cleanup-20260404.md`
- `web-client/notes/radiology-order-canonical-contract-20260404.md`
- `web-client/notes/orca-charge-canonicalization-20260404.md`

更新内容:

- hidden report なしでも current rule が分かるように書き換える
- broad range / broad prefix を削除する
- local-only / import-only / send-block を明記する
- selection comment parameter block を明記する
- `admin/adminCode`、`unit`、`bodyPart` の local-only / reject を code と一致させる

---

## 15. 未確認事項（今回の実装では block に倒す）

以下は一次資料のみでは送信可と断定できない。今回の実装では block / pending に倒す。

- medOrder の usage carrier
- injection の `335/332/352`
- surgery の `520/540/541/542`
- radiology の `710..724`
- generic `medicalmodv2` における `Item_Number / Item_Number_Branch` outbound
- `Medical_Class_Name` strictness の詳細
- `Medication_Continue` / `Medication_Internal_Kinds` の本格利用

---

## 16. 絶対に残してはいけないアンチパターン

- `startsWith("5")` / `startsWith("6")` を送信可判定に使う
- `110..125` / `130..150` の range 判定を送信可判定に使う
- `800..890` の blanket acceptance
- `className=基本診療料` / `医学管理等` / `放射線` を XML に出す
- `admin/adminCode` を注射の wire carrier にする
- treatment bodyPart を送る
- radiology 全件で `002 bodyPart 必須` を維持する
- `Item_Number / Item_Number_Branch` を payload に出す
- `physiologyOrder` / `bacteriaOrder` / `otherOrder` を sendable entity に戻す
- usage 未確認の medOrder row を送る
