# OpenDolphin WebClient — canonical `npm run ci` recovery prompt

## ゴール
`cd web-client && npm run ci` を通す。
今回の report では 20 failures / 5 files が残っている。少なくとも 4 files は既知だが、5 つ目は actual CI 出力で確認する。
この task は、最近閉じた 3 blocker をやり直すのではなく、canonical command failure 群を repo 証拠にもとづいて cluster 化し、必要なコード修正で解消する task である。

## 使用可能情報
- repo 実体
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- この prompt と同梱 docset
- 外部サイト、一般論、過去の repo bundle / review package / recovery zip は禁止

## 固定前提
- 3 ペイン責務固定
- patient context 非永続
- `finish` と `send` の分離
- right rail chooser-only
- `送信済` と `会計済み` の非統合
- `send success != paid`
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える
- 後方互換性不要
- build artifacts / logs / screenshots / test-results / worktree artifacts は無視
- TODO / shim / format-only change 禁止

## 既知事実
- 以下はすでに PASS 済みで、巻き戻さない
  - tests/reception/e2e-rec-001-status-mvp.spec.ts
  - tests/charts/e2e-orca-billing-status.spec.ts
  - tests/e2e/charts-report-print.msw.spec.ts
- canonical `npm run ci` は FAIL
- 失敗群は 20 failures / 5 files
- 少なくとも次の file 群が failure に含まれる
  - src/features/charts/__tests__/chartsOrderDockCoexistence.recovery-order.test.tsx
  - src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx
  - src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx
  - src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx
- 5 つ目の file と全 failure inventory は actual `npm run ci` 出力で確認すること
- 既存 report では「今回タスクの targeted retest とは別系統の既存 failure」とされているが、repo 証拠なしに unrelated と断定してはいけない
- 直近の変更として `orcaMaster.ts`、Playwright harness 周辺、billing/status 周辺は触られている
- `e2e-billing-correction-note.spec.ts` は別 verification task として扱う。ここに混ぜない

## repo touchpoints
- web-client/src/features/charts/__tests__/chartsOrderDockCoexistence.recovery-order.test.tsx
- web-client/src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx
- web-client/src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx
- web-client/src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx
- 5 つ目の failing file は actual output で特定すること
- 上記 failure 群に関連する shared helpers / fixtures / chart ORCA support files
- web-client/src/features/charts/orcaMaster.ts
- path が動いていた場合は repo 証拠で mapping を報告し、推測で補わない

## subagent 利用
次の subagent を `gpt 5.4 high` で起動する
1. ci_failure_inventory_probe
2. charts_recovery_order_probe
3. charts_orca_support_probe
main agent は inventory を見て subagent 結果を統合し、shared root cause があるかを repo 証拠で判断して実装する

## non-goal
- report の 4 file 名だけを直して終えること
- failing test の assertion を弱めて通すだけの変更
- fixed premise を崩す変更
- send と paid の意味を混ぜる変更
- right rail の責務拡張
- patient context persistence の導入
- recent blocker fixes を巻き戻すこと
- correction-note verification task をここに混ぜること
- repo 証拠なしの route / state / schema / copy invent

## 実装方針
1. `cd web-client && npm run ci` を actual に再実行し、failure inventory を保存する
2. failure を file / suite / shared helper 単位で cluster 化する
3. inventory のうち shared fixture / shared helper が原因なら、そこでまとめて直す
4. 単独 suite 固有の失敗なら、その suite の contract と current implementation のずれを直す
5. 直す前に、failure が recent fixes の副作用か既存 failure かを repo 証拠で見極める
6. recent fixes の副作用である場合も、recent fixes 自体を巻き戻さずに両方を満たす解を探す
7. touched areas に応じて最小限の regression retest を追加する
8. `npm run ci` 全体を再実行し、green になるまで閉じない

## acceptance
- `cd web-client && npm run ci` が pass する
- recent targeted Playwright pass を壊していない
- fixed premise drift がない
- assertion weakening や temporary bypass でごまかしていない
- failure inventory と root-cause cluster が report に残る

## run tests
- `cd web-client && npm run ci`
- touched unit / component / integration suites の focused rerun
- touched area が recent blocker fixes と重なる場合は次も再実行
  - tests/reception/e2e-rec-001-status-mvp.spec.ts
  - tests/charts/e2e-orca-billing-status.spec.ts
  - tests/e2e/charts-report-print.msw.spec.ts
- `cd web-client && npm run typecheck`

## report format
- summary
- actual_failure_inventory
- clustered_root_causes
- changed_files
- why_not_a_spec_weakening
- regression_retests
- npm_run_ci_result
- fixed_premise_drift_check
- residual_risks
