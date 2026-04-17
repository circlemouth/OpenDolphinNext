# Task 20 — charts correction-note / setting-note follow-up fix

## ゴール
`tests/charts/e2e-billing-correction-note.spec.ts` を current billing boundary contract に沿って通す。
correction note と setting note は別 slot / 別 tone とし、重要情報として visibility を確保する。
current scenario が `unresolved` ではなく `paid` に落ちているなら、spec data を contract に合う scenario へ是正する。current runtime が note を details fold に押し込んでいるなら、runtime を docs に合わせて是正する。

## 使用可能情報
- repo 実体
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/`
- `artifacts/review-bundles/OpenDolphin_WebClient-review-package-curated-20260417T101132Z.zip`
- `docs/implementation/opendolphin-webclient-followup-release-gate-package-20260417/`
- この prompt と docset
- 外部サイト、一般論、記憶補完は禁止

## 固定前提
- 3 ペイン責務固定
- patient context 非永続
- `finish` と `send` は分離
- right rail chooser-only
- `送信済` と `会計済み` は非統合
- `send success != paid`
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える
- 後方互換性不要
- TODO / shim / format-only change 禁止

## 既知事実
- latest worker report で actual correction-note spec paths は 2 本に確定している
  - `tests/reception/e2e-billing-correction-note.spec.ts`: PASS
  - `tests/charts/e2e-billing-correction-note.spec.ts`: FAIL
- latest charts failure report は `data-test-id="orca-billing-setting-note"` 不在と、`収納情報の確認前です` 周辺の text mismatch を指している
- `web-client/notes/billing-boundary-correction-scenarios.md` は correction と setting を 4 層 taxonomy の別 card / 別文言で扱う
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/05_screen_state_copy_spec.md` は correction note と setting note を separate slot とし、important info を disclosure に入れない、さらに correction note / setting note は常時 visible としている
- current review package の OrcaSummary 実装では correction / setting note cards が `<details>` の内側にある
- current charts spec は raw sessionStorage seed と helper seed が混在している
- Reception correction-note spec は pass 済みなので reopening しない

## repo touchpoints
- `tests/charts/e2e-billing-correction-note.spec.ts`
- `tests/reception/e2e-billing-correction-note.spec.ts`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/orcaBillingStatus.ts`
- `web-client/src/features/charts/orcaClaimSendCache.ts`
- `web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts`
- `web-client/notes/billing-boundary-correction-scenarios.md`
- `web-client/notes/ui-current-contract.md`
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/05_screen_state_copy_spec.md`

## subagent 利用
以下 2 本を `gpt 5.4 high` で起動する
1. `charts_note_visibility_probe`
2. `charts_correction_spec_scenario_probe`

## non-goal
- closed 3 blocker を reopen すること
- `send success != paid` を崩すこと
- correction note を workflow state に昇格すること
- correction note と setting note を同じ slot / same tone に混ぜること
- notes を disclosure / hidden detail に押し込んで pass させること
- Reception correction-note spec を drift させること

## 実装方針
1. billing boundary docs と implementation package docs を優先根拠として、correction note / setting note の visible contract を確認する
2. OrcaSummary で operational meta 用 details fold と must-visible note cards を分離する
   - operational meta は details に残してよい
   - correction note と setting note は must-visible area に出す
3. charts correction-note spec の scenario が current billing resolution で `unresolved` にならないなら、scenario data を修正して expected state を正しく作る
4. charts correction-note spec の raw sessionStorage seed は Task 10 の storage contract に合わせて整理する
5. reception 側 spec は regression guard として再実行するが、不要な変更はしない
6. current copy が docs と一致していれば copy はむやみに変えない。stale assertion だけを repo evidence に合わせる

## acceptance
- `tests/charts/e2e-billing-correction-note.spec.ts` が pass する
- `tests/reception/e2e-billing-correction-note.spec.ts` が pass を維持する
- correction note と setting note が separate slot / separate tone で見える
- correction note / setting note は must-visible area にあり、details 展開を前提にしない
- `send success != paid` が維持される
- current storage contract と charts spec seed が矛盾しない
- fixed premise drift がない

## run tests
- `cd web-client && npm run typecheck`
- touched unit/component tests
- `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-billing-correction-note.spec.ts`
- `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/reception/e2e-billing-correction-note.spec.ts`
- `cd web-client && npm run ci`
- `cd web-client && node scripts/runtime-ready-smoke.mjs` は chart open / auth bootstrap / route-state path を触った場合のみ再実行。carry forward する場合は report に明記する

## report format
- summary
- root_cause
- changed_files
- visible_contract_before_after
- spec_scenario_before_after
- tests_run
- runtime_ready_smoke_rerun_or_carry_forward
- residual_risks
