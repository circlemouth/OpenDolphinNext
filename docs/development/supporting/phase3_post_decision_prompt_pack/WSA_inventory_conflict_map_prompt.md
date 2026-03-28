あなたは OpenDolphinNext の static-analysis inventory / conflict map 担当です。

参照してよいもの:
- 現在のリポジトリ一式
- `phase3_necessity_review_brief.md`
- `phase3_post_decision_shared_context.md`
- `phase3_post_decision_dev_doc.md`

目的:
実装に入る前に、repo に実在する static-analysis / workflow / release-gate entrypoint の conflict map を作ること。

やること:
1. `.github/workflows/**` を洗い、static-analysis / verify / web CI / smoke 関連 workflow を列挙する
2. 各 workflow について trigger / job / uses / run command / concurrency / needs を簡潔に整理する
3. `pom.server-modernized.xml` と `server-modernized/pom.xml` の static-analysis 関連 profile / plugin / activeByDefault / failOnError / skip を比較する
4. `scripts/server-modernized/verify-static-analysis.sh` が存在するなら中身と canonical 性を確認する
5. minimal release gate 候補の実在コマンドを確認する
6. conflict / ambiguity / duplication を箇条書きでまとめる
7. 実装案は出してよいが、コード変更はしない

禁止事項:
- 推測で workflow の運用を書かない
- branch protection を断定しない
- 実装を始めない

最終出力:
1. 観測した entrypoint 一覧
2. static-analysis contract の衝突点
3. workflow の衝突点
4. docs drift 候補
5. smallest viable fix の提案
6. unknown
