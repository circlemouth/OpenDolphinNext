# Codex Prompt: WS5 product runtime の `.mock` route surface 削除

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読んで `WS5` を実装してください。

## ミッション
product runtime code から `/api/orca/.../mock` surface を消し、dev/test mock は実 route interception に限定する。

## サブエージェント指示
- subagent A: `web-client/src` 配下の `.mock` route string を inventory
- subagent B: reception / patients / related mocks handlers の最小変更案を作る
- subagent C: 既存 tests への影響と必要な更新点を洗う

## 実装方針
- `reception/api.ts` と `patients/api.ts` の candidate list から `.mock` path を外す。
- MSW は `/api/orca/...` の実 route を intercept して mock behavior を出す。
- `.mock` 専用 handlers / fixtures / tests は統合または削除する。
- administration config 周辺の field 削除には踏み込まない（必要なら最小参照だけ）。

## 実装ガード
- runtime public contract を狭めるのが目的。MSW 自体は消さない。
- blocked route verify script の対象は勝手に広げない。
- WS4 と conflict しそうな administration ディレクトリには入らない。

## 最後の報告
- 消した `.mock` route string 一覧
- 実 route interception に寄せた箇所
- 実行した validation
