# ORCAオーダー是正 作業計画書

## 目的

ORCAオーダー系の保存、再読込、送信正規化、medicalmodv2 XML を本番運用前提で是正し、画面で保持できる内容と ORCA へ送る内容が一致する状態へ統一する。

## 固定前提

- 後方互換性は考慮しない。
- 旧 DB 遺産は考慮しない。
- build 成果物は無視し、ソースコードだけを対象にする。
- 外部情報は使わず、このリポジトリ、既存ソース、既存テストだけを根拠にする。
- 送れない値は黙って落とさず、保存前または送信前で必ず明示ブロックする。
- UI/DTO に存在する属性は、ORCA に送るか local-only として閉じるかを明示的に決める。

## 完了条件

- [x] 処方を含む全オーダーで、保存 source of truth と ORCA 送信 source of truth が一致している。
- [x] code-less row / mixed coded+uncoded row / manual bodyPart などの silent drop が解消されている。
- [x] `testOrder / laboTest`、`generalOrder / treatmentOrder`、charge class meta の canonical rule が全層で一貫している。
- [x] `unit` を含む送信対象属性が medicalmodv2 XML まで到達するか、未対応として UI/validation で閉じられている。
- [x] `bodyPart`、`adminCode`、row role / subtype、comment parameter などの first-class 化が必要な箇所が解消されている。
- [x] editor 必須条件と送信前必須条件が一致し、ORCA へ送れない入力が UI 上で誤認されない。
- [x] web-client / server-modernized の回帰テストで、save -> fetch -> normalize -> XML の貫通ケースが守られている。

---

## 0. 決定ログ

- [x] `testOrder / laboTest` の canonical entity は `testOrder` とする。
  - `laboTest` は ingress 互換 alias としてのみ受け、fetch / input set / save / send / summary では `testOrder` へ正規化する。
- [x] `generalOrder` は `treatmentOrder` の ingress alias とし、400 系の canonical を `treatmentOrder` に統一する。
  - `otherOrder` は 800 系の別概念として維持する。
- [x] charge 系 (`baseChargeOrder` / `instractionChargeOrder`) の class meta は entity default ではなく first-class 保存値として扱う。
  - `classCode / classCodeSystem / className` は edit-save で再計算しない。
- [x] `bodyPart` は first-class field として扱う種別を固定する。
  - `radiologyOrder` と bodyPart 対応の 400/800 系 bundle では専用 field として保持する。
  - その他 entity では body part 風コードを通常 row として扱う。
- [x] `unit / memo / admin / adminCode / bundleName / startDate / item.memo` の send / local-only 方針を固定する。
  - `unit`: coded row の送信対象。
  - `admin / adminCode`: `medOrder` と `injectionOrder` の送信対象。
  - `bundleName`: local-only。
  - `startDate`: local-only。
  - free-form `memo`: local-only。送信対象が必要な場合は first-class field または coded row に構造化する。
  - `item.memo`: free-form comment は local-only。hidden meta 運搬には使わない。
- [x] `genericFlg` は一般名相当の表示と後発品可否を分離する。
  - ORCA generic flag に相当する送信値と UI 表示用の意味を混同しない。
- [x] `rpNumber` は RP 識別子として一意に扱う。
  - `bundleNumber` や `Medical_Class_Number` から RP identity を導出しない。

---

## 1. P0 ブロッカー是正

### 1-1. save/send source of truth 統一

- [x] 処方の保存経路と ORCA 送信経路を一本化した。
- [x] 処方保存後に UI 表示、再読込、送信 payload が同一内容になるテストを追加した。

### 1-2. silent drop 禁止

- [x] non-med 全種別で code-less row が送信時に黙って落ちないよう、保存前または送信前で明示ブロックするようにした。
- [x] mixed coded / uncoded row を含む bundle は送信前に明示エラーにした。
- [x] coded comment だけが送られて main row が落ちるケースを禁止した。
- [x] bundle 単位の drop を `filter(Boolean)` に依存させないようにした。

### 1-3. entity / class canonical 化

- [x] `testOrder / laboTest` の canonical rule を save / fetch / input set / summary / projection / send で統一した。
- [x] `generalOrder / treatmentOrder` の canonical rule を save / input set / send で統一した。
- [x] charge 系の class meta を entity default 再計算から切り離した。

### 1-4. XML 契約是正

- [x] `unit` を medicalmodv2 XML まで送る契約へ統一した。
- [x] UI に入力欄がある属性について、send 対象か local-only かを明確化した。
- [x] hidden field のまま意味を持つ実装を縮小し、first-class field へ寄せた。

### 1-5. bodyPart / 注射 / 処方の重点是正

- [x] `bodyPart` の manual / master-selected 両経路で round-trip と send を成立させた。
- [x] 注射の `admin / adminCode / adminMemo / rowRole` の送信契約を明示した。
- [x] 処方の `genericFlg` と `rpNumber` の契約を固定した。

---

## 2. first-class field 化

- [x] `adminCode` を DTO と保存・取得処理で first-class 化した。
- [x] `bodyPart` を専用 field として保持し、items との二重表現を整理した。
- [x] row role (`main / material / comment / bodyPart`) を save / fetch / normalize / send で保持するようにした。
- [x] 600 系 subtype を canonical に保持するようにした。
- [x] comment parameter を hidden memo 運搬から分離した。
- [x] setCode provenance を input set 系の返却で保持するようにした。
- [x] hidden meta / memo codec を縮小し、必要最小限の保存境界に閉じた。
- [x] 処方 private memo codec を縮小し、`genericFlg` / `userComment` を first-class DTO へ移した。

---

## 3. UI / validation / input set / server / XML

### 3-1. editor / validation

- [x] editor 必須条件と送信前必須条件を一致させた。
- [x] code なし comment row、mixed coded / uncoded row、送信不能 bodyPart を UI 側で明示 block するようにした。
- [x] 注射コメントの send / local-only 契約を画面文言で明示した。

### 3-2. input set / recommendation

- [x] input set detail / list の entity canonical を整理した。
- [x] recommendation / template で bodyPart / materialItems / commentItems / subtype を保持するようにした。
- [x] 600 系 subtype が input set と recommendation で崩れないようにした。

### 3-3. server / fetch / mutation

- [x] server mutation / fetch で canonical entity と first-class field を保持するようにした。
- [x] 保存境界でのみ hidden memo codec を使い、fetch では DTO へ再展開するようにした。
- [x] `__orca_meta__` を save payload や fetch item memo に露出させないようにした。

### 3-4. XML / send

- [x] actual XML まで `unit`、`admin/adminCode`、`bodyPart`、rowRole 意味付けが到達するようにした。
- [x] save -> fetch -> normalize -> XML の smoke を追加した。
- [x] 600 系 subtype と注射 3 パターンを actual XML まで検証した。

---

## 4. 種別別仕上げ

### 4-1. 処方 (`medOrder`)

- [x] 処方保存と ORCA 送信の source of truth を一本化した。
- [x] `genericFlg` を UI 表示意味と送信値で分離した。
- [x] `rpNumber` を一意な RP 識別子として扱うようにした。
- [x] `221 / 222 / 231 / 232` の input set 意味を壊さず round-trip するようにした。
- [x] `location:'out'` / `category:'regular'` の固定を外し、既存 class sematics を保持するようにした。
- [x] code なしコメントの保存・送信を禁止した。
- [x] 1 RP 2 薬剤 + コメント + 後発品可否のテストを追加した。

### 4-2. 注射 (`injectionOrder`)

- [x] `admin` と `adminCode` を分離して保持するようにした。
- [x] route / timing / frequency / dosePerDay / speed の扱いを local-only / send 対象で固定した。
  - 注射送信では `admin/adminCode`、回数、coded row、`rowRole` を使う。
  - `route / timing / frequency / dosePerDay` は参照表示、`speed` は `adminMemo`、行コメントは local-only。
- [x] `supportsInjectionNoProcedure=true` の sentinel memo 実装を残さないようにした。
- [x] 薬剤のみ、手技 + 薬剤、点滴セットの 3 パターンを role 保持で区別できるようにした。
- [x] 注射 free comment の hidden meta 逆流を止めた。
- [x] generic flag / comment / unit / adminCode の round-trip と XML テストを追加した。

### 4-3. 基本診療料 / 指導料

- [x] 非 default class を再編集保存しても class meta が壊れないようにした。
- [x] charge class meta を entity default で再計算しないようにした。

### 4-4. 400 / 700 / 800 系

- [x] `treatmentOrder` / `otherOrder` の canonical を整理した。
- [x] mixed row を明示 block するようにした。
- [x] bodyPart と本体 row、材料 row、comment row の扱いを分離した。
- [x] 400/800 系の bodyPart 送信契約を round-trip で確認した。

### 4-5. 600 系（検体 / 生理 / 細菌）

- [x] canonical entity と subtype を save / fetch / input set / recommendation / send で保持するようにした。
- [x] 600 系 subtype support を server 側に追加した。
- [x] 600 系 subtype の client / server smoke test を追加した。

---

## 5. テストと文書

- [x] web-client 側の ORCA オーダー回帰テストを追加・更新した。
- [x] server-modernized 側の mutation / recommendation / resource テストを追加・更新した。
- [x] actual XML テストを追加した。
- [x] save -> fetch -> normalize -> XML の smoke を追加した。
- [x] チェックリストを更新し、未チェック項目を 0 にした。

### 5-1. 追加・更新した主なテスト

- [x] 処方: 1 RP 2 薬剤 + コメント + generic flag 契約
- [x] 注射: 手技 + 薬剤 + admin/adminCode + 回数 + rowRole 契約
- [x] 基本 / 指導料: class meta 再編集保存
- [x] 一般 / 処置 / その他: mixed row block
- [x] 放射線: bodyPart + 本体 + 材料 / 造影
- [x] 検体 / 生理 / 細菌: canonical entity + subtype + input set

---

## 6. 最終 residual scan

- [x] `docs/web-client/product-improvement/orca-order-remediation-checklist.md` の未チェック `- [ ]` は 0 件
- [x] `TODO / FIXME / XXX / TEMP / temporary` の残存なし
- [x] `normalizeOrderBundleToRp` 周辺に silent drop の再発なし
- [x] `genericFlg / rpNumber / adminCode / adminMemo / bodyPart / rowRole / subtype` の canonical 崩れなし
- [x] `save -> fetch -> normalize -> XML` の smoke で XML 欠落なし

## 実行結果メモ

- client test: ORCA オーダー関連 vitest は green
- server test: `OrcaOrderBundleMutationSupportTest`, `OrcaOrderBundleRecommendationSupportTest`, `OrcaOrderBundleResourceTest` ほか ORCA 是正関連テストは green
- チェックリスト残件: 0
- blocker: 0
