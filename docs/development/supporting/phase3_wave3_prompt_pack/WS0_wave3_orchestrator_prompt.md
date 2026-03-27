あなたは OpenDolphinNext の Phase3 Wave 3 static-analysis burn-down 統合担当です。

前提:
- current repo を正本とする
- 後方互換性は考慮しない
- いまの本命は static-analysis baseline 圧縮であり、feature 追加ではない
- Wave 2 統合後の baseline は 144
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` は通っている
- `bash ./scripts/server-modernized/verify-static-analysis.sh` は SpotBugs 144 件で失敗する
- `pom.server-modernized.xml` の SpotBugs / FindSecBugs failOnError, threshold, filter 方針は変更禁止
- Checkstyle / PMD は今回も対象外
- blanket suppression は禁止

最優先目標:
最小の変更で baseline をさらに大きく削ること。green 未達でもよいが、inventory と残件境界を明確にして次 wave を小さくすること。

進め方:
1. まず現 repo の残件を再確認する
2. 次にサブエージェントを最大限使って Lane B / C / D / A tail を並列で進める
3. overlap file を先に洗い出す
4. 各 lane は compile と SpotBugs 差分確認まで持つ
5. 最後に親が統合し、canonical verify を再実行して before/after をまとめる

サブエージェント割り当て:
- Lane B agent: converter / shared.converter の `EI_EXPOSE_REP2`
- Lane C agent: ORCA service / push / transport の nullability / expose-rep
- Lane D agent: admin/rest/masterupdate tail cleanup
- Lane A agent: `OrcaMasterKensaSortQueryService` dynamic SQL 1 件

必須制約:
- `pom.server-modernized.xml` の failOnError / threshold / plugin intent を変更しない
- blanket suppression / broad exclude は入れない
- Checkstyle / PMD は触らない
- unrelated refactor を混ぜない
- runtime/public contract を広げない
- smallest viable diff を徹底する

Lane B への指示:
- `open.dolphin.converter` / `open.dolphin.shared.converter` の direct assignment を defensive copy に置き換える
- 同一パターンを機械的に揃える
- public API を変えすぎない

Lane C への指示:
- `DefaultOrcaLiveGateway` を最優先に潰す
- ORCA push DTO ネストの mutable exposure を解消する
- transport/session 周辺の nullability / expose-rep を閉じる

Lane D への指示:
- `NP_BOOLEAN_RETURN_NULL` をまず消す
- `NP_NULL_ON_SOME_PATH`, `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`, `UPM_UNCALLED_PRIVATE_METHOD` を局所修正する
- 主対象は `AdminOrcaConnectionResource`, `AdminConfigResource`, `KarteResource`, `StampResource`, `MasterUpdate*`, `AuditChainVerifier`

Lane A への指示:
- `OrcaMasterKensaSortQueryService` の dynamic SQL を、allowlist enum か query-shape 分割で constant-ish な構成へ寄せる
- SpotBugs の `SQL_PREPARED_STATEMENT_GENERATED_FROM_NONCONSTANT_STRING` を消す
- query behavior を変えすぎない

統合時の必須作業:
- 競合を解消して全 lane を統合する
- `bash ./scripts/server-modernized/verify-static-analysis.sh` を再実行する
- before/after 件数を記録する
- `docs/server-modernization/static-analysis-baseline-inventory.md` を更新する
- まだ残る cluster を package / bug code 単位で整理する

受け入れ条件:
- baseline が material に減る
- compile を維持する
- failOnError / threshold / filter は不変
- inventory が更新される
- 残件が次 wave に切れる粒度で明示される

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before/after 件数
4. lane 別の成果
5. 残件の cluster 別一覧
6. merge 順の提案
7. 残る unknown / defer
