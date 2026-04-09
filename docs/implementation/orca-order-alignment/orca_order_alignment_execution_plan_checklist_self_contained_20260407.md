# OpenDolphinNext ORCAオーダー整合 是正実装 作業計画書（チェックボックス式・自己完結版）

## 0. この計画書の使い方

- この計画書だけで、何をどこまで実装するか判断できるように書いてある。
- hidden report 参照は禁止。判断根拠は `orca_order_alignment_authoritative_spec_packet_20260407.md` と `orca_order_alignment_authoritative_tables_20260407.json` にすべて埋め込んである。
- 本計画書の checkbox は、**実装完了条件**を兼ねる。
- 本計画書は「迷わず実装できる」ことを目的にしている。未確認項目は block に倒す。拡張はしない。

---

## 1. 最終到達条件（ここを満たすまで完了扱いにしない）

- [ ] broad range / broad prefix に依存する送信可判定が client/server から消えている。
- [ ] exact `Medical_Class` allowlist が client/server の shared source-of-truth になっている。
- [ ] `Medical_Class_Name` が classCode exact map から決まる。
- [ ] `otherOrder` / `physiologyOrder` / `bacteriaOrder` が ORCA outbound から外れている。
- [ ] `medOrder` が raw class と generic flag tri-state を lossless に保持できる。
- [ ] 85/831 family が general note ではなく structured rule table で扱われる。
- [ ] `admin/adminCode` が注射 ORCA payload から消えている。
- [ ] treatment bodyPart が ORCA payload から消えている。
- [ ] radiology が `画像診断` canonical と modality-aware bodyPart policy へ切り替わっている。
- [ ] charge 系が umbrella name と broad range をやめ、exact class allowlist に変わっている。
- [ ] selection comment parameter (`Item_Number / Item_Number_Branch`) が picker/save/server/send の全段で block される。
- [ ] tests と notes が新仕様に同期している。

---

## 2. 実装対象ファイル一覧

### 2.1 client

- [ ] `web-client/src/features/charts/orderCategoryRegistry.ts`
- [ ] `web-client/src/features/charts/orderChargeClassSupport.ts`
- [ ] `web-client/src/features/charts/orderBundleContract.ts`
- [ ] `web-client/src/features/charts/orderBundleApi.ts`
- [ ] `web-client/src/features/charts/orderRpNormalization.ts`
- [ ] `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- [ ] `web-client/src/features/charts/orcaClaimApi.ts`
- [ ] `web-client/src/features/charts/orderRpRequirements.ts`
- [ ] `web-client/src/features/charts/prescriptionOrderApi.ts`
- [ ] `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- [ ] `web-client/src/features/charts/bacteriaOrderSupport.ts`
- [ ] `web-client/src/features/charts/orderDetailDisplayViewModel.ts`
- [ ] 新規 `web-client/src/features/charts/orcaMedicalClassCatalog.ts`
- [ ] 新規 `web-client/src/features/charts/orcaCommentCarrierRules.ts`
- [ ] 新規 `web-client/src/features/charts/orcaSendabilityPolicy.ts`

### 2.2 server

- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleMutationSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRowRoleSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundle600SubtypeSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderImportSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassSupport.java`
- [ ] `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChargeClassCanonicalSupport.java`
- [ ] 新規 `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalClassCatalog.java`
- [ ] 新規 `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaCommentCarrierRules.java`
- [ ] 新規 `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaSendabilityPolicy.java`

### 2.3 tests

- [ ] `web-client/src/features/charts/__tests__/orderCategoryRegistry.test.ts`
- [ ] `web-client/src/features/charts/__tests__/orderBundleValidation.test.ts`
- [ ] `web-client/src/features/charts/__tests__/orderRpNormalization.test.ts`
- [ ] `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
- [ ] `web-client/src/features/charts/__tests__/orderSend600SubtypeSmoke.test.ts`
- [ ] `web-client/src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
- [ ] `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- [ ] `web-client/src/features/charts/__tests__/prescriptionOrderApi.test.ts`
- [ ] `web-client/src/features/charts/__tests__/OrderBundleEditPanel.600-subtype.test.tsx`
- [ ] `web-client/src/features/charts/__tests__/orderDetailDisplayViewModel.test.ts`
- [ ] `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupportTest.java`
- [ ] `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleMutationExecutionSupportTest.java`
- [ ] `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundle600SubtypeSupportTest.java`
- [ ] `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResourceTest.java`
- [ ] `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaOrderBundleRecommendationSupportTest.java`

### 2.4 notes

- [ ] `web-client/notes/orca-order-remediation-20260403.md`
- [ ] `web-client/notes/orca-order-contract-cleanup-20260404.md`
- [ ] `web-client/notes/radiology-order-canonical-contract-20260404.md`
- [ ] `web-client/notes/orca-charge-canonicalization-20260404.md`

---

## 3. Phase 1: 横断基盤（最初に必ずやる）

### 3.1 class / comment / policy の source-of-truth 新設

- [ ] `orcaMedicalClassCatalog` を client に新設する。
  - [ ] entity ごとの exact class allowlist を定義する。
  - [ ] classCode -> official className map を定義する。
  - [ ] classCode -> editor mode (`procedure-capable`, `drug-only`, `material-only`, `add-on-only`, `main-test`, `standalone-radiology`) を定義する。
  - [ ] classCode -> sendability (`sendable`, `blocked-pending`, `blocked`) を定義する。
- [ ] `OrcaMedicalClassCatalog` を server に新設し、client と同じ表を持つ。
- [ ] `orcaCommentCarrierRules` を client に新設する。
  - [ ] `830 -> Medication_Name`
  - [ ] `842/8501/8511/8521/831 -> Medication_Number`
  - [ ] required value type を持たせる (`text/number/date/time/duration/procedureCode9`)。
  - [ ] unknown family を reject する。
- [ ] `OrcaCommentCarrierRules` を server に新設し、client と同じ表を持つ。
- [ ] `orcaSendabilityPolicy` を client に新設する。
  - [ ] local-only entity
  - [ ] import-only entity
  - [ ] selection comment parameter block
  - [ ] bodyPart policy
  - [ ] local-only field blocklist
- [ ] `OrcaSendabilityPolicy` を server に新設し、client と同じルールを持つ。

### 3.2 broad rule の置換

- [ ] `startsWith("5")` を全廃する。
- [ ] `startsWith("6")` を全廃する。
- [ ] `110..125` range 判定を全廃する。
- [ ] `130..150` range 判定を全廃する。
- [ ] `800..890` range 判定を全廃する。
- [ ] `8xxxxxxxx / 18xxxxxxx` だけで sendable 判定するロジックを全廃する。

### 3.3 送信 canonical ルールの共通化

- [ ] `Medical_Class` は source-of-truth からのみ決める。
- [ ] `Medical_Class_Name` は source-of-truth からのみ決める。
- [ ] `bundleName` から `Medical_Class_Name` を作る fallback を削除する。
- [ ] `entity label` から `Medical_Class_Name` を作る fallback を削除する。
- [ ] `resolveMedicalClass()` / server 同等処理が exact class allowlist に従うよう置換する。

---

## 4. Phase 2: send-block / local-only を先に統一する

### 4.1 otherOrder を ORCA outbound から外す

- [ ] `orderCategoryRegistry.ts` から `otherOrder` の ORCA送信 guidance を「送信対象外」に変更する。
- [ ] `ORCA_SEND_ORDER_ENTITIES` から `otherOrder` を削除する。
- [ ] `orcaClaimApi.ts` で `otherOrder` を explicit block する。
- [ ] `orderRpNormalization.ts` で `otherOrder` が来たら normalization 前に block する。
- [ ] server mutation / request support でも `otherOrder` ORCA outbound を block する。
- [ ] local save/fetch は維持する。
- [ ] `otherOrder` 用 send smoke を send-block に更新する。

### 4.2 physiologyOrder を import-only に統一する

- [ ] `ORCA_SEND_ORDER_ENTITIES` から `physiologyOrder` を削除する。
- [ ] `orderCategoryRegistry.ts` の guidance を「固有 carrier はない。generic 600 family へ正規化しない限り送れない」に修正する。
- [ ] `orcaClaimApi.ts` の send block を維持する。
- [ ] `OrderBundleEditPanel.tsx` の physiology local save 例外 throw を削除する。
- [ ] physiology は local save/fetch を許可する。
- [ ] server lower layer でも physiology outbound を explicit block する。
- [ ] smoke / panel test を「save 可・send 不可」に固定する。

### 4.3 bacteriaOrder を local-only に統一する

- [ ] `ORCA_SEND_ORDER_ENTITIES` から `bacteriaOrder` を削除する。
- [ ] `subtype required` validation を削除する。
- [ ] `culture/sensitivity` は optional local-only metadata に変更する。
- [ ] send path は entity 単位で block する。
- [ ] specimen を dedicated ORCA field として扱わない。
- [ ] `bacteriaOrderSupport.ts` は local convenience / future flatten 用に限定する。
- [ ] `830/842/831/8501/8511/8521` の comment family ルールは generic comment rule 側へ移す。
- [ ] save/fetch は維持し、send block を回帰化する。

### 4.4 注射 admin を local-only に戻す

- [ ] `admin/adminCode/adminMemo/speed` を ORCA sendable field 一覧から外す。
- [ ] `orderCategoryRegistry.ts` / guidance から「注射 ORCA送信で admin/adminCode を使う」を削除する。
- [ ] `orderBundleContract.ts` の `adminCode required` を削除する。
- [ ] `orderRpNormalization.ts` の synthetic admin row 生成を削除する。
- [ ] server request/mutation の `adminCode required` を削除する。
- [ ] send smoke の `4101/4102/4103` 先頭 row 期待を削除する。

---

## 5. Phase 3: medOrder（lossless 化）

### 5.1 class source-of-truth を redesign する

- [ ] `prescriptionOrderApi.ts` の処方 class 定義を exhaustive allowlist に置き換える。
- [ ] `210/211/212/213`、`220/221/222/223`、`230/231/232/233`、`290..298` を first-class にする。
- [ ] `category/location` から class code を再構成するロジックを廃止する。
- [ ] editor state / server DTO / source bundle で raw `medicalClass` を first-class にする。
- [ ] empty RP の default class は business decision で明示するが、save/fetch/sent の round-trip で raw class を絶対に失わない。

### 5.2 generic flag を tri-state に戻す

- [ ] `isGeneralNamePrescription:boolean` を tri-state に置換するか、別 field で補完して XML まで tri-state を lossless に持つ。
- [ ] `yes/no/inherit` の 3 値を保持する。
- [ ] import で absence を `false` に丸めない。
- [ ] send 時に `inherit` を `no` に丸めない。

### 5.3 structured comment family を first-class 化する

- [ ] `830/842/8501/8511/8521/831` を generic note ではなく structured rule table で扱う。
- [ ] `830` は text value を `Medication_Name` へ送る。
- [ ] `842/8501/8511/8521/831` は structured value を `Medication_Number` へ送る。
- [ ] value がない場合は client/save/server/send の全段で block する。
- [ ] current の「note があれば reject」ではなく「family-specific value がなければ reject」に変える。

### 5.4 usage は fail-closed に倒す

- [ ] 用法 carrier の一次確認が終わるまで、usage を含む RP は send-block にする。
- [ ] `buildUsageRow()` 直送をやめるか、少なくとも current release では send path で block する。
- [ ] UI で usage あり処方は「保存可・送信不可」と明示する。
- [ ] server 側も usage あり medOrder send を block する。

### 5.5 medOrder テスト

- [ ] raw class round-trip (`210/213`, `220/223`, `230/233`) を固定する。
- [ ] tri-state generic flag round-trip を固定する。
- [ ] 85/831 family の XML carrier を固定する。
- [ ] usage ありで send-block を固定する。
- [ ] selection comment parameter block を medOrder smoke に含める。

---

## 6. Phase 4: injectionOrder（exact class + admin local-only）

### 6.1 class allowlist を exact 化する

- [ ] `orderCategoryRegistry.ts` の injection class selector を `310/311/312/320/321/330/331/334/340/350` に変更する。
- [ ] `orderBundleContract.ts` の `classCode == 310 only` を撤去する。
- [ ] `OrcaOrderBundleRequestSupport.java` の `310 only` を exact allowlist に置換する。
- [ ] `335/332/352` は `blocked-pending` として UI / save / send / server 全段で block する。

### 6.2 row と field の送信契約を修正する

- [ ] synthetic admin row 生成を削除する。
- [ ] injection bodyPart 入力 UI を削除または reject にする。
- [ ] bodyPart rows を injection normalization から削除する。
- [ ] `Medication_Generic_Flg` を注射薬剤 row だけに出す。
- [ ] uncoded / mixed row reject は維持する。

### 6.3 injection テスト

- [ ] `310 only` 前提テストを削除する。
- [ ] exact class allowlist テストを追加する。
- [ ] `adminCode required` テストを削除し、local-only テストへ置換する。
- [ ] synthetic admin row が XML に出ないことを固定する。
- [ ] `335/332/352` block を固定する。

---

## 7. Phase 5: treatmentOrder（class-aware grammar + bodyPart 廃止）

### 7.1 class selector を exact 化する

- [ ] class selector options を `400/401/402/403/409` にする。
- [ ] `400/409` を procedure-capable mode にする。
- [ ] `401` を drug-only mode にする。
- [ ] `402` を material-only mode にする。
- [ ] `403` を add-on-only mode にする。

### 7.2 treatment bodyPart を撤去する

- [ ] `OrderBundleEditPanel.tsx` の treatment bodyPart UI を削除する。
- [ ] `orderRpNormalization.ts` の treatment bodyPart row 出力を削除する。
- [ ] server request/mutation から treatment bodyPart 許可を削除する。
- [ ] treatment bodyPart は `unsupported_body_part` を返す。

### 7.3 validation を class-aware にする

- [ ] `400/409` は main coded row 必須。
- [ ] `401` は drug + comment のみ許可。
- [ ] `402` は material + comment のみ許可。
- [ ] `403` は add-on + comment のみ許可。
- [ ] `401/402/403` では current の `main row required` を掛けない。

### 7.4 treatment テスト

- [ ] `401` standalone accept。
- [ ] `402` standalone accept。
- [ ] `403` standalone accept。
- [ ] `409` を `400` に潰さない。
- [ ] treatment bodyPart reject を client/server 両方で固定する。

---

## 8. Phase 6: surgeryOrder（5xx exact scope + rowRole 不整合解消）

### 8.1 scope を current minimum contract に縮める

- [ ] `500/501/502/510` のみ sendable にする。
- [ ] `520/540/541/542` は save/fetch で持てても ORCA send では block にする。
- [ ] `startsWith("5")` 判定を全廃する。

### 8.2 class-aware grammar を明示する

- [ ] `500` = procedure-capable。
- [ ] `501` = drug-only。
- [ ] `502` = material-only。
- [ ] `510` = procedure-capable。

### 8.3 rowRole/material 不整合を解消する

- [ ] surgery material rowRole を ORCA send contract から外す。
- [ ] editor/save/send/server で surgery rows は flat coded rows に統一する。
- [ ] `OrcaOrderBundleRowRoleSupport.java` の surgery auxiliary/material reject と editor/save ルールを一致させる。
- [ ] surgery bodyPart は reject にする。

### 8.4 surgery テスト

- [ ] `500/501/502/510` sendable。
- [ ] `520/540/541/542` send-block。
- [ ] surgery material rowRole に依存しない save/send consistency。
- [ ] 9桁以外の main row reject。

---

## 9. Phase 7: testOrder / physiologyOrder / bacteriaOrder

### 9.1 testOrder を exact class 対応にする

- [ ] class selector options を `600/601/602/603/610` にする。
- [ ] `600/610` = main test mode。
- [ ] `601` = drug-only mode。
- [ ] `602` = material-only mode。
- [ ] `603` = add-on-only mode。
- [ ] `640/643` pathology を reject にする。
- [ ] `startsWith("6")` 互換を全廃する。

### 9.2 physiologyOrder を import-only に統一する

- [ ] panel/local save 例外 throw を削除する。
- [ ] local save/fetch は維持する。
- [ ] ORCA send だけ block する。
- [ ] guidance と notes を「generic 600 family へ正規化しない限り送れない」に修正する。

### 9.3 bacteriaOrder を local-only に統一する

- [ ] subtype required を削除する。
- [ ] `culture/sensitivity` は optional local-only metadata にする。
- [ ] send path は entity 単位で block にする。
- [ ] bacteria 専用 comment family 特例は generic rule table へ移す。

### 9.4 test/physiology/bacteria テスト

- [ ] `testOrder` allowlist (`600/601/602/603/610`)。
- [ ] `640/643` reject。
- [ ] physiology local save/fetch allowed + send block。
- [ ] bacteria local save/fetch allowed + send block。
- [ ] subtype required test を optional local-only へ更新。

---

## 10. Phase 8: radiologyOrder（exact class + modality-aware bodyPart）

### 10.1 class / className を修正する

- [ ] default className を `放射線` から `画像診断` に変更する。
- [ ] class selector options を `700/701/702/703/704/731/732` にする。
- [ ] `710/711/712/713/720/721/723/724` は current minimum contract から外す。

### 10.2 bodyPart policy を modality-aware にする

- [ ] bodyPart policy enum を導入する。
  - [ ] `plain_xray_or_photo` -> `002` row 許可
  - [ ] `ct_mri` -> `002` row 禁止、selection comment bodyPart 必須
  - [ ] `mammography` -> bodyPart 任意
  - [ ] `standalone_class` (`701/702/703/704/731/732`) -> dedicated bodyPart field なし
- [ ] CT/MRI で `002` bodyPart と selection comment bodyPart が両方ある場合は reject。
- [ ] CT/MRI で selection comment bodyPart が無い場合は reject。
- [ ] blanket `missing_body_part` ルールをやめる。

### 10.3 standalone class を扱えるようにする

- [ ] `701/702/703/704/731/732` では `700 main row required` を掛けない。
- [ ] `731/732` は standalone class として送る。
- [ ] `contrastDrug/material` rowSubtype は local-only とする。
- [ ] `contrastDrug/material` を ORCA canonical send carrier とみなさない。

### 10.4 radiology テスト

- [ ] `700` 単純X線 sample を round-trip する。
- [ ] CT/MRI bodyPart = selection comment only を固定する。
- [ ] `701/702/703/704/731/732` standalone を固定する。
- [ ] `710..724` block を固定する。
- [ ] mammography bodyPart optional を固定する。
- [ ] className `画像診断` を固定する。

---

## 11. Phase 9: charge 系（exact class + exact name）

### 11.1 baseChargeOrder

- [ ] allowlist を `110/114/120/124` のみにする。
- [ ] `基本診療料` umbrella canonicalization を廃止する。
- [ ] `Medical_Class_Name` を exact map で送る。
- [ ] `110..125` blanket validation を削除する。
- [ ] mixed-class charge bundle を reject または送信前 split にする。
- [ ] exact-class bundle でのみ `bundleNumber -> Medical_Class_Number` を有効にする。

### 11.2 instractionChargeOrder

- [ ] allowlist を `130/132/133/140/141/142/143/148/149` のみにする。
- [ ] `医学管理等` umbrella canonicalization を廃止する。
- [ ] 13系 / 14系 official label を exact map で送る。
- [ ] `130..150` blanket validation を削除する。
- [ ] class-specific grammar 未確認部分は coded row + exact class の最小対応に留める。

### 11.3 charge テスト

- [ ] `120 -> 再診` を固定する。
- [ ] `110/114/120/124` allowlist を固定する。
- [ ] `130/132/133/140/141/142/143/148/149` allowlist を固定する。
- [ ] `131/144/145/146/147/150` reject を固定する。
- [ ] XML に `基本診療料` / `医学管理等` が出ないことを固定する。
- [ ] mixed-class charge bundle reject を固定する。

---

## 12. Phase 10: cross-cutting validation / normalization 仕上げ

### 12.1 local-only 漏れ防止

- [ ] `unit` が payload/XML に出ない。
- [ ] `admin/adminMemo` が payload/XML に出ない。
- [ ] `memo` / `started` / `sourceSetCode` / `item memo` が payload/XML に出ない。
- [ ] `rowRole` / `rowSubtype` が payload/XML に出ない。

### 12.2 selection comment parameter の全段 block

- [ ] picker block
- [ ] save block
- [ ] server mutation block
- [ ] send normalization block
- [ ] 同一 error key / 同一理由文言に揃える

### 12.3 unresolved code block

- [ ] input code を `Medication_Code` として送らない。
- [ ] unresolved row は send-block。
- [ ] code resolution 前提の entity は save でも warning ではなく block にするか local-only に落とす。

### 12.4 notes 更新

- [ ] `medOrder`: raw class / tri-state / 85/831 / usage block に更新。
- [ ] `injectionOrder`: exact class + admin local-only に更新。
- [ ] `treatmentOrder`: bodyPart 廃止 + class-aware grammar に更新。
- [ ] `surgeryOrder`: `500/501/502/510` のみ current minimum contract と明記。
- [ ] `test/physiology/bacteria`: 600 allowlist / import-only / local-only に更新。
- [ ] `radiologyOrder`: `画像診断`, exact class, modality-aware bodyPart に更新。
- [ ] `charge`: exact class map と umbrella 名廃止に更新。

---

## 13. テスト作業の細目

### 13.1 client unit/integration

- [ ] `orderCategoryRegistry.test.ts` に sendable/local-only/import-only policy を追加する。
- [ ] `orderBundleValidation.test.ts` に entity ごとの allowlist / reject / bodyPart / standalone class を追加する。
- [ ] `orderRpNormalization.test.ts` に XML payload 形を追加する。
- [ ] `orderSendSmoke.test.ts` に entity ごとの e2e smoke を追加する。
- [ ] `orderSend600SubtypeSmoke.test.ts` を physiology/bacteria block 前提へ更新する。
- [ ] `orderBundleOrcaSupport.test.tsx` に guidance 文言更新を反映する。
- [ ] `chartsActionBar.orca-send.test.tsx` に blocked entity を反映する。
- [ ] `prescriptionOrderApi.test.ts` に raw class / tri-state / structured comment / usage block を追加する。
- [ ] `OrderBundleEditPanel.600-subtype.test.tsx` を local save/fetch + send block 前提へ更新する。
- [ ] `orderDetailDisplayViewModel.test.ts` に radiology bodyPart policy を追加する。

### 13.2 server unit/integration

- [ ] `OrcaOrderBundleRequestSupportTest.java` に exact allowlist を追加する。
- [ ] `OrcaOrderBundleMutationExecutionSupportTest.java` に entity 別 reject / standalone / bodyPart / structured comment を追加する。
- [ ] `OrcaOrderBundle600SubtypeSupportTest.java` を physiology/bacteria local-only 前提へ更新する。
- [ ] `OrcaPrescriptionOrderResourceTest.java` に medOrder structured comment / tri-state / usage block を追加する。
- [ ] `OrcaOrderBundleRecommendationSupportTest.java` に radiology rowSubtype local-only 化を反映する。
- [ ] XML serialization regression を追加し、className / classCode / local-only field non-leak を確認する。

---

## 14. 検証手順

### 14.1 web-client

- [ ] 依存関係を既存 lockfile に合わせて install する。
- [ ] `npm run typecheck` を通す。
- [ ] 影響ファイルの vitest を targeted で実行する。
- [ ] 最後に `npm run test:ci` または同等の網羅コマンドを実行する。

### 14.2 server-modernized

- [ ] Maven module として server tests を targeted で実行する。
- [ ] 最後に server-modernized の関連テスト群を通す。
- [ ] multi-module root が必要な場合は root pom から module 指定で実行する。

### 14.3 最低限の最終確認

- [ ] client typecheck 成功
- [ ] client tests 成功
- [ ] server tests 成功
- [ ] blocked entity が 실제に send-block される
- [ ] sendable entity が exact class / exact className で XML 化される
- [ ] local-only field が payload/XML に漏れない

---

## 15. 作業中に絶対にやってはいけないこと

- [ ] hidden report を参照前提にしない。
- [ ] broad range / broad prefix を復活させない。
- [ ] official root 不明の carrier を自作しない。
- [ ] `Item_Number / Item_Number_Branch` を outbound payload に出さない。
- [ ] `bundleName` を `Medical_Class_Name` の source にしない。
- [ ] `admin/adminCode` を注射 outbound row に戻さない。
- [ ] treatment bodyPart を復活させない。
- [ ] radiology を `700 + 放射線 + 002必須` に戻さない。
- [ ] `physiologyOrder` / `bacteriaOrder` / `otherOrder` を sendable entity に戻さない。
- [ ] medOrder usage 未確認のまま sendable にしない。

---

## 16. Definition of Done

- [ ] Phase 1 〜 Phase 10 の checkbox がすべて埋まっている。
- [ ] 新規 source-of-truth catalog/rules/policy が client/server 双方にある。
- [ ] broad canonicalization が削除されている。
- [ ] ORCA XML の classCode/className が exact map に従っている。
- [ ] blocked/local-only/import-only が UI・save・send・server・tests・notes で一致している。
- [ ] final report に「変更ファイル一覧」「未解決ゼロ」「実行した tests」「残した intentional block」を明記している。
