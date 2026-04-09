# ORCA残タスク 完了報告テンプレート

## 1. 総合判定
- コード上完了 / 証跡待ち / 未完了
- 一言要約
- 判定は current code と current notes に限定し、未提出ログは完了根拠に含めない

## 2. 実施した変更の要約
- injection
- med
- RP-level claim comment
- otherOrder
- surgery
- testOrder
- SoT / canonicalization
- docs / tests / notes

## 3. 変更ファイル一覧
### client
- ...

### server
- ...

### tests
- ...

### docs / notes
- ...

## 4. acceptance results
- AC-P0-01: 達成 / 未達 / 証跡待ち
- AC-P0-02: 達成 / 未達 / 証跡待ち
- AC-P0-03: 達成 / 未達 / 証跡待ち
- AC-P0-04: 達成 / 未達 / 証跡待ち
- AC-P0-05: 達成 / 未達 / 証跡待ち
- AC-P0-06: 達成 / 未達 / 証跡待ち
- AC-P0-07: 達成 / 未達 / 証跡待ち
- AC-P0-08: 達成 / 未達 / 証跡待ち
- AC-P0-09: 達成 / 未達 / 証跡待ち
- AC-P0-10: 達成 / 未達 / 証跡待ち
- AC-P1-01: 達成 / 未達 / 証跡待ち
- AC-P1-02: 達成 / 未達 / 証跡待ち
- AC-P1-03: 達成 / 未達 / 証跡待ち
- AC-P1-04: 達成 / 未達 / 証跡待ち
- AC-P1-05: 達成 / 未達 / 証跡待ち
- AC-P2-01: 達成 / 未達 / 証跡待ち
- AC-P2-02: 達成 / 未達 / 証跡待ち
- AC-P2-03: 達成 / 未達 / 証跡待ち
- NR-01: 維持 / 破壊 / 未確認
- NR-02: 維持 / 破壊 / 未確認
- NR-03: 維持 / 破壊 / 未確認
- NR-04: 維持 / 破壊 / 未確認
- NR-05: 維持 / 破壊 / 未確認
- NR-06: 維持 / 破壊 / 未確認

## 5. 実行コマンドと結果
### client
```text
<command>
<result>
```

### server
```text
<command>
<result>
```
- `-Pstatic-analysis verify` は SpotBugs / FindSecBugs の verify entrypoint として記録する。Checkstyle / PMD は execution があっても skip=true のため、このテンプレートでは「通した」と読める表現にしない。
- `includeTests=false` のため、server test source まで static-analysis したかのような表現は避ける。

## 6. grep gate
```text
<command>
<result>
<why the hit is acceptable only when it is intentionally retained as a boundary alias or canonicalization helper>
```
- literal 0 hit を完了条件にしない。通常 UI / 通常 test / current notes に stale alias や stale wording が残っていないかを実質評価する。

## 7. 互換ロジック / dead code の削除一覧
- ...

## 8. 監査メモ
- Agent E の判定
- 未解決件数は evidence がある範囲でのみ記載する
- ログ未提出の項目は evidence pending と分離する

## 9. 残課題
- 0 件 / あり / 証跡待ち
- 1 件でも未解決または証跡待ちがあるなら、未完了として報告する
