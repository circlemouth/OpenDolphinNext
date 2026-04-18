# post-fix release gate runbook

## 目的
Task 10 と Task 20 の修正後に、manual QA / ORCA live QA に入れる状態かを再確認する。

## 手順
1. `cd web-client && npm run typecheck`
2. touched unit/component tests
3. `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-billing-correction-note.spec.ts`
4. `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/reception/e2e-billing-correction-note.spec.ts`
5. `cd web-client && npm run ci`
6. `cd web-client && node scripts/runtime-ready-smoke.mjs`
7. manual QA entry conditions を点検する
8. ORCA live QA entry conditions を点検する

## manual QA entry conditions
- charts correction-note spec passes
- reception correction-note spec passes
- claim-send cache storage contract aligned
- web-client npm run ci passes after residual fixes
- fixed premise drift check clean
- runtime-ready-smoke rerun passes in the current run

## ORCA live QA entry conditions
- manual QA completed
- charts correction-note follow-up closed
- web-client npm run ci pass maintained
- runtime-ready-smoke entry condition satisfied
- fixed premise drift check clean

## 記録フォーマット
- charts_correction_note_status
- reception_correction_note_status
- storage_contract_status
- ci_status
- runtime_ready_smoke_status
- manual_QA_entry_open_or_blocked
- ORCA_live_QA_entry_open_or_blocked
- remaining_stop_ship_items
