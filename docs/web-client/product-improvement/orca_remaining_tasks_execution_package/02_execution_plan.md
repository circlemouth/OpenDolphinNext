# ORCA残タスク 完遂工程表

## 1. 目的

最新の再検証で未解消と判定された残タスクを、**実装・テスト・help/docs 同期・証跡収集** まで含めて完了させる。
今回の終了条件は「レビューで指摘されたズレが全部消え、matrix の必須証跡が揃うこと」である。

## 2. 完了判定の前提

今回の最終完了は、次の 4 条件をすべて満たしたときだけ成立する。

1. `03_detailed_remaining_task_spec.md` の expected contract が current code で満たされる
2. `04_acceptance_and_verification_matrix.md` の acceptance 全項目が達成される
3. targeted tests / full tests / build / verify / static-analysis のログが残る
4. help / tests / docs / notes まで current behavior に同期する

## 3. 現在の残タスク全体像

### P0: 今回の blocker
- injection の `admin/adminCode/adminMemo/speed` を local-only に統一し切る
- med usage send-block を end-to-end で閉じる
- otherOrder の save-side を explicit local-only contract に置き換える
- surgery `501/502` standalone と rowRole semantics を client/server/fetch で一本化する
- RP-level structured claim comment note の source-bundle round-trip 漏れを塞ぐ
- stale help / tests / notes を current behavior に同期する
- client/server の必須 test/build/verify/static-analysis を実行し、ログを残す

### P1: 同スプリントで必ず畳む残件
- source-of-truth の重複 canonicalization / fallback を catalog 委譲へ寄せる
- charge class/name canonicalization を単一化する
- testOrder の exact fail-close を save/send/server 共有 contract とテストで証明する
- no-regression tests を追加し、已解消の physiology / bacteria / radiology / selection comment / generic flag を固定する

### P2: 再発防止と取りこぼし整理
- `PrescriptionOrderEditorPanel` の `usageCode <- adminMemo` バグを修正する
- `isSendableInjectionAdminCode` など stale helper を削除または本実装へ寄せる
- grep gate を CI か少なくとも検証スクリプトに組み込む

## 4. 実行体制

最低 5 サブエージェントで並列化する。

### Agent A: Contract Architect
担当:
- 最新残タスクを current contract に落とす
- shared helper 化の設計
- surgery rowRole / otherOrder explicit contract の最終仕様固め

成果物:
- 実装前メモ
- touchpoint 一覧
- 競合解消指示

### Agent B: Prescription / Injection Implementer
担当:
- med usage send-block
- injection local-only wire-off
- RP-level claim comment round-trip
- editor 復元バグ

### Agent C: Bundle Grammar Implementer
担当:
- surgery standalone + rowRole 単一化
- otherOrder explicit local-only contract
- testOrder exact fail-close の shared 化

### Agent D: SoT / Canonicalization / Docs & Tests Implementer
担当:
- SoT 重複削除
- charge canonicalization 統一
- help / tests / notes 同期
- grep gate 整備

### Agent E: Final Auditor
担当:
- `03` と `04` を基準に最終監査
- 未解決 0 件判定
- 証跡漏れ確認

## 5. フェーズ分割

## Phase 0: ベースライン収集
### 目的
変更前に current code の問題点と touchpoint を確定する。

### 作業
- `03_detailed_remaining_task_spec.md` を読み、各 task ID の対象ファイルを列挙
- 現状 grep を実行
- 変更対象ファイルの所有関係を整理
- test 実行前提を確認

### 出力
- baseline memo
- 変更対象一覧
- 依存関係図

### フェーズ完了条件
- P0/P1/P2 の対象ファイルが重複なく割り当て済み

---

## Phase 1: prescription / injection / claim comment
### 目的
med と injection の wire/local-only 不一致を潰し、claim comment note を round-trip 可能にする。

### 実装順
1. injection local-only contract を client/server/save/send/fetch で統一
2. med usage send-block を first-class prescription save / send / server resource で閉じる
3. RP-level structured claim comment note の source-bundle round-trip 修正
4. `PrescriptionOrderEditorPanel` の usageCode 復元バグ修正

### 依存関係
- `prescriptionOrderApi.ts` と `orderRpNormalization.ts` の変更を揃えること
- `OrcaPrescriptionOrderResource.java` と `OrcaOrderBundleMutationExecutionSupport.java` の意味論をずらさないこと

### フェーズ完了条件
- AC-P0-01, AC-P0-02, AC-P0-05, AC-P2-01 達成

---

## Phase 2: surgery / otherOrder / testOrder
### 目的
bundle grammar の未閉鎖を解消する。

### 実装順
1. surgery `501/502` standalone rule を client/server 共通化
2. surgery rowRole resolver を validation / persistence / fetch で一本化
3. otherOrder explicit local-only contract を client/server で導入
4. testOrder allowlist fail-close を shared helper 化し、save/send/server を揃える

### 依存関係
- surgery rowRole の canonical semantics を先に確定してから各 path に適用する
- otherOrder の explicit contract を client/server 同時変更で入れる

### フェーズ完了条件
- AC-P0-03, AC-P0-04, AC-P1-03 達成

---

## Phase 3: SoT cleanup / docs / tests / no-regression
### 目的
残る source-of-truth 分裂を畳み、説明・テスト・notes を current behavior に合わせる。

### 実装順
1. `orderRpRequirements.ts` の独自 canonicalization を catalog 委譲へ寄せる
2. server の charge/radiology canonicalization を catalog 委譲へ寄せる
3. stale help / tests / notes を更新
4. already-fixed 領域の no-regression tests を追加
5. stale helper / grep gate を整理

### フェーズ完了条件
- AC-P0-06, AC-P1-01, AC-P1-02, AC-P1-04, AC-P2-02, AC-P2-03 達成

---

## Phase 4: 検証 / 証跡収集 / 最終監査
### 目的
完了判定に必要な証跡を揃える。

### 作業
- client targeted tests
- client full tests / typecheck / build
- server targeted tests
- server full test / verify / `-Pstatic-analysis verify`
- grep gate
- 変更ファイル差分レビュー
- Final Auditor による未解決 0 件判定

### フェーズ完了条件
- AC-P0-07 達成
- 最終報告で残課題 0 件

## 6. 作業順の原則

### 原則 1
policy と実装が食い違っている箇所は、**policy に合わせて production path を直す**。

### 原則 2
「catalog にはあるが production path が見ていない」は未完了。

### 原則 3
「send は止まるが save は通る」「save では reject だが fetch で resurrect」は未完了。

### 原則 4
local-only のものは local save/fetch では保持し、wire には出さない。

### 原則 5
後方互換は不要。broad range / legacy regex / legacy fallback は削除する。

## 7. リスクと対策

### リスク A: med と injection のロジックが同じ helper を共有していて副作用が出る
対策:
- entity ごとに contract table を明示し、shared helper は entity-aware にする

### リスク B: surgery rowRole を一本化した結果、fetch/display が壊れる
対策:
- validation / persistence / fetch の 3 path を同じ resolver に寄せ、round-trip test を追加する

### リスク C: otherOrder の broad shape 削除で UI 保存が壊れる
対策:
- explicit local-only contract を先に定義し、その contract で request/save/fetch tests を追加してから broad rule を消す

### リスク D: docs/tests だけが先に更新され、実装が追随しない
対策:
- docs/test 更新は必ず対応実装の直後に行う

## 8. Done の定義

次を全部満たしたら Done:

- P0/P1/P2 の全 task ID が達成
- change list に未説明ファイルがない
- targeted tests / full tests / build / verify / static-analysis の証跡がある
- grep gate の説明できない hit が 0
- Final Auditor が未解決 0 件と判定
