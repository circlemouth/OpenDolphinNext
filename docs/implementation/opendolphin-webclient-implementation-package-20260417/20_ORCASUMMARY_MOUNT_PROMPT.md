タイトル:
OpenDolphin WebClient — Billing / Charts OrcaSummary mount contract fix

ゴール:
tests/charts/e2e-orca-billing-status.spec.ts の line 203 で露出している `orca-summary` 不一致を、存在欠如ではなく mount contract / handoff contract の欠損として修正する。
`canSendClaim` と billing summary visibility を分離し、minimal charts context がある限り summary shell は mount させる。
ORCA context が不足している場合は hidden にせず fallback shell + disabled reason を出す。
repo 実体に強い反証がない限り、locator typo だけの問題へ縮退させてはいけない。

使用可能情報:
- repo 実体
- docs/web-client/ux/dads_app_ui_design_rules_20260411.md
- この prompt
- 外部サイト、一般論、過去の bundle / review zip は禁止

固定前提:
- 3 ペイン責務固定
- patient context 非永続
- finish と send の分離
- right rail chooser-only
- 送信済 と 会計済み の非統合
- send success != paid
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える
- 後方互換性不要
- TODO / shim / format-only change 禁止
- build artifacts 無視

既知事実:
- 既に main へ統合済み: PR-01 Reception, PR-02 Charts main, PR-03 Right rail, PR-04 Disease, PR-07 Admin/setting, Playwright worktree ignore fix, PR-05 + PR-06a + PR-06b local batch merge, document-reuse E2E drift fix
- web-client targeted vitest: 110 passed / 1 skipped
- server-modernized targeted tests: 37 passed
- cd web-client && npm run typecheck は pass 済み
- failing spec: tests/charts/e2e-orca-billing-status.spec.ts line 203
- Billing summary 本体自体は存在する
  - 例: web-client/src/features/charts/OrcaSummary.tsx line 635 付近
- 暫定裁定: mount contract gap 扱いを優先
- 期待する修正方向:
  - canSendClaim と canShowBillingSummary を分離する
  - minimal charts context がある限り summary shell は mount する
  - ORCA context 不足時は hidden ではなく fallback shell + disabled reason
  - stable locator は shell 側に置く
- Billing core が主担当だが、charts main contract との境界確認は必要

repo touchpoints:
- web-client/src/features/charts/OrcaSummary.tsx
- web-client/src/features/charts/pages/ChartsPage.tsx
- 必要なら:
  - web-client/src/features/charts/ChartsActionBar.tsx
  - web-client/src/features/charts/ChartsPatientSummaryBar.tsx
- tests/charts/e2e-orca-billing-status.spec.ts
- path が動いていた場合は repo 証拠で mapping を報告し、推測で補わない

subagent 利用:
以下 2 本を gpt 5.4 high で起動する
1. orca_summary_mount_handoff_probe
2. orca_summary_shell_locator_probe
main agent は subagent 結果を比較し、repo 証拠で最終判断して実装する

non-goal:
- failing spec を locator 調整だけで通す変更
- OrcaSummary を hidden のままにする変更
- patient context persistence / resume で足りない context を補う変更
- send success と paid の意味統合
- right rail の責務拡張
- charts 全体の広範囲レイアウト再設計
- repo 証拠なしの route / state / schema / copy invent

実装方針:
1. ChartsPage から OrcaSummary までの mount decision と props handoff を追跡する
2. summary visibility が send eligibility と束ねられているなら分離する
3. symbol 名が review memo と異なる場合は、actual decision points を修正し report で実名を示す
4. minimal charts context がある限り summary shell は mount する
5. ORCA context 不足時でも hidden にせず、fallback shell + disabled reason を出す
6. stable locator / testid は shell 側に付与する
7. fallback copy は repo 既存の unavailable/disabled pattern があればそれに合わせる
8. ChartsActionBar / ChartsPatientSummaryBar の境界調整が必要なら最小限で行う
9. touched unit/component tests があれば最小限で追加または更新する
10. shell が出ることと send 可能であることは分離するが、send success != paid は必ず維持する

acceptance:
- tests/charts/e2e-orca-billing-status.spec.ts の該当 fail が pass する
- minimal charts context があるケースで OrcaSummary shell が mount する
- ORCA context 不足時に hidden ではなく fallback shell が出る
- stable locator / testid が shell 側に付与される
- send と paid の意味が混ざっていない
- right rail chooser-only、patient context 非永続、3 ペイン責務固定が維持される
- TODO / shim / temporary bypass を残していない

run tests:
- repo の既存 Playwright 実行手段で tests/charts/e2e-orca-billing-status.spec.ts を再実行
- touched charts/billing component/unit tests があれば再実行
- cd web-client && npm run typecheck
- canonical commands はこの task の完了報告とは別。未実行なら release-ready と主張しない

report format:
- summary
- root_cause
- changed_files
- mount_contract_before_after
- fallback_shell_strategy
- locator_strategy
- tests_run
- residual_risks
- if_path_moved_mapping
