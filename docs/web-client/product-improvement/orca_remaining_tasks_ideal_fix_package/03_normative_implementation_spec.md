# ORCA 残タスク 詳細実装仕様書

## 0. この仕様書の使い方
この文書は「何を直すか」ではなく、**どう直すか** を固定する。
担当者はこの仕様に従って実装し、仕様と現コードがずれていた場合は **仕様側に寄せる**。

---

## 1. 非交渉ルール

1. 後方互換は不要  
2. broad fallback / legacy rescue / regex 直書きは残さない  
3. 「catalog にある」ではなく `save / send / server mutation / read / help / test` を閉じる  
4. current contract を helper 名・enum 名・help 文言・test 名まで一致させる  
5. disputed family は Phase 0 の decision table で確認してから触る  
6. `memo` や link marker に structured note を埋め込まない  
7. local-only と ORCA outbound を必ず分離する  
8. 実装しない機能は docs/help/tests から消す。overclaim を残さない  

---

## 2. 契約固定（Decision Record）

### DR-01: med usage の正式契約
**正式契約:** `local-only persisted / ORCA outbound では strip / send-block ではない`

意味:
- editor / local save / fetch では `usageName` / `usageCode` を保持してよい
- ORCA send preflight は、usage が存在すること自体では block しない
- ORCA send payload / XML には usage row / usage carrier を出さない
- policy / helper / docs / tests は「blocked」ではなく「local-only stripped」の語彙に揃える

実装必須:
- `orcaSendabilityPolicy.ts` の `sendable-with-blocked-usage` / `medUsageBlocked` 系命名を廃止
- `orderRpNormalization.ts` に med usage row を作る処理を残さない
- `prescriptionOrderApi.ts` の ORCA send bundle 生成で usage を落とす
- server `OrcaPrescriptionOrderResource` は usage を required にしない
- tests は「send fails」ではなく「send succeeds and usage is absent」を固定

禁止:
- usage を理由に ORCA send を hard block する
- help / notes に「usage send-block」と書く

### DR-02: injection の正式契約
**正式契約:** `admin/adminCode/adminMemo` は local-only。wire に出さない。`speed` は未サポート。

意味:
- runtime の wire-off 実装は壊さない
- `speed` は feature ではない。実装しない
- docs/help/tests/report から `speed` を消す
- `admin/adminCode/adminMemo` は local context / validation / local save/fetch 用に保持してよい

実装必須:
- injection help 文言を wire-off 契約に更新
- stale tests を新文言に追随
- `speed` 文字列を docs/help/tests/report から削除
- もし未使用 helper (`isSendableInjectionAdminCode` 等) が残るなら削除。使うなら実際の validation に配線

禁止:
- `speed` を今から追加実装する
- `admin/adminCode/adminMemo` を ORCA send payload / XML に戻す

### DR-03: structured claim comment の正式 carrier
以下を client/server の shared rule で固定する。

| family | value source | outbound carrier | validation |
|---|---|---|---|
| 830XXXXXX | `note` | `Medication_Name` | 空文字不可。50文字超は reject（今回 multi-row split は実装しない） |
| 842XXXXXX | `note` | `Medication_Number` | `^[+-]?\d+(?:\.\d+)?$` |
| 8501XXXXX | `note` | `Medication_Number` | 日付文字列。受理形式は `YYY-MM-DD` または `YYYY-MM-DD` 系。helper で正規化 |
| 8511XXXXX | `note` | `Medication_Number` | `^\d{2}-\d{2}$` |
| 8521XXXXX | `note` | `Medication_Number` | `^\d+$` |
| 831XXXXXX | `note` | `Medication_Number` | `^\d{9}$` |

実装必須:
- client/server に同じ carrier spec table を作る
- RP-level / drug-level とも `note` を explicit field で持つ
- save/fetch/source bundle/ORCA send の全経路で同じ table を参照
- unknown structured family は client/server とも fail-close
- note-required / value format validation は editor と save API の両方で行う

禁止:
- 830 を `Medication_Number` に送る
- 842/8501/8511/8521/831 を `Medication_Name` に送る
- `memo` に note を埋めて source bundle へ逃がす
- RP-level と drug-level で別 carrier ルールにする

### DR-04: exact-class entities の `classCode`
**正式契約:** exact-class family は request boundary で `classCode` 必須。`null` を validator で通さない。

対象:
- treatment
- surgery
- test
- physiology
- radiology
- injection
- med
- baseCharge
- instractionCharge
- （Phase 0 で必要なら他 family も追加）

実装必須:
- UI / normalize / request DTO で default class を先に埋める
- validator 通過後の defaulting に依存しない
- server `isCompatibleClassCode` 相当は `null` を true にしない
- tests は `null classCode` reject を明示

禁止:
- 「後で defaulting するから validator では通す」
- entity ごとに別の null 許容ルールを持つ

### DR-05: canonicalization / label / SoT
**正式契約:** entity/class canonicalization は catalog が唯一の source of truth。legacy `放射線` fallback は削除。

実装必須:
- client: `orcaMedicalClassCatalog.ts`
- server: `OrcaMedicalClassCatalog.java`
だけを canonical source にする
- `orderChargeClassSupport.ts` / `OrcaChargeClassSupport` / `OrcaChargeClassCanonicalSupport` / `resolveCanonicalClassName` の独自 map/fallback を撤去または thin delegate 化
- `放射線` / `\u653e\u5c04\u7dda` を codebase から削除
- production path は catalog API しか見ない

禁止:
- helper に新しい map を足す
- legacy label fallback を「念のため」残す
- grep gate を literal だけで通して Unicode escape を残す

### DR-06: disputed family の扱い
Phase 0 の decision table で current repo を確定し、
- mismatch なら仕様どおり修正
- already conforming なら **挙動は変えず** locking test だけ追加
とする。

---

## 3. Confirmed Must-Fix 実装仕様

### Task A: med usage 契約の一本化

#### 目的
コード・policy・help・tests・notes が全部 `local-only persisted / outbound strip` に揃うようにする。

#### 変更対象
- client
  - `web-client/src/features/charts/orcaSendabilityPolicy.ts`
  - `web-client/src/features/charts/orderRpNormalization.ts`
  - `web-client/src/features/charts/prescriptionOrderApi.ts`
  - `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
  - `web-client/src/features/charts/__tests__/orderSendSmoke.test.ts`
  - `web-client/src/features/charts/__tests__/orderRpNormalization.test.ts`
  - notes / help
- server
  - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
  - 必要なら関連 test

#### 実装指示
1. sendability enum / label / helper 名から `blocked-usage` の語を除く  
2. med の send preflight は usage の存在だけでは error にしない  
3. ORCA send bundle 生成では usage row / usage carrier を一切出さない  
4. save payload / fetch restore は usageName/usageCode を維持する  
5. `PrescriptionOrderEditorPanel` の restore / draft apply / no-op save が usage を壊さないことを test で固定  
6. `usageCode <- adminMemo` や `usageCode <- adminCode` の fallback が残るなら削除し、source field だけを使う  

#### 実装後の期待状態
- send は成功する
- outbound payload / XML に usage row がない
- local save/fetch では usage が残る
- help/notes/tests は「strip」の語彙で統一

---

### Task B: RP-level / drug-level structured claim comment を end-to-end で閉じる

#### 目的
`note` が editor / validation / source bundle / save / fetch / ORCA wire で壊れないようにする。

#### データモデル方針
- `StoredRpMeta.claimComments[]` を正式採用
- `StoredDrugMeta.claimComments[]` も同じ shape にする
- shape は `{ code, name, note, lowerFields? }`
- bundle row 側には `structuredCommentValue?: string`（名称は任意だが explicit field にする）を追加する
- `memo` は link marker や表示用にしか使わない。structured value の carrier にしない

#### 変更対象
- client
  - `prescriptionOrderApi.ts`
  - `PrescriptionOrderEditorPanel.tsx`
  - 必要なら bundle/comment DTO 定義
  - claim comment 関連 tests
- server
  - `OrcaPrescriptionOrderResource.java`
  - `OrcaChartSupportSupport.java`
  - claim comment validation / XML build test

#### 実装指示
1. shared carrier spec table を作る  
2. RP-level / drug-level claim comment row に explicit value field を通す  
3. editor に RP/drug claim comment `note` 入力 UI を追加  
   - code 選択後に note 入力欄を表示
   - 830 は free text placeholder
   - 842 は numeric placeholder
   - 8501/8511/8521/831 も format hint を表示
4. client-side validation
   - unknown structured family reject
   - note required
   - per-family format validate
5. save payload / fetch restore
   - RP/drug とも `note` を round-trip
6. source bundle / mutation operation
   - `memo` ではなく explicit field で保持
7. ORCA wire
   - 830 -> Medication_Name = note
   - 842/8501/8511/8521/831 -> Medication_Number = note
   - 必要なら display 用 name は別保持してもよいが、note を name に流さない
8. tests
   - RP-level 830
   - RP-level 842
   - RP-level 831
   - drug-level 8501 / 8511 / 8521
   - unknown family reject
   - note-required reject
   - editor no-op save keeps note
   - outbound XML carries correct field

#### 実装後の期待状態
- editor で RP/drug claim comment note を編集できる
- save/fetch/source bundle で note が消えない
- ORCA wire が family ごとに correct carrier を使う

---

### Task C: `speed` overclaim の解消

#### 目的
存在しない feature を語らない。

#### 変更対象
- `OrderBundleEditPanel.tsx`
- help / notes / tests / report templates
- grep gate に `speed` を追加

#### 実装指示
1. `speed` 文言を全削除  
2. injection help を `admin/adminCode/adminMemo` の local-only 契約だけに書き直す  
3. tests / notes / report template の `speed` 記述を削除  
4. もし model / DTO / form に半端な `speed` 残骸があれば削除  

#### 実装後の期待状態
- features/charts / server main / notes に `speed` が残らない
- ユーザー向け説明と runtime が一致

---

### Task D: charge / radiology canonicalization の SoT 一本化

#### 目的
catalog だけが canonicalization を持つ状態にする。

#### 変更対象
- client
  - `orcaMedicalClassCatalog.ts`
  - `orderChargeClassSupport.ts`
  - `orderCategoryRegistry.ts`
  - `orderBundleApi.ts`
  - `orderRpNormalization.ts`
- server
  - `OrcaMedicalClassCatalog.java`
  - `OrcaChargeClassSupport.java`
  - `OrcaChargeClassCanonicalSupport.java`
  - `OrcaOrderBundleRequestSupport.java`
  - `OrcaOrderBundleFetchSupport.java`
  - `OrcaOrderBundleRecommendationSupport.java`
  - 必要な tests

#### 実装指示
1. catalog API を増やしてよい  
   例:
   - `resolveCanonicalEntity(entity)`
   - `resolveExactClassMeta(entity, classCode)`
   - `resolveClassName(entity, classCode)`
   - `isAllowedClass(entity, classCode)`
2. `orderChargeClassSupport.ts` は catalog thin delegate しか持たない形まで縮退  
   - 独自 map / legacy fallback / radiology special case を削除
3. server `OrcaChargeClassSupport` / `OrcaChargeClassCanonicalSupport` / `resolveCanonicalClassName` は削除または thin delegate 化  
4. `放射線` / `\u653e\u5c04\u7dda` fallback を削除  
5. production path が catalog API 以外を参照していないことを grep / code review で確認  

#### 実装後の期待状態
- class canonicalization のロジックが一箇所にしかない
- radiology legacy label が消える
- fetch / recommendation / request / display が同じ className を使う

---

### Task E: exact-class entity の `null classCode` fail-close

#### 目的
validator 通過後 defaulting 依存をやめる。

#### 変更対象
- client validators / normalize
- server request validators / compatibility helpers
- tests

#### 実装指示
1. bundle create / edit 時点で default class を必ず入れる  
2. exact-class entity の validator は `null` / `''` classCode を reject  
3. server `isCompatibleClassCode()` などで null true 扱いをやめる  
4. save / send / server mutation の全経路で同じ判定 helper を使う  
5. tests に `null classCode` reject を追加  
   - charge
   - treatment
   - surgery
   - test
   - physiology
   - radiology
   - injection
   - med

#### 実装後の期待状態
- request boundary を越えた bundle に blank classCode が無い
- fail-close の意味が明確

---

### Task F: stale help / tests / notes の同期

#### 目的
current behavior を help/test/note が正しく固定する。

#### 変更対象
- `OrderBundleEditPanel.tsx`
- `orderBundleOrcaSupport.test.tsx`
- `orderSendSmoke.test.ts`
- `orderBundleBodyPart.test.tsx`
- `chartsActionBar.orca-send.test.tsx`
- ORCA notes

#### 実装指示
1. injection help を runtime に合わせる  
   - `admin/adminCode/adminMemo` は local-only
   - outbound payload は medicalClass + medications だけ
2. `orderBundleOrcaSupport.test.tsx` を新 help 文言に追随  
3. `orderSendSmoke.test.ts`
   - `className: 'Radiology'` を exact className に更新
   - `rejects bodyPart resurrection` は実ケースを使う
4. `orderBundleBodyPart.test.tsx`
   - stale 受理前提があれば reject 契約へ更新
5. notes
   - med usage = strip-on-send
   - injection = wire-off / no speed
   - radiology = exact class map wording
   - claim comment carrier mapping を明記
6. dead residue
   - `missing_admin_code`
   - `unsupported_admin_memo`
   - 古い policy 名
   が未使用なら削除

---

## 4. Conditional Fixes（Phase 0 で mismatch が confirmed の場合のみ）

### Task G: surgery `501/502` standalone と rowRole `material`
#### end state
- `500/501/502/510` allow
- `520/540/541/542` block
- `501/502` は standalone
- rowRole は `main/material/comment` の意味が client/server/fetch で一致

#### 実装方針
- class-aware row grammar table を作る
- `requiresMainRow(entity, classCode)` が `501/502` で false になるよう client/server 共通化
- `material` resolver は 1 本化
  - validation / persistence / fetch / recommendation が同じ resolver を使う
- client 側で `material -> main`、server 側で `material -> auxiliary` のような二重意味をやめる
- どの representation を canonical にするかを先に決める  
  **推奨 canonical:** `main/material/comment`  
  理由: UI/意味論が最も明確で、`auxiliary` の曖昧さを避けられる

#### tests
- `501` standalone save/send/server OK
- `502` standalone save/send/server OK
- `material` row survives round-trip with same semantics

### Task H: testOrder exact fail-close
#### end state
- allowlist = `600/601/602/603/610`
- reject = `640/643` + allowlist 外全体
- save/send/server が同一 helper を使う

#### 実装方針
- `isAllowedTestClass(classCode)` を client/server に shared implementation で持つ
- save validator と send validator を別ロジックにしない
- `ChartsActionBar` の局所 allowlist を削除または shared helper 委譲に置換

#### tests
- `640/643` reject
- `611` 等 allowlist 外 reject
- `601/602/603/610` pass

### Task I: physiology local save / exact 600
#### end state
- import-only + local save/fetch 可 + send-block
- `classCode=600` exact
- bodyPart reject

#### 実装方針
- client local save hard-block を外す
- normalize / input-set remap で physiology に test allowlist を流さない
- server も physiology を exact 600 に縛る
- help/docs を current contract に合わせる

#### tests
- local save succeeds
- send blocked
- classCode 601 reject
- fetch round-trip keeps 600

### Task J: bacteria read fallback strict
#### end state
- `830/842` だけを bacteria metadata として扱う
- fetch できるもの = save できるもの

#### 実装方針
- read helper の comment code 誘導を `830/842` に限定
- unknown / other known comment codes を bacteria metadata に起こさない
- mutation writer も shared rule だけを使う

#### tests
- non-830/842 comment code is not materialized as bacteria metadata
- 830 / 842 round-trip OK

### Task K: otherOrder old-shape 残存
#### end state
- explicit local-only contract
- broad range / legacy regex なし
- send-block 維持
- rowRole は `main/comment` のみ
- bodyPart/material 不可

#### 実装方針
- Phase 0 で current code が already conforming なら **挙動変更しない**
- mismatch が confirmed なら以下に寄せる
  1. `entity === otherOrder`
  2. `classCode` は null を推奨。共有型都合で必要なら `LOCAL_OTHER` sentinel を採用
  3. main row `code` は local-only predicate に一致  
     推奨: `^LOCAL_OTHER:[A-Z0-9._-]+$`
  4. rowRole は `main/comment` のみ
  5. bodyPart/material/itemNumber selection family 不可
  6. send path は常に block

#### tests
- old `800..890` / `8...|18...` shape が reject
- explicit local-only code is accepted
- send remains blocked

### Task L: legacy bodyPart resurrection
#### end state
- read/helper/display で旧 `002` bodyPart を resurrect しない
- radiology `700` explicit bodyPart だけが UI / display / fetch に現れる

#### 実装方針
- `resolveBundleBodyPart` 相当 helper から 002 rescue を削除
- display/form helper は explicit bodyPart field だけを見る
- radiology bodyPart UI は `classCode===700` のときだけ表示

#### tests
- non-radiology 002 legacy rows do not yield bodyPart
- radiology 700 explicit bodyPart survives
- test name と実入力が一致

---

## 5. 具体的な test 追加・修正指示

### claim comment
- `prescriptionOrderApi.test.ts`
  - RP-level 830 note round-trip
  - RP-level 842 note round-trip and ORCA payload carrier
  - RP-level unknown family reject
- `prescriptionOrderEditorPanel.orca-support.test.tsx`
  - claim comment note input/validation
- server `OrcaPrescriptionOrderResourceTest.java`
  - family-specific validation
- server `OrcaChartSupportSupportTest.java`
  - Medication_Name / Medication_Number mapping

### med usage
- `orderSendSmoke.test.ts`
  - med usage present locally but outbound payload omits it
- `orderRpNormalization.test.ts`
  - no usage row emitted
- server tests
  - usageCode optional in save resource

### canonicalization / fail-close
- client and server tests for:
  - `null classCode` reject
  - exact className from catalog only
  - legacy radiology label reject

### stale tests
- `orderSendSmoke.test.ts`
  - update radiology className fixture
  - real bodyPart resurrection reproduction
- `orderBundleOrcaSupport.test.tsx`
  - new injection help copy
- `orderBundleBodyPart.test.tsx`
  - no stale treatment acceptance

---

## 6. grep / lint / audit gate

必須 0 hit:
- `sendable-with-blocked-usage|medUsageBlocked`
- `\bspeed\b` （features/charts, server main, notes）
- `放射線|\\u653e\\u5c04\\u7dda`
- `genericChangeAllowed:\s*true`（conversion helper の固定代入）
- `missing_admin_code|unsupported_admin_memo`
- `800\.\.890|8\.\.\.\|18\.\.\.`

説明付き hit 可:
- `OrcaChargeClassSupport` 等は thin delegate のみなら可
- `LOCAL_OTHER` sentinel は explicit local-only contract として可

---

## 7. Done Definition
完了とみなす条件:

1. `04_acceptance_matrix.md` の AC 全達成  
2. Phase 0 decision table の disputed point が全部 resolved  
3. client/server の targeted tests + full tests + build + verify + static-analysis のログがある  
4. grep gate の説明不能 hit が 0  
5. help/tests/notes/report が runtime と一致  
6. Final Auditor が blocker 0 件
