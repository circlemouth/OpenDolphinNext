あなたは OpenDolphinNext の Phase3+ post-decision implementation 統合担当です。

参照してよいもの:
- 現在のリポジトリ一式
- `phase3_necessity_review_brief.md`
- `phase3_post_decision_shared_context.md`
- `phase3_post_decision_dev_doc.md`

目的:
repo-only で既に確定した 2 つの判断を、repo-local truth として反映すること。

対象判断:
1. static-analysis workflow は `restore now` ではなく `rewrite then restore`
2. minimal release gate は次の 3 入口
   - `cd web-client && npm run ci`
   - `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
   - `cd web-client && node scripts/runtime-ready-smoke.mjs`

前提:
- 後方互換性は不要
- current repo が正本
- SpotBugs / FindSecBugs fail-on-error は維持
- Checkstyle / PMD は維持（skip のまま）
- branch protection / required checks は repo 外なので推測しない
- 不明は `unknown` と明記する
- build artifact は無視する

進め方:
- まず subagent を最大限活用して inventory / conflict map を作る
- その後、static-analysis contract / workflow / docs の 3 面を分けて進める
- 競合ファイルは親が先に ownership を決める
- 変更は smallest viable diff を優先する
- broad refactor は禁止

推奨サブエージェント割り当て:
- Agent A: inventory / conflict map
- Agent B: static-analysis contract canonicalization (`pom.server-modernized.xml`, `server-modernized/pom.xml`, wrapper scripts)
- Agent C: workflow restore (`.github/workflows/**`)
- Agent D: release-gate docs (`docs/**`, relevant README / verification plan)

ファイル ownership の基本方針:
- Agent B は Maven / wrapper scripts に集中
- Agent C は workflow に集中
- Agent D は docs に集中
- 同じ docs を複数 agent が触らないように親が調整する

禁止事項:
- `failOnError` を緩めない
- Checkstyle / PMD を enable しない
- runtime smoke を static-analysis workflow に押し込まない
- repo 外の required check を想像で書かない
- closed Phase2 論点を reopen しない
- unrelated cleanup を混ぜない

必須タスク:
1. 現 repo の static-analysis entrypoint と workflow を inventory する
2. canonical static-analysis contract を 1 本に定める
3. dedicated static-analysis PR workflow を restore する
4. minimal release gate を repo-visible docs に明記する
5. 実在コマンドで validation する

受け入れ条件:
- static-analysis の authoritative entrypoint が曖昧でない
- dedicated PR workflow が static-analysis 専用で restore される
- minimal release gate の 3 入口が docs に明示される
- compile と authoritative static-analysis verify が通る
- 変更は smallest viable diff に留まる

最終出力:
1. 変更ファイル一覧
2. authoritative static-analysis entrypoint の説明
3. workflow 変更要約
4. minimal release gate 文書化の要約
5. 実行コマンド一覧と結果
6. 残る unknown
7. merge 上の注意点
