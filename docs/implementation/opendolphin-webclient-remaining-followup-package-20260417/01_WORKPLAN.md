# 残タスク工程表

## 目的
残っている correction-note 系 blocker と storage contract drift を閉じ、manual QA / ORCA live QA へ進める状態まで整える。

## 実行順
1. Task 10: claim-send cache storage contract hardening
2. Task 20: charts correction-note / setting-note follow-up fix
3. Task 30: post-fix retest and release-gate handoff refresh
4. manual QA
5. ORCA live QA

## task gating
- Task 10 完了前に Task 20 を始めない
- Task 20 完了前に Task 30 を始めない
- `tests/charts/e2e-billing-correction-note.spec.ts` と `tests/reception/e2e-billing-correction-note.spec.ts` の両方が pass しない限り manual QA に進めない
- `cd web-client && npm run ci` が post-fix で pass しない限り stop-ship を解除しない

## targeted retest order
1. touched unit/component tests for orcaClaimSendCache / OrcaSummary / orcaBillingStatus
2. tests/charts/e2e-billing-correction-note.spec.ts
3. tests/reception/e2e-billing-correction-note.spec.ts
4. cd web-client && npm run ci

## release gate truth
- runtime-ready-smoke / `npm run ci` / server verify の「前回 PASS」文言は current truth として carry forward しない
- この package の判断に使う前に rerun で current truth を取り直す
- server 側未変更でも server verify を PASS 済み扱いにしない

## stop conditions
- security spec と逆向きの永続化が増える変更しか成立しない場合
- correction note / setting note を disclosure 内へ閉じ込める方向でしか通らない場合
- `send success != paid` を崩さないと通らない場合
- repo 証拠なしの route/state/schema/copy invent が必要になった場合

## final report minimum
- changed_files
- task_10_status
- task_20_status
- targeted_retests
- ci_status
- runtime_ready_smoke_carry_forward_or_rerun
- manual_QA_entry_open_or_blocked
- ORCA_live_QA_entry_open_or_blocked
- stop_ship_remaining_or_cleared
