# ORCAオーダー是正 作業計画書

## 目的

ORCAオーダー系の保存・再読込・送信正規化・medicalmodv2 XML を本番運用前提で是正し、**「画面で保存できる内容」と「ORCAへ送られる内容」が一致する状態**へ移行する。

## 固定前提

- 後方互換性は考慮しない。
- 旧DB遺産は考慮しない。
- build成果物は無視し、ソースコードだけを対象にする。
- 外部情報は使わず、このリポジトリと既存レビュー結果だけを根拠にする。
- 送れない値は黙って落とさず、**保存前または送信前で必ず明示ブロック**する。
- UI/DTO に存在する属性は、**ORCA に送る / local-only として閉じる**のどちらかへ明示的に寄せる。

## 完了条件

- [ ] 処方を含む全オーダーで、保存 source of truth と ORCA送信 source of truth が一致している。
- [x] code-less row / mixed coded+uncoded row / manual bodyPart などの **silent drop** が消えている。
- [x] `testOrder / laboTest`、`generalOrder / treatmentOrder`、charge class meta の canonical rule が全層で一貫している。
- [x] `unit` を含む送信対象属性が medicalmodv2 XML まで到達するか、未対応として UI/validation で閉じられている。
- [ ] `bodyPart`、`adminCode`、row role / subtype、コメント parameter などの first-class 化が必要な箇所が解消されている。
- [ ] editor 必須条件と送信前必須条件が一致し、ORCA へ送れない入力が UI 上で誤認されない。
- [ ] web-client / server-modernized の回帰テストで、save → fetch → normalize → XML までの貫通ケースが守られている。

---

## 0. 決定ログ（最初に埋める）

> 実装着手前に、この欄へ canonical decision を記入する。未決定のままコード変更を開始しない。

- [x] `testOrder / laboTest` の canonical entity を決定し、この文書へ追記する。
  - canonical entity は `testOrder` とする。`laboTest` は ingress 互換 alias としてのみ受け、fetch / input set / save / send / summary では `testOrder` へ正規化する。
- [x] `generalOrder` を `treatmentOrder` の alias とするか、別概念として維持するかを決定し、この文書へ追記する。
  - `generalOrder` は `treatmentOrder` の ingress alias とし、400系は save / input set / send の canonical を `treatmentOrder` に統一する。`otherOrder` は 800系の別概念として維持する。
- [x] charge 系（`baseChargeOrder` / `instractionChargeOrder`）の class meta を **entity default ではなく first-class 保存値**として扱う方針を追記する。
  - charge 系は `classCode / classCodeSystem / className` を first-class 保存値として扱い、既存 bundle / input set が持つ class 粒度を edit-save で entity default に再計算しない。entity default は新規作成時の初期値にのみ使う。
- [x] `bodyPart` を first-class field で持つ種別と、通常 code row としてのみ扱う種別を決定して追記する。
  - `bodyPart` を first-class field で保持するのは `radiologyOrder` と 400/800 系の body part 対応 bundle（canonical `treatmentOrder` / `otherOrder`）とする。その他の entity では body part 風コードを専用 field に昇格させず、通常 code row として扱う。
- [x] `unit` / `memo` / `admin` / `adminCode` / `bundleName` / `startDate` / `item.memo` について、**送信対象**か **local-only** かを種別ごとに追記する。
  - `unit`: ORCA へ送る coded row の first-class 送信対象とする。medicalmodv2 XML まで必ず到達させる。
  - `admin` / `adminCode`: `medOrder` と `injectionOrder` の送信対象とする。保存・fetch・送信では別 field として保持し、usage / administration row に落とし込む。その他 entity では local-only。
  - `bundleName`: 全 entity で local-only。UI 表示名として保持するが ORCA XML へは送らない。
  - `startDate`: 全 entity で local-only。bundle 単位の編集・再表示には保持するが ORCA XML へは送らない。
  - `memo`: free-form memo は local-only。ORCA へ送る必要がある内容は coded row / first-class field に構造化し、構造化できない値は送信前に block する。
  - `item.memo`: free-form comment は local-only。hidden meta の運搬には使わず、送信対象が必要な場合は first-class field または coded comment row に分離する。
- [x] `genericFlg` を一般名相当と後発品可否に分離する方針を追記する。
  - 処方・注射の drug meta では `genericFlg` を廃止し、`isGeneralNamePrescription` と `genericChangeAllowed` に分離する。後発品可否だけを ORCA generic flag へ反映し、一般名相当表示は別 field として round-trip する。
- [x] `rpNumber` を RP 識別子として一意化する方針を追記する。
  - `rpNumber` は stable な RP 識別子として保存し、`Medical_Class_Number` / 日数・回数とは分離する。RP identity は `bundleNumber` から導出しない。

---

## 1. P0ブロッカー是正

### 1-1. save/send source of truth 統一

- [x] 処方の保存経路と ORCA送信経路を一本化する。
  - 主対象: `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
  - 主対象: `web-client/src/features/charts/prescriptionOrderApi.ts`
  - 主対象: `web-client/src/features/charts/ChartsActionBar.tsx`
  - 主対象: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
  - 主対象: `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionOrderRepository.java`
- [ ] 処方保存後に UI 表示・再読込・送信 payload が同一内容になる E2E テストを追加する。

### 1-2. silent drop 禁止

- [x] non-med 全種別で code-less row が送信時に黙って落ちないよう、保存前または送信前で明示ブロックする。
- [x] mixed coded / uncoded row がある bundle を送信前に明示エラーにする。
- [x] coded comment だけが送られて main row が落ちるケースを禁止する。
- [x] `ChartsActionBar` の `filter(Boolean)` 依存をやめ、bundle 単位の drop 理由をユーザーに可視化する。
  - 主対象: `web-client/src/features/charts/OrderBundleEditPanel.tsx`
  - 主対象: `web-client/src/features/charts/orderRpNormalization.ts`
  - 主対象: `web-client/src/features/charts/orderRpRequirements.ts`
  - 主対象: `web-client/src/features/charts/ChartsActionBar.tsx`

### 1-3. entity / class canonical 化

- [x] `testOrder / laboTest` の canonical rule を save / fetch / input set / summary / projection / send で統一する。
- [x] `generalOrder / treatmentOrder` の canonical rule を save / input set / send で統一する。
- [ ] `baseChargeOrder / instractionChargeOrder` の class meta を form state で保持し、編集保存で entity default に潰さない。
- [ ] `classCode 600` の subtype が send grouping で二重化しないよう修正する。
- [ ] `classCode 400` の input set / UI / send meaning が三重化しないよう修正する。
  - 主対象: `web-client/src/features/charts/orderCategoryRegistry.ts`
  - 主対象: `web-client/src/features/charts/OrderDockPanel.tsx`
  - 主対象: `web-client/src/features/charts/RightUtilityDrawer.tsx`
  - 主対象: `web-client/src/features/charts/SoapNotePanel.tsx`
  - 主対象: `web-client/src/features/charts/OrderBundleEditPanel.tsx`
  - 主対象: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
  - 主対象: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
  - 主対象: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`

### 1-4. XML 契約の最小是正

- [x] `unit` を medicalmodv2 XML へ出力するか、未対応として UI/validation で閉じる。
- [ ] `Medical_Class` / `Medical_Class_Name` / `Medical_Class_Number` だけでは意味不足な種別について、最低限必要な送信表現を整理する。
- [x] 実 XML を直接検査する server test を追加する。
  - 主対象: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
  - 主対象: `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportSupportTest.java`

---

## 2. 横断データモデル是正

### 2-1. first-class field 化

- [x] `adminCode / adminCodeSystem` を必要種別で first-class field として保存・取得・送信できるようにする。
- [x] `bodyPart` を必要種別で first-class field とし、items との二重表現をやめる。
- [ ] row role / subtype（手技・材料・薬剤・検体・培養・感受性・本体・造影・コメント等）を必要種別で保持できるようにする。
- [ ] コメント parameter（選択式コメントの itemNumber / branch など）を first-class にするか、未対応として入力不可にする。
- [ ] `setCode` provenance を保持するか、仕様として expansion-only に固定して UI と監査経路を揃える。

### 2-2. private memo codec 解体

- [x] 処方の `__rx_*` / `__orca_meta__` 依存を縮小し、first-class DTO へ移す。
- [ ] item memo を generic meta 兼用にしている箇所を整理し、自由コメントと hidden meta を分離する。
- [ ] hidden field（`adminMemo`、hidden `bodyPart`、`手技料なし` sentinel など）のまま意味を持つ実装をなくす。

### 2-3. local-only と送信対象の整理

- [x] local-only に残す属性を明文化し、UI 表示も「院内ローカル情報」と分かるようにする。
- [ ] ORCA へ送る属性は DTO / save / fetch / normalize / XML の全層で落ちないようにする。
- [ ] local-only にする属性は送信前 validation から除外し、誤解を招く placeholder / label を修正する。

---

## 3. UI / validation 是正

### 3-1. 共通 editor

- [x] `BundleFormState` に non-med の class meta を保持する。
- [x] `validateBundleForm` を「入力できるか」ではなく「ORCA へ送れるか」で見直す。
- [ ] `supportsBodyPartSearch`、`supportsInjectionNoProcedure`、`supportsCommentCodes` の意味が送信契約と一致するよう見直す。
- [ ] input set 反映時に hidden field や entity mismatch が起きないよう修正する。

### 3-2. 送信前 validation

- [x] `medOrder / injectionOrder` だけでなく、non-med 全種別の送信前ガードを整備する。
- [x] unsupported field を含む bundle は、bundle 単位の明示エラーにする。
- [x] `002...` bodyPart code や comment code を含む行が送信前コード検査で誤判定されないよう見直す。
- [x] `40/40` 制限や `Medical_Class` 粗粒度化による grouping リスクを検知するテストまたは guard を追加する。

---

## 4. 種別別作業

### 4-1. 処方 (`medOrder`)

- [x] 処方保存と ORCA送信の source of truth を一本化する。
- [x] `genericFlg` を「一般名相当」と「後発品可否」に分離する。
- [x] `rpNumber` を一意な RP 識別子にする。
- [ ] `221 / 222 / 231 / 232` の input set 取込で classCode / usageCode / comments / location / category が壊れないようにする。
- [x] `location:'out'` / `category:'regular'` の固定値を撤去する。
  - recommendation / input set 取込時は `Medical_Class` を起点に RP の `location` / `category` を再構成し、hard-coded default を使わない。
- [ ] `remark`、`doctorComment`、`drugComment`、`claimComments.note`、`refillCount`、`refillPattern`、`patientRequest`、`lower*`、自由入力 `usage` の扱いを決め、送るか閉じるかを統一する。
- [ ] code なし請求コメントを送るのか閉じるのかを明文化する。
- [ ] 1 RP 複数薬剤・複数 RP・全 classCode の save/fetch/send/XML テストを追加する。

### 4-2. 注射 (`injectionOrder`)

- [x] `admin` と `adminCode` を分離する。
- [ ] route / timing / frequency / speed / dosePerDay の扱いを first-class にするか local-only として閉じる。
- [x] `supportsInjectionNoProcedure=true` の sentinel 実装をやめ、意味を送るか UI から外すかを決める。
- [ ] 点滴セット・手技+薬剤・薬剤のみの 3 パターンで role を保持できるようにする。
- [ ] 注射の自由コメントと hidden meta が衝突しないよう整理する。
- [ ] 注射の generic flag / comment / unit / adminCode を含む round-trip と XML テストを追加する。

### 4-3. 基本診療料 / 指導料 (`baseChargeOrder` / `instractionChargeOrder`)

- [ ] 編集フォームで explicit classCode / className / classCodeSystem を保持する。
- [ ] ORCA入力セットや既存 bundle の class 粒度を edit-save で潰さない。
- [ ] `adminMemo` の hidden state をなくし、必要なら UI 可視化する。
- [ ] 84系コメント / 選択式コメント parameter を first-class にするか入力不可にする。
- [ ] `unit`、算定指示、算定メモ、コメント parameter の送信方針を固定する。
- [ ] basic / instruction charge の save/send/XML テストを追加する。

### 4-4. 処置 / 一般 / その他 (`treatmentOrder` / `generalOrder` / `otherOrder`)

- [x] `generalOrder` の意味を固定し、`treatmentOrder` との relation を一本化する。
- [ ] row role（手技 / 材料 / 併用薬剤 / コメント）を保持する。
- [x] `bodyPart` の二重表現をやめる。
- [ ] `otherOrder` を「処置の逃げ道」にしないよう、許容入力を見直す。
- [ ] `setCode`、`bundleName`、`admin`、`memo` の扱いを送信契約に合わせて整理する。
- [x] 400 / 800 系の code-less row、comment-only、quantity-only ケースを明示 block にする。
- [ ] 400 / 800 系の save/fetch/send/XML テストを追加する。

### 4-5. 放射線 (`radiologyOrder`)

- [ ] radiology 700 束の成立条件（本体コード、部位、材料/造影 role）を定義し validation へ反映する。
- [x] `bodyPart` の manual / master selected 両経路を単一モデルに統一する。
- [x] bodyPart code と通常 row の競合を解消する。
- [ ] row order（bodyPart / 本体 / 造影 / 材料 / comment）を round-trip で保持する。
- [ ] `startsWith('7')` 材料判定が radiology item を誤分類しないよう修正する。
- [x] radiology save/fetch/send/XML テストを追加する。

### 4-6. 検体 / 生理 / 細菌 (`testOrder` / `physiologyOrder` / `bacteriaOrder`)

- [x] `testOrder / laboTest` の canonical 化を完了する。
- [x] class 600 の input set が canonical entity に整合するよう修正する。
- [ ] 検査指示 / 採取条件 / 至急 / 備考 / specimen / culture / sensitivity / physiology subtype の構造化方針を決める。
- [ ] 生理検査 UI を generic 検体 UI 流用から必要範囲で分離する。
- [ ] bacteriaOrder の必須項目と subtype を first-class にする。
- [ ] hidden bodyPart / hidden adminMemo をなくす。
- [ ] class 600 の subtype が send grouping で別群乱立しないよう整理する。
- [ ] 600 系 save/fetch/input set/send/XML テストを追加する。

---

## 5. サーバ側保存・入力セット・XML 是正

### 5-1. 保存 / fetch

- [x] `OrcaOrderBundleMutationSupport` / `FetchSupport` で first-class 化した属性を lossless に扱う。
- [x] raw entity strict equality 依存をやめ、canonical entity rule に寄せる。
- [ ] `entity / classCode / item群` の不整合を server 側でも弾く。

### 5-2. input set / recommendation

- [x] class 400 / 600 / 700 / 800 の input set entity 解決を canonical rule に合わせて是正する。
- [ ] input set detail から落としてはいけない class meta / memo / comment / provenance を落とさない。
- [ ] recommendation/template が持つ row role / bodyPart / materialItems が front で潰れないよう契約を揃える。

### 5-3. XML builder

- [x] `OrcaChartSupportSupport` に必要な属性を追加し、`unit` をはじめ silent loss をなくす。
- [ ] XML に出さない属性は upstream validation/UI で閉じる。
- [ ] actual XML snapshot / assertion test を種別ごとに追加する。

---

## 6. テスト補強

### 6-1. web-client

- [x] entity canonicalization テスト（`testOrder/laboTest`, `generalOrder/treatmentOrder`）
- [x] save payload テスト（class meta / bodyPart / adminCode / setCode）
- [x] send preflight テスト（mixed coded/uncoded, unsupported field, bodyPart code, comment parameter）
- [ ] ORCA input set apply テスト（400/600/700/800 と処方）
- [ ] Rx / injection / radiology / 600系 / charge の happy path send テスト
- [ ] builder mock に依存しない統合寄りテストを追加する。

### 6-2. server-modernized

- [x] request validation テスト（canonical entity, class/item consistency）
- [x] mutation/fetch round-trip テスト（first-class fields, role, bodyPart, adminCode）
- [x] input set metadata/detail テスト（400/600 canonical, Rx semantics）
- [x] actual XML テスト（unit, class, rows, comments, local-only rejection）
- [ ] 처방 import / merge テスト（unique `rpNumber`, usageCode, comments）

### 6-3. 回帰・QA

- [ ] `save → fetch → normalize → XML` を通す smoke suite を用意する。
- [ ] 代表ケースを最低 1 本ずつ追加する。
  - [ ] 処方: 1 RP 2薬剤 + コメント + 一般名/後発品可否
  - [x] 注射: 手技+薬剤 + admin/adminCode + 回数
  - [ ] 基本/指導料: 非 default class の再編集保存
  - [x] 一般/処置/その他: mixed row を含む bundle
  - [x] 放射線: bodyPart + 本体 + 材料/造影
  - [ ] 検体/生理/細菌: canonical entity + subtype + input set

---

## 7. 完了時の仕上げ

- [x] この計画書の全チェックを更新する。
- [x] 最終的に local-only と送信対象の一覧を文書化する。
- [x] 変更ファイル一覧と、未解決リスク一覧を `notes/` に残す。
- [x] 実行した test コマンドと結果を記録する。
- [x] 追加した canonical rule を README/notes の適切な場所へ残す。

---

## 推奨実行順

1. 決定ログを埋める
2. P0ブロッカー（save/send SoT、silent drop、canonical、XML unit）
3. first-class field 化
4. UI / validation 是正
5. サーバ保存・input set・XML builder 是正
6. 種別別の残課題
7. テスト補強と最終文書更新
