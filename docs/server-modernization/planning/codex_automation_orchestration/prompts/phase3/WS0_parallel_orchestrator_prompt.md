# Codex Prompt: Phase3+ Parallel Orchestrator

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読み、WS1〜WS8 を並列に捌くオーケストレータとして動いてください。

## 役割
あなたはメイン agent です。サブエージェントを最大限使い、各 workstream を衝突最小で並列処理してください。

## 初手
1. 共有コンテキストを読んで reopen 禁止事項を固定する。
2. `phase3_codex_parallel_workstreams.md` の dependency / conflict を確認する。
3. 次の 8 サブエージェントを作る。
   - agent-ws1: root route surface
   - agent-ws2: chart-event SSE-only
   - agent-ws3: dead server legacy stack
   - agent-ws4: admin contract collapse
   - agent-ws5: mock route surface shrink
   - agent-ws6: auth docs/env cleanup
   - agent-ws7: server config contract
   - agent-ws8: reporting contract
4. 各 agent に、対応する `WS*_..._prompt.md` の内容をそのまま渡す。
5. file overlap が出たら先に inventory だけ返させ、衝突回避を決めてから edit を始める。

## あなたの責務
- 各 agent の inventory / risk / patch plan を先に集める
- conflict がない組み合わせから edit と validation を走らせる
- `unknown` を勝手に仕様化しない
- broad refactor を止める
- 最終的に changed files / validation / blocker を WS ごとに整理する

## 完了条件
- WS1〜WS8 の結果を一つに統合した最終サマリを出す
- `done / blocked / unknown` を WS 単位で明示する
- 実行した test コマンドを列挙する
- merge 順を提案する
