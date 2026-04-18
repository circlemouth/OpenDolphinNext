# ORCA live QA checklist

> Historical note: this checklist is a 2026-04-17 entry-condition template. `PASS` entries below describe prerequisites, not current live ORCA evidence. The 2026-04-18 static report does not claim live ORCA success, and `qa-acceptmodv2-weborca.mjs` / `qa-fullflow-weborca.mjs` were not run.

## entry conditions
- manual QA 完了
- correction-note verification 完了
- runtime-ready-smoke PASS
- `cd web-client && npm run ci` PASS
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` PASS
- fixed premise drift なし

## live QA focus
### 1. 認証 / bootstrap
- live 環境で session/bootstrap が current contract に沿って成立する
- auth 周りの変更が charts / ORCA 連携表示を阻害していない

### 2. Reception と送信状態
- live データで `送信済` の row 表示が期待どおりに見える
- `送信済` と `会計済み` が統合されていない

### 3. OrcaSummary と会計状態
- current billing summary shell が live で成立する
- `会計済み` 表示が current contract と矛盾しない
- invoice 解決が曖昧なとき、過剰に断定せず fail-close になる

### 4. Print preview
- live 相当フローで preview 到達時に route-state 前提が崩れていない
- state 不足時の missing-state fail-close が不自然な bypass なく成立する

## 記録フォーマット
- area
- live_scenario
- expected
- actual
- pass_fail
- blocker_if_fail
- escalation_owner
