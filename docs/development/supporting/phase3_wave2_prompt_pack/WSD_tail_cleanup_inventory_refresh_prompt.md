あなたは OpenDolphinNext の Static Analysis Lane D 担当です。

対象:
- `PlistParser` 周辺
- `LocalMedicalSummaryService.java`
- `open.dolphin.orca.converter` / `open.dolphin.persistence.query` などの少数残件
- `docs/server-modernization/static-analysis-baseline-inventory.md`
- static-analysis 実行ログ / XML

目的:
A/B/C 取り込み後の tail を掃除し、inventory を更新して Wave 2 の結果を repo に固定すること。

現在わかっていること:
- Cluster C は 1 件のみ (`LocalMedicalSummaryService.java`)
- Cluster A tail として `PlistParser` の `DE_MIGHT_IGNORE` / `REC_CATCH_EXCEPTION` が残る
- Other / out-of-cluster は 9 件程度

前提:
- current repo が正本
- 後方互換性は不要
- failOnError / threshold 不変
- blanket suppression 禁止
- Lane D は A/B/C 後に実行する

やること:
1. A/B/C 取り込み後の current baseline を再取得する
2. `PlistParser`, `LocalMedicalSummaryService`, 少数残件を最小差分で潰す
3. `bash ./scripts/server-modernized/verify-static-analysis.sh` を再実行する
4. `docs/server-modernization/static-analysis-baseline-inventory.md` を更新する
5. before / after 件数、残件 cluster、次 wave 境界を記録する

禁止事項:
- `pom.xml` 変更
- filter 緩和
- inventory 更新だけで終わること
- unrelated cleanup

受け入れ条件:
- tail がさらに減る
- inventory が最新化される
- before / after が repo に残る
- next wave の境界が明確になる

最終出力:
1. 変更ファイル一覧
2. 実行コマンド
3. 最終件数
4. inventory 更新内容
5. 残件の cluster 別一覧
