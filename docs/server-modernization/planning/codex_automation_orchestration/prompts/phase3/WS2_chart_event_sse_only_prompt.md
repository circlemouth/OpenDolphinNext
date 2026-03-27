# Codex Prompt: WS2 chart-event legacy AsyncContext fallback 削除

先に添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読み、`WS2` を実装してください。

## ミッション
chart event realtime delivery を SSE 単線へ寄せ、frozen fallback として残っている AsyncContext long-poll path を削除する。

## サブエージェント指示
- subagent A: `AsyncContext` / `addAsyncContext` / `removeAsyncContext` / `getAsyncContextList` の repo 全 usage を洗う
- subagent B: `ChartEventServiceBean` と `ServletContextHolder` の最小 delete plan を出す
- subagent C: chart-event 関連 test の更新方針と検証コマンドを作る

## 実装条件
- `notifyEvent` は SSE broadcast のみを行う形へ寄せる。
- `ServletContextHolder` から legacy AsyncContext list と API を除去する。
- tests は「legacy fallback が呼ばれること」ではなく「SSE path が生きていること」を守る方向に変える。
- 他の realtime 機構へは踏み込まない。

## 最後の報告
- 削除した API / class / test
- AsyncContext usage inventory の結果
- 実行した validation
- 残課題があれば `unknown`
