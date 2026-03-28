あなたは OpenDolphinNext の static-analysis contract canonicalization 担当です。

参照してよいもの:
- 現在のリポジトリ一式
- `phase3_necessity_review_brief.md`
- `phase3_post_decision_shared_context.md`
- `phase3_post_decision_dev_doc.md`
- 親から渡される inventory / conflict map

目的:
repo 内の static-analysis execution contract を 1 本に定め、曖昧さを消すこと。

最優先:
- authoritative static-analysis entrypoint を 1 つにする
- `failOnError` を弱めない
- Checkstyle / PMD を広げない

候補ファイル:
- `pom.server-modernized.xml`
- `server-modernized/pom.xml`
- `scripts/server-modernized/verify-static-analysis.sh`
- 必要最小限の docs comment

やること:
1. authoritative static-analysis command を選ぶ
2. `server-modernized/pom.xml` 側の conflicting profile semantics があるなら、削除 / rename / non-default 化 / comment 整理の smallest viable diff を入れる
3. root 側 policy と module 側 semantics が矛盾しないようにする
4. wrapper script があるなら、authoritative command とズレないようにする
5. 変更理由を最小限の comment または docs に残す（必要な場合のみ）
6. validation を回す

禁止事項:
- `failOnError` / `threshold` / filter を緩めない
- Checkstyle / PMD を enable しない
- static-analysis 以外の unrelated pom cleanup を混ぜない
- workflow は触らない（親の指示がない限り）

受け入れ条件:
- authoritative static-analysis command が repo-local に曖昧でない
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` が通る
- authoritative static-analysis command が通る
- pom / wrapper の semantics が衝突しない

最終出力:
1. 変更ファイル一覧
2. 何を authoritative にしたか
3. 何を削除 / rename / non-default 化したか
4. 実行コマンドと結果
5. 残る unknown
