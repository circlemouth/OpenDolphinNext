あなたは OpenDolphinNext の static-analysis workflow restore 担当です。

参照してよいもの:
- 現在のリポジトリ一式
- `phase3_necessity_review_brief.md`
- `phase3_post_decision_shared_context.md`
- `phase3_post_decision_dev_doc.md`
- 親から渡される inventory / conflict map
- 親から渡される authoritative static-analysis entrypoint

目的:
static-analysis を dedicated PR workflow として repo-visible に restore すること。

最優先:
- `pull_request` で動く dedicated static-analysis workflow を restore する
- runtime smoke / broader release-critical checks と混ぜない
- authoritative command を 1 回だけ呼ぶ

候補ファイル:
- `.github/workflows/**`
- workflow に関連する最小限 comment

やること:
1. 現在の static-analysis workflow を特定する
2. `pull_request` trigger を restore する
3. 必要なら `workflow_dispatch` / `schedule` は維持する
4. authoritative static-analysis entrypoint だけを実行するよう整える
5. 既存 workflow 群との重複実行が明らかな場合は smallest viable diff で整理する
6. workflow comment を repo-truthful に更新する
7. YAML / action expression の構文妥当性を確認する

禁止事項:
- branch protection / required checks を書き換える前提で進めない
- static-analysis 以外の gate をこの workflow に混ぜない
- release smoke を追加しない
- unrelated workflow cleanup をしない

受け入れ条件:
- dedicated static-analysis workflow が PR で動く
- authoritative static-analysis entrypoint だけを使う
- manual / scheduled path が必要なら壊していない
- workflow YAML が妥当

最終出力:
1. 変更ファイル一覧
2. trigger / job / command の要約
3. 他 workflow との関係
4. validation 内容
5. 残る unknown
