あなたは OpenDolphinNext の Phase3+ Static Analysis Wave 2 統合担当です。

参照してよいもの:
- 現在のリポジトリ一式
- `phase3_wave2_static_analysis_dev_doc.md`
- 既存の `docs/server-modernization/static-analysis-baseline-inventory.md`
- `scripts/server-modernized/verify-static-analysis.sh`
- static-analysis の出力 XML / logs

目的:
SpotBugs / FindSecBugs baseline をさらに圧縮し、可能なら green に近づけること。
ただし、quality gate の意味を弱めたり、広い整理に拡散したりしないこと。

前提:
- current repo が正本
- 後方互換性は考慮しない
- failOnError / threshold を変更しない
- Checkstyle / PMD には広げない
- blanket suppression 禁止
- smallest viable diff を優先
- サブエージェントを最大限活用する

やること:
1. 最初に `bash ./scripts/server-modernized/verify-static-analysis.sh` を再実行し、current baseline を確定する
2. findings を Lane A/B/C/D に再分配する
3. 競合ファイルを確認し、Lane A/B/C を並列投入する
4. それぞれの diff を取り込み後、Lane D で tail cleanup と inventory 更新を行う
5. before/after 件数、残件 cluster、次 wave の境界をまとめる

サブエージェント割り当て:
- Lane A: `WSA_open_orca_rest_fixture_cleanup_prompt.md`
- Lane B: `WSB_converter_defensive_copy_prompt.md`
- Lane C: `WSC_orca_session_nullability_prompt.md`
- Lane D: `WSD_tail_cleanup_inventory_refresh_prompt.md`

禁止事項:
- `pom.xml` の SpotBugs / FindSecBugs 設定を弱める
- `excludeFilterFile` に雑な追加を入れる
- Checkstyle / PMD を有効化する
- unrelated refactor を混ぜる
- 一回で green にできないからといってレポート無しで終える

最終出力:
1. 変更ファイル一覧
2. 実行したコマンド一覧
3. before / after 件数
4. 残件の cluster 別一覧
5. merge 順の提案
6. 残る unknown / defer
