# ORCAオーダー是正 残タスク作業計画書

この計画書は、再レビュー後に残った未解決事項だけを対象にした、完遂用の差分計画書です。  
原則として、各項目は **コード修正・テスト追加/更新・文書更新** の 3 点セットで閉じます。  
未実装のまま local-only に落とす項目は、UI 表示、保存仕様、送信非対象、テストを揃えてから完了にします。

## 0. 決定ログ

### 0-1. bodyPart 契約
- [x] `bodyPart` は ORCA 送信・保存・再取得とも `002...` 専用 field とし、他コード体系は受け入れない
- [x] `/api/orca/master/bodypart`、front validation、server validation、fetch reconstruction、send validation、XML テストを同一契約に揃える
- [x] 既存の `BP001` など旧 front test 契約は廃止し、非 `002...` は front/server とも reject に統一する

### 0-2. 600系送信契約
- [x] `testOrder / physiologyOrder / bacteriaOrder` は editor/save では entity を保持しつつ、ORCA送信 grouping は classCode `600` とコード付き行に統一する
- [x] `admin / adminMemo / memo / subtype / item.memo` は 600系では local-only とし、ORCA送信 payload/XML には出さない
- [x] 600系の複数検査項目は許容し、bundle 共通属性は local-only、ORCA送信は item 単位の coded row のみを使う
- [x] `bacteriaOrder` は現時点では `subtype` のみを first-class に扱い、`検体種別 / 培養 / 感受性 / 備考` の追加 field は導入しない

### 0-3. 処方送信契約
- [x] 処方の送信 source of truth は `prescription-orders` とし、ORCA送信では first-class order から send bundle を組み立てる
- [x] `sourceBundles` は互換表示専用に残し、editor/save/send の正は first-class `order` に固定する
- [x] `free-text usage`, `generalNamePrescription`, `RP-level claimComments`, `lower*`, `numberCode`, `prescriptionSettings`, `remarks` は当面 sendable にせず、first-class order で保持しつつ local-only / reject を個別に詰める

### 0-4. 注射送信契約
- [x] 注射は `admin/adminCode` を sendable、`adminMemo/memo/route/timing/frequency/speed` と行コメントは local-only に固定する
- [x] 注射 `material row` は editor で first-class に扱い、保存時も `rowRole=material` を維持する
- [x] 注射 drug の `genericFlg` は当面 preserve-only とし、UI で壊さないことを優先して後続で表示/編集方針を詰める

### 0-5. 処置・一般・その他・放射線・charge 契約
- [x] `generalOrder` は canonical `treatmentOrder` の UI alias として残し、保存・送信・テストの正は `treatmentOrder` に寄せる
- [x] treatment の `bundleName / admin / memo` は local-only とし、ORCA送信では classCode/bodyPart/coded row のみを使う
- [x] `otherOrder` は etensu category `8` のみを対象とし、material-only と bodyPart は front 契約では受け付けない
- [x] radiology の `instruction / memo / item.memo` は local-only とし、ORCA送信では bodyPart/classCode/coded row のみを使う
- [x] charge の class range は `110-125` と `130-150` で厳密に分ける
- [x] parameter 付き selection comment は正式に非対応とし、UI block とテストで固定する

## 1. P0 ブロッカー

### 1-1. ReceptionPage の旧 ORCA送信経路を廃止して共有経路へ統合
- [x] `ReceptionPage` 内の独自 `ORCA_SEND_ORDER_ENTITIES` を削除する
- [x] `ReceptionPage` 内の独自 `toMedicalModV2Medication` / `toMedicalModV2Information` を削除する
- [x] Charts 側と同じ entity list・canonicalization・validation・normalization を使う共有 helper を呼ぶようにする
- [x] `medOrder` が会計送信で必ず含まれることを確認する
- [x] `generalOrder` / `laboTest` の二重 fetch が消えることを確認する
- [x] `bodyPart` / comment code / local-only field の扱いが Charts 側と一致することを確認する
- [x] `ReceptionPage` の送信テストを、共有経路利用を前提に書き換える

### 1-2. 処方の送信 source of truth 一本化
- [x] ORCA送信で処方を読む経路を `order/bundles` ベースから `prescription-orders` ベースへ切り替える
- [x] ActionBar 側で処方だけ first-class order を取得し、他オーダーと同一 payload へ組み立てる共通経路を作る
- [x] 保存直後の処方が、そのまま送信 payload に現れることを確認する
- [x] `ChartsPage` / `PrescriptionOrderEditorPanel` / 送信経路で処方の表示・保存・送信が同じ order を見ることを確認する
- [x] `save → fetch → send` の統合テストを追加する

### 1-3. 処方の lossy hydrate を廃止
- [x] `fetchPrescriptionOrder().order` を editor の正とし、`sourceBundles -> toPrescriptionOrder()` での再構築をやめる
- [x] `ChartsPage` でも first-class `order` を主に使い、`sourceBundles` は互換表示専用に限定する
- [x] `mutatePrescriptionOrderBundles` を `sourceBundles` ベースではなく first-class order ベースに作り直す
- [x] no-op 再保存で `generalNamePrescription`, `refill*`, `doctorComment`, `lower*` などが落ちないことを確認する
- [x] first-class no-op re-save テストを追加する

### 1-4. 600系 send contract を実装または fail-closed に確定
- [x] `testOrder` の `admin` を sendable にするか local-only にするか実装を確定する
- [x] `testOrder` / `physiologyOrder` の helper・送信前正規化・テストを local-only 契約に揃える
- [x] `physiologyOrder` の `subtype / admin / memo / item.memo` について同様に確定する
- [x] `bacteriaOrder` の `subtype` は carrier 未対応のため、送信前に明示 block する
- [x] `orderSendSmoke.test.ts` の 600 local-only 前提を最終仕様に合わせて更新する

判定メモ:
- `testOrder` / `physiologyOrder` は local-only 契約まで実装済み。UI ラベル/placeholder の明示と XML 網羅は `4-1`, `4-2` に残す。

### 1-5. bacteriaOrder の ORCA入力セット適用を実運用で通す
- [x] bacteria タブで `entity=testOrder, classCode=600` の input set detail を受け入れるよう client 側 apply 条件を修正する
- [x] `toOrderBundleFromInputSetDetail` と `handleOrcaSetApply` の entity mismatch 条件を 600系 canonical 前提に直す
- [x] server 実経路で 600 detail を bacteria に適用した時の subtype 取扱いを明文化する
- [x] web-client で bacteria input set apply テストを追加する
- [x] server で override ではない実経路テストを追加する

### 1-6. radiology の bodyPart endpoint 契約を 002 ベースで閉じる
- [x] `/api/orca/master/bodypart` の検索実装を 002 系 bodyPart 契約に合わせて修正する
- [x] `胸部` / `膝関節` など通常検索語で 002 候補を返すようにする
- [x] comment code 系や不適切 code を bodyPart endpoint から返さないようにする
- [x] front validation でも非 002 bodyPart code を reject する
- [x] bodyPart の検索→選択→保存は UI テスト、再取得→送信→XML は smoke / XML テストで固定する
- [x] `OrcaChartSupportSupportTest` の radiology `Medical_Class` を `700` 固定で検証する

## 2. 注射の残タスク

### 2-1. 注射 material row を editor で first-class 化
- [x] `form.materialItems` を注射 editor に表示する
- [x] material row の追加・編集・削除 UI を実装する
- [x] recommendation / fetch / input set 由来の material row が hidden にならないことを保証する
- [x] 7xxxx item を注射 editor で追加したとき、main ではなく material として入る導線を作る
- [x] `薬剤のみ / 手技+薬剤 / material+drug` の rowRole / round-trip をテストで固定する

### 2-2. 注射 admin/adminCode validation を締める
- [x] `admin` がある注射 bundle では `adminCode` 必須とし、保存前 validation で fail-closed にする
- [x] recent usage fallback など `adminCode=''` になりうる経路は保存前 block で整理する
- [x] `classCode=310` 以外の injection bundle は save/send 前で reject に固定する
- [x] `comment-only injection` は保存前 validation と smoke で send 不可に固定する

### 2-3. 注射 memo / adminMemo / speed 契約を閉じる
- [x] 注射 `memo` は local-only とし、UI helper・send omission・テストを揃える
- [x] 注射 `memo` / `adminMemo` / `speed` は payload/XML carrier を追加しない契約で固定する
- [x] `adminMemo` の local-only 契約を helper・smoke・テストで固定する
- [x] `speed` は local-only 前提の helper / send omission で扱う
- [x] `route/timing/frequency/speed` は structured send field に昇格させず、参照表示 + local-only に固定する

### 2-4. 注射 genericFlg の UI 完結
- [x] 注射 drug row でも `genericFlg` を read-only UI から確認できるようにする
- [x] 注射 `genericFlg` は preserve-only と明示する方針で固定する
- [x] 注射 row の comment 編集で hidden generic meta が壊れないことを固定する
- [x] 注射 generic UI テストを追加する

## 3. 処方の残タスク

### 3-1. RP-level comment semantics を first-class 化
- [x] `PrescriptionRp` に RP-level `claimComments` を持たせる
- [x] input set `bundle.memo` を `remark` に取り込み、comment row は決めた RP-level field に保持する
- [x] `rp.doctorComment` を order-level `doctorComment` と混同せず round-trip できるようにする
- [x] comment row を「最初の薬剤へ寄せる」暫定変換をやめるか、fail-closed にする
- [x] RP-level comments の save/fetch/send テストを追加する

### 3-2. 一般名相当 / 後発品可否 / UI 補完
- [x] `generalNamePrescription` の UI 表示と編集方針を first-class toggle として決める
- [x] `generalNamePrescription` と `genericChangeAllowed` を独立に round-trip させる
- [x] `sourceBundles` 側へ落としても両者が混ざらないことを確認する
- [x] UI が未対応なら fail-closed か read-only 明示にする

### 3-3. free-text usage / lower* / numberCode / supplemental sections
- [x] free-text usage を許すなら ORCA 送信 carrier を実装する
- [x] 実装しないなら save または send 前で明示 block にする
- [x] `lower*` と `numberCode` と `prescriptionSettings` / `remarks` の round-trip 方針を決める
- [x] 未対応なら first-class order の保存で保持し、編集で壊さない最低限の措置を入れる
- [x] sendable でないものは local-only / reject を明記する
- [x] class 211/221/222/231/232 の send + XML カバレッジを増やす

## 4. 600系オーダーの残タスク

### 4-1. testOrder の `admin` 契約
- [x] `admin` は local-only とし、helper / save / send 正規化 / テストを local-only 前提で固定する
- [x] `MedicalModV2Information` / XML builder に `admin` carrier を追加しない契約で固定する
- [x] `adminMemo` / `memo` / `item.memo` についても同じルールを決める
- [x] `testOrder + comment code row + 複数 item` は class600 XML と send omission 契約で固定する

### 4-2. physiologyOrder の専用契約
- [x] physiology の識別を `Medical_Class_Name` だけに依存しない形にするか決める
- [x] `bodyPart` を許可するのか、禁止を全層で固定するのか決める
- [x] `subtype / admin / memo / item.memo` を sendable にするか local-only にするか決める
- [x] physiology の save→fetch→send 契約は subtype/bodyPart禁止/local-only 正規化と class600 XML 系テストで固定する

### 4-3. bacteriaOrder の第一級モデル
- [x] `bacteriaOrder` は `subtype` 以外の first-class field を増やさない方針で確定する
- [x] `subtype` は UI / DTO / save / fetch で保持し、carrier 未対応の間は send 前 block で扱う
- [x] 追加しない項目は `local-only / reject` として fail-closed に固定する
- [x] `comment code` や `bundleName` へ意味を逃がさず、send 前 block で契約違反を止める
- [x] bacteria は XML 到達ではなく send block smoke を完了条件として固定する

判定メモ:
- 現契約は `subtype` 以外を増やさず、`subtype` carrier 未対応の間は send 前 block を正とする。`orderSendSmoke.test.ts` の block smoke は追加済みだが、XML 到達しない契約をどう記述するかは再整理が必要。

## 5. 処置・一般・その他・放射線・bodyPart の残タスク

### 5-1. treatment material row の UI/round-trip を直す
- [x] treatment editor に `materialItems` の表示・編集・削除 UI を追加する
- [x] material master 選択が stable に `rowRole=material` へ入るようにする
- [x] hidden material regression テストを追加する
- [x] treatment send smoke と editor round-trip を揃える

### 5-2. treatment `bundleName/admin/memo` 契約
- [x] local-only にするなら UI 上で明示する
- [x] send carrier / XML は追加せず local-only 契約で固定する
- [x] `bundleName / admin / memo` の treatment local-only 契約テストを追加する

### 5-3. generalOrder の UI alias 後始末
- [x] `generalOrder` タブは `treatmentOrder` の UI alias として残す方針で固定する
- [x] 「処置(400)の別表示」であることを UI で明示する
- [x] front mock / tests は canonical `treatmentOrder` ベースへ寄せる
- [x] 400 系 input set の front/server 契約を canonical `treatmentOrder` 前提に統一する

### 5-4. otherOrder の server validation hardening
- [x] `otherOrder` に許す code family を server で明示的に検証する
- [x] material-only を許す/拒否する方針を決める
- [x] bodyPart を許す/拒否する方針を決める
- [x] `orderBundleMasterSearch.test.tsx` を現行 `etensu only` 契約へ更新する
- [x] `sourceSetCode` は local-only とし、入力セット適用後の表示 durability をテストで固定する

### 5-5. radiology の material/drug role 契約
- [x] manual 検索で追加した material は `material row` に保持し、drug/etensu は `main row` に保持する
- [x] その仕様に合わせて `applyPredictiveItem` と rowRole 設計を揃える
- [x] radiology の instruction/memo/item memo を local-only にするか sendable にするか決める
- [x] radiology local-only 契約テストを追加する

## 6. Charge の残タスク

### 6-1. baseCharge / instractionCharge class range を閉じる
- [x] `baseChargeOrder = 110-125`, `instractionChargeOrder = 130-150` を client/server/test で厳密化するか決める
- [x] `isCompatibleClassCode` を決めた規則へ修正する
- [x] `baseCharge + 130`, `instractionCharge + 110` の扱いを reject か許容かで固定する
- [x] 既存の逆向きテストを更新する

### 6-2. instractionCharge 新規作成 path
- [x] master item 選択から class を導出する方針で固定する
- [x] explicit class が無い新規指導料で 130 固定に寄らないようにする
- [x] instractionCharge の新規作成テストを追加する

### 6-3. parameter 付き selection comment
- [x] `itemNumber / itemNumberBranch / parameter` は first-class に追加せず、非対応契約で固定する
- [x] 非対応とする場合は UI block とテストを正式仕様にする
- [x] 旧期待のテストを修正する
- [x] medicationgetv2 / selection comment の runtime テストを整備する

### 6-4. charge local-only と auditability
- [x] `admin / adminMemo / memo / started / sourceSetCode` の local-only 契約を UI で明示する
- [x] 保存後の dock/detail で `admin/adminMemo` をレビューできる導線を追加する
- [x] charge detail UI テストを追加する

## 7. テストと最終確認

### 7-1. 追加必須テスト
- [x] ReceptionPage ORCA 送信共有化テスト
- [x] prescription `save -> fetch -> no-op save -> send -> XML` テスト
- [x] bacteria input set apply テスト
- [x] bodyPart endpoint 実テスト
- [x] radiology `700` XML テスト
- [x] treatment material UI round-trip テスト
- [x] instractionCharge class range テスト
- [x] selection comment parameter 対応/非対応テスト

### 7-2. 機械的完了条件
- [x] `docs/web-client/product-improvement/orca-order-remediation-residual-checklist.md` に未チェックが 0 件
- [x] client / server の追加・更新テストが green
- [x] `TODO / FIXME / XXX / temporary` の機械スキャン結果を確認し、残存は lockfile / `temporaryPassword` / `TEMP_` 定数などの false positive のみであることを確認した
- [x] save → fetch → normalize → send → XML の smoke を主要系で再実行した
- [x] 最終報告に residual task count: 0 / open blocker count: 0 を書ける状態にした
