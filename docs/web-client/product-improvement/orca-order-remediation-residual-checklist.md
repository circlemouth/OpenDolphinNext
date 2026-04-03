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
- [ ] `testOrder` の `admin` を sendable にするか local-only にするか実装を確定する
- [ ] sendable にしないなら、UI 文言・helper・テストを local-only 契約に揃える
- [ ] `physiologyOrder` の `subtype / admin / memo / item.memo` について同様に確定する
- [x] `bacteriaOrder` の `subtype` は carrier 未対応のため、送信前に明示 block する
- [x] `orderSendSmoke.test.ts` の 600 local-only 前提を最終仕様に合わせて更新する

### 1-5. bacteriaOrder の ORCA入力セット適用を実運用で通す
- [x] bacteria タブで `entity=testOrder, classCode=600` の input set detail を受け入れるよう client 側 apply 条件を修正する
- [x] `toOrderBundleFromInputSetDetail` と `handleOrcaSetApply` の entity mismatch 条件を 600系 canonical 前提に直す
- [ ] server 実経路で 600 detail を bacteria に適用した時の subtype 取扱いを明文化する
- [x] web-client で bacteria input set apply テストを追加する
- [ ] server で override ではない実経路テストを追加する

### 1-6. radiology の bodyPart endpoint 契約を 002 ベースで閉じる
- [x] `/api/orca/master/bodypart` の検索実装を 002 系 bodyPart 契約に合わせて修正する
- [x] `胸部` / `膝関節` など通常検索語で 002 候補を返すようにする
- [x] comment code 系や不適切 code を bodyPart endpoint から返さないようにする
- [x] front validation でも非 002 bodyPart code を reject する
- [ ] bodyPart E2E（検索→選択→保存→再取得→送信→XML）を追加する
- [x] `OrcaChartSupportSupportTest` の radiology `Medical_Class` を `700` 固定で検証する

## 2. 注射の残タスク

### 2-1. 注射 material row を editor で first-class 化
- [x] `form.materialItems` を注射 editor に表示する
- [x] material row の追加・編集・削除 UI を実装する
- [x] recommendation / fetch / input set 由来の material row が hidden にならないことを保証する
- [x] 7xxxx item を注射 editor で追加したとき、main ではなく material として入る導線を作る
- [ ] `薬剤のみ / 手技+薬剤 / material+drug` の editor round-trip テストを追加する

### 2-2. 注射 admin/adminCode validation を締める
- [ ] `admin` がある注射 bundle では `adminCode` も必須にするかどうか決め、実装する
- [ ] recent usage fallback など `adminCode=''` になりうる経路を整理する
- [ ] `classCode=310` 以外の injection bundle を save/send 前でどう扱うか決める
- [ ] `comment-only injection` が send を抜けないことをテストで固定する

### 2-3. 注射 memo / adminMemo / speed 契約を閉じる
- [ ] `memo` を local-only にするなら UI help・send omission・テストを揃える
- [ ] 送るなら payload/XML まで carrier を実装する
- [ ] `adminMemo` の local-only 契約も同様に揃える
- [ ] `speed` を送らないなら placeholder と helper 文言を local-only 前提に修正する
- [ ] 送るなら `route/timing/frequency/speed` の structured field を DTO / save / normalize / XML へ通す

### 2-4. 注射 genericFlg の UI 完結
- [ ] 注射 drug row でも genericFlg を UI から確認できるようにする
- [ ] 編集可能にするか、preserve-only と明示するか決める
- [ ] 注射 row の comment 編集で hidden generic meta が壊れないことを固定する
- [ ] 注射 generic UI テストを追加する

## 3. 処方の残タスク

### 3-1. RP-level comment semantics を first-class 化
- [ ] `PrescriptionRp` に RP-level `claimComments` を持たせる
- [ ] input set `bundle.memo` を `remark` または決めた RP-level field に取り込む
- [ ] `rp.doctorComment` を order-level `doctorComment` と混同せず round-trip できるようにする
- [ ] comment row を「最初の薬剤へ寄せる」暫定変換をやめるか、fail-closed にする
- [ ] RP-level comments の save/fetch/send テストを追加する

### 3-2. 一般名相当 / 後発品可否 / UI 補完
- [ ] `generalNamePrescription` の UI 表示と編集方針を決める
- [ ] `generalNamePrescription` と `genericChangeAllowed` を独立に round-trip させる
- [ ] `sourceBundles` 側へ落としても両者が混ざらないことを確認する
- [ ] UI が未対応なら fail-closed か read-only 明示にする

### 3-3. free-text usage / lower* / numberCode / supplemental sections
- [ ] free-text usage を許すなら ORCA 送信 carrier を実装する
- [ ] 実装しないなら save または send 前で明示 block にする
- [ ] `lower*` と `numberCode` と `prescriptionSettings` / `remarks` の round-trip 方針を決める
- [ ] 未対応なら first-class order の保存で保持し、編集で壊さない最低限の措置を入れる
- [ ] sendable でないものは local-only / reject を明記する
- [ ] class 211/221/222/231/232 の send + XML カバレッジを増やす

## 4. 600系オーダーの残タスク

### 4-1. testOrder の `admin` 契約
- [ ] `admin` を local-only にするなら、placeholder / ラベル / helper を local-only 前提へ改める
- [ ] 送るなら `MedicalModV2Information` と XML builder へ carrier を追加する
- [ ] `adminMemo` / `memo` / `item.memo` についても同じルールを決める
- [ ] `testOrder + comment code row + 複数 item` の XML テストを追加する

### 4-2. physiologyOrder の専用契約
- [ ] physiology の識別を `Medical_Class_Name` だけに依存しない形にするか決める
- [ ] `bodyPart` を許可するのか、禁止を全層で固定するのか決める
- [ ] `subtype / admin / memo / item.memo` を sendable にするか local-only にするか決める
- [ ] physiology save→fetch→send→XML テストを追加する

### 4-3. bacteriaOrder の第一級モデル
- [ ] `subtype` だけで足りないなら `specimen / culture / sensitivity / note` の first-class field を追加する
- [ ] それらを UI / DTO / save / fetch / normalize / XML で扱う
- [ ] 実装しない項目は local-only / reject にする
- [ ] `comment code` や `bundleName` に意味を逃がさない
- [ ] bacteria send/XML テストを追加する

## 5. 処置・一般・その他・放射線・bodyPart の残タスク

### 5-1. treatment material row の UI/round-trip を直す
- [x] treatment editor に `materialItems` の表示・編集・削除 UI を追加する
- [x] material master 選択が stable に `rowRole=material` へ入るようにする
- [x] hidden material regression テストを追加する
- [ ] treatment send smoke と editor round-trip を揃える

### 5-2. treatment `bundleName/admin/memo` 契約
- [x] local-only にするなら UI 上で明示する
- [ ] 送るなら send carrier / XML を追加する
- [x] `bundleName / admin / memo` の treatment local-only 契約テストを追加する

### 5-3. generalOrder の UI alias 後始末
- [ ] `generalOrder` タブを残すか統合するか決める
- [ ] 残すなら「処置(400)の別表示」であることを UI で明示する
- [ ] front mock / tests を canonical `treatmentOrder` ベースへ寄せる
- [ ] 400 系 input set の front/server 契約を統一する

### 5-4. otherOrder の server validation hardening
- [ ] `otherOrder` に許す code family を server で明示的に検証する
- [ ] material-only を許す/拒否する方針を決める
- [ ] bodyPart を許す/拒否する方針を決める
- [x] `orderBundleMasterSearch.test.tsx` を現行 `etensu only` 契約へ更新する
- [ ] `sourceSetCode` を local-only とするなら durability テストを追加する

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
- [ ] master item 選択から class を導出するか、手動 class 選択 UI を設けるか決める
- [ ] explicit class が無い新規指導料で 130 固定に寄らないようにする
- [ ] instractionCharge の新規作成テストを追加する

### 6-3. parameter 付き selection comment
- [ ] 実装する場合は `itemNumber / itemNumberBranch / parameter` を first-class に追加する
- [x] 非対応とする場合は UI block とテストを正式仕様にする
- [x] 旧期待のテストを修正する
- [ ] medicationgetv2 / selection comment の runtime テストを整備する

### 6-4. charge local-only と auditability
- [ ] `admin / adminMemo / memo / started / sourceSetCode` の local-only 契約を UI で明示する
- [ ] 保存後の dock/detail で `admin/adminMemo` をレビューできるようにするか、少なくとも確認導線を作る
- [ ] charge detail UI テストを追加する

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
- [ ] `docs/web-client/product-improvement/orca-order-remediation-residual-checklist.md` に未チェックが 0 件
- [x] client / server の追加・更新テストが green
- [ ] TODO / FIXME / XXX / temporary comment が残っていない
- [x] save → fetch → normalize → send → XML の smoke を主要系で再実行した
- [ ] 最終報告に residual task count: 0 / open blocker count: 0 を書ける状態にした
