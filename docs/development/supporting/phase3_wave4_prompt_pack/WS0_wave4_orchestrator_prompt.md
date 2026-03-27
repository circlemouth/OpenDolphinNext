あなたは OpenDolphinNext の Phase3+ Wave 4 static-analysis 統合担当です。

参照してよいもの:
- current repo
- `phase3_wave4_static_analysis_dev_doc.md`
- `docs/server-modernization/static-analysis-baseline-inventory.md`
- `pom.server-modernized.xml`
- `scripts/server-modernized/verify-static-analysis.sh`

目的:
残っている SpotBugs / FindSecBugs 35 件を smallest viable diff で潰し、`bash ./scripts/server-modernized/verify-static-analysis.sh` を green にすること。
failOnError / threshold / filter を弱めることは禁止。
Checkstyle / PMD を有効化することも禁止。

前提:
- current repo が正本
- 後方互換性は考慮しない
- broad refactor ではなく delete-first / local-fix-first
- blanket suppression 禁止
- `pom.server-modernized.xml` の static-analysis 方針は維持
- サブエージェントを最大限活用する
- overlapping files は避け、親が最終統合する

最初にやること:
1. `bash ./scripts/server-modernized/verify-static-analysis.sh` を再実行して current XML を生成する
2. `server-modernized/target/static-analysis/spotbugs/spotbugs-opendolphin-server-modernized.xml` を集計し、35 件が current repo でも一致するか確認する
3. 各 finding を次の 7 lane に割り振る
   - WS-A `open.dolphin.rest`
   - WS-B `open.dolphin.rest.orca`
   - WS-C `open.dolphin.persistence.query`
   - WS-D `open.dolphin.security.audit`
   - WS-E `open.dolphin.orca.adapter`
   - WS-F `open.dolphin.orca.converter`
   - WS-G `open.dolphin.runtime` / `open.dolphin.runtime.config` / `open.dolphin.security.integrity` / `open.dolphin.security.totp`
4. 各 lane を子サブエージェントへ配布し、対象 package / class / bug code / 件数を明示する

必須ルール:
- `pom.server-modernized.xml` の `failOnError` / `threshold` / exclude filter を変更しない
- Checkstyle / PMD を有効化しない
- blanket suppression を追加しない
- unrelated cleanup を混ぜない
- current behavior / public contract を広く変えない
- closed Phase2 issue を reopen しない

統合作業:
- 子の diff を衝突確認して順次統合する
- lane ごとに compile 崩れがないか確認する
- 最後に以下を実行する
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile`
  - `bash ./scripts/server-modernized/verify-static-analysis.sh`
- `docs/server-modernization/static-analysis-baseline-inventory.md` に before / after を反映する

green 未達時の処理:
- 残件を package / class / bug code で再集計する
- false positive 断定はしない
- どうしても filter 候補がある場合も、今回は実装 fix を優先し、filter 追加は親判断に留める
- 残件を次 wave に切れる粒度で整理する

最終出力:
1. 変更ファイル一覧
2. 実行コマンド一覧
3. before / after 件数
4. lane ごとの成果
5. 残件の cluster 別一覧
6. merge 上の注意点
7. unknown / defer
