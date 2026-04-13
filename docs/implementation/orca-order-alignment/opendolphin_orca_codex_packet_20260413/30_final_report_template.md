# 最終報告テンプレート

以下の順番で報告すること。  
source / tests / grep / docs / runtime evidence で裏づけられないことは書かない。

---

## 1. 総合 verdict

- PASS / FAIL
- 受入れ可 / 再オープン推奨
- 1段落で結論

## 2. 実施サマリ

- 読んだ文書
- 起動したサブエージェント
- merge 順
- 実行した主要コマンド
- full validation の範囲

## 3. 変更差分サマリ

- merge-base
- 変更ファイル数
- 主要 area
- shared files に入った統合修正

## 4. サブエージェント別成果

- SA-20
- SA-21
- SA-22
- SA-23
- SA-24
- SA-25

各項目:
- 要約
- 主な changed files
- main agent の統合判断
- conflict 解消の有無

## 5. PR0〜PR6 判定表

各 PR ごとに:
- PASS / FAIL / NOT VERIFIED
- 根拠ファイル
- 閉じていない項目

## 6. W1〜W6 coverage 判定表

各 W ごとに:
- Closed / Still Open / Not Verified
- 代表根拠ファイル
- 一言結論

## 7. G0〜G7 判定表

各 gate ごとに:
- PASS / FAIL / NOT VERIFIED
- 根拠ファイル
- 一言結論

## 8. 主要18論点 closure matrix

各論点ごとに:
- Closed / Still Open / Not Verified
- 根拠ファイル
- 一言結論

## 9. 実行コマンド一覧

### git / diff
### grep / rg
### tests / build
### runtime / QA

失敗したコマンドも隠さず書く。

## 10. テスト結果

- server
- web-client
- runtime-ready smoke
- QA scripts
- live ORCA の有無

## 11. docs / mock / inventory / exposure / QA scripts 追随状況

- 何を更新したか
- current 実装との差分がないか

## 12. 重大な未完了事項

- Critical / High / Medium / Low
- file / line
- なぜ完了扱いにできないか

## 13. 最終結論

- 完了なら `受入れ可`
- 未完了なら `再オープン推奨`
- 未完了なら最小の残作業一覧を area 別に具体化
