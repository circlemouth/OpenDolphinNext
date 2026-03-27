# Codex Prompt: WS6 stale auth docs / env / QA scaffold cleanup

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を先に読み、`WS6` を実装してください。

## ミッション
repo に残っている stale auth docs / env flags / QA scaffold を current session + factor2 契約へ揃える。

## サブエージェント指示
- subagent A: `VITE_ENABLE_LEGACY_HEADER_AUTH` / `VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK` / `devPasswordMd5` の usage inventory を全 repo で取る
- subagent B: current auth runtime contract を `LoginScreen` と server auth resource から要約
- subagent C: 更新すべき `.env*` / notes / QA scripts の最小リストと mass-edit plan を作る

## 実装方針
- `auth-check.md` は current contract を述べるか archive 化する。旧 auth を current のように書かない。
- runtime で未使用の legacy auth env flags は `.env.sample` / `.env.stage.example` / `.env.prod.example` から削除する。
- QA scripts の `VITE_ENABLE_LEGACY_HEADER_AUTH=1` と `devPasswordMd5` 注入は、current runtime で未使用なら retire / cleanup する。
- Basic / legacy header auth の案内は current contract から外す。

## 実装ガード
- 実 runtime が今も読む設定まで消すなら、必ず code search 根拠を示す。
- auth flow そのものの redesign はしない。
- WS4 administration contract と conflict する変更は避ける。

## 最後の報告
- usage inventory
- 削除した env flags / script injections
- docs の before/after
- 実行した validation
