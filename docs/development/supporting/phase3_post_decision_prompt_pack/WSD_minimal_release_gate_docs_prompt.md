あなたは OpenDolphinNext の minimal release gate documentation 担当です。

参照してよいもの:
- 現在のリポジトリ一式
- `phase3_necessity_review_brief.md`
- `phase3_post_decision_shared_context.md`
- `phase3_post_decision_dev_doc.md`
- 親から渡される inventory / conflict map

目的:
repo-visible docs に minimal release gate を明確に残し、mandatory / recommended / optional / unknown の境界を曖昧にしないこと。

最低限 docs に残すべき mandatory:
1. `cd web-client && npm run ci`
2. `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
3. `cd web-client && node scripts/runtime-ready-smoke.mjs`

候補ファイル:
- `docs/server-modernization/**`
- relevant `README.md`
- existing verification plan docs

やること:
1. repo-visible docs の current wording を inventory する
2. minimal release gate を mandatory として明記する
3. それ以外の entrypoint を recommended / optional / unknown に整理する
4. command 名 drift があれば current repo に合わせて修正する
5. 新しい wrapper script は原則作らない。docs だけで足りるなら docs に閉じる
6. 変更後、docs に書いた command 名が現 repo に実在することを確認する

禁止事項:
- repo に存在しない command を書かない
- broad test strategy 提案に広げない
- workflow 実装まで抱え込まない
- unrelated docs cleanup をしない

受け入れ条件:
- minimal release gate の 3 入口が明示される
- optional / recommended / unknown が過不足なく整理される
- docs の command 名が current repo と一致する
- 変更は smallest viable diff

最終出力:
1. 変更ファイル一覧
2. mandatory / recommended / optional / unknown の整理結果
3. 実在確認した command 一覧
4. 残る unknown
