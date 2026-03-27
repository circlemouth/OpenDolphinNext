# Codex Prompt: WS4 admin config / delivery 二重面の解消 + client/server 契約縮小

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読んだうえで `WS4` を実装してください。

## ミッション
`/api/admin/config` と `/api/admin/delivery` の二重面をやめ、admin config の client/server 契約を backend-supported fields だけに縮小する。

## サブエージェント指示
- subagent A: client の administration / charts page から `/api/admin/delivery` 依存、`syncMismatch`、unsupported field usage を inventory
- subagent B: server の `AdminConfigResource` / `AdminConfigStore` / `AdminConfigSnapshot` を見て single-source-of-truth 化の最小差分を提案
- subagent C: tests / plugin intercept / UI fallout を洗い、validation plan を作る

## 実装方針
- `/api/admin/config` を唯一の取得 endpoint にする。
- `/api/admin/delivery` と、そのためだけの merge / mismatch 管理を削減する。
- `useMockOrcaQueue` は admin config 契約から外す。
- `mswEnabled` は persisted admin config として持つ必要がないなら外す。
- `chartsMasterSource` は backend-supported contract を正本にし、UI/observability が別語彙を必要とするなら edge conversion へ閉じ込める。
- current runtime route や charts data flow を壊さない範囲で最小に実装する。

## 実装ガード
- mock route surface cleanup は WS5 が主担当。administration 配下以外は最小限に留める。
- broad admin redesign はしない。
- ORCA connection / queue / unrelated admin tabs へは広げない。

## 最後の報告
- 単一路線化した endpoint
- 削除した field / state / mismatch logic
- enum / payload の before/after
- 実行した validation
