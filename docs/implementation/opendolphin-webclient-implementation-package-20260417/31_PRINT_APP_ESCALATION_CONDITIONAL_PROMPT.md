タイトル:
OpenDolphin WebClient — Conditional print preview app-side fix

使用条件:
この prompt は Task 30 の report が次を示した場合にのみ使う。
- explicit route-state path が存在する
- それでも preview shell / missing-state shell のどちらにも deterministic に収束しない
- つまり mixed issue または app issue の repo 証拠が立った

ゴール:
print preview を route-state only / fail-close の固定前提に沿って deterministic にする。
route-state が十分なら preview shell を出し、
不足なら missing-state shell を fail-close で出す。
storage resume を戻さず、patient context 非永続を維持し、mount side effect による non-settle/hang を除去する。

使用可能情報:
- repo 実体
- docs/web-client/ux/dads_app_ui_design_rules_20260411.md
- この prompt
- Task 30 の report
- 外部サイト、一般論、過去の bundle / review zip は禁止

固定前提:
- print preview は route-state only
- patient context 非永続
- missing-state は fail-close
- storage resume は戻さない
- 3 ペイン責務固定
- right rail chooser-only
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える
- 後方互換性不要
- TODO / shim / format-only change 禁止
- build artifacts 無視

repo touchpoints:
- web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx
- web-client/src/features/charts/print/documentPrintPreviewStorage.ts
- tests/e2e/charts-report-print.msw.spec.ts
- path が動いていた場合は repo 証拠で mapping を報告し、推測で補わない

subagent 利用:
以下 2 本を gpt 5.4 high で起動する
1. print_route_state_failclose_probe
2. print_mount_sideeffect_probe
main agent は subagent 結果を比較し、repo 証拠で最終判断して実装する

non-goal:
- Task 30 を飛ばして先にこの prompt に入ること
- route-state only を破って persistence / storage resume を戻すこと
- timeout 増加だけで hang を隠すこと
- repo 証拠なしの route payload / state schema / copy invent
- unrelated charts/report UI の広範囲リファクタ
- hidden disclosure に preview 重要情報を逃がすこと

実装方針:
1. print preview 初期 mount で参照している route-state を特定する
2. route-state が十分な場合は preview shell を deterministic に mount する
3. route-state が不足している場合は missing-state shell を deterministic に mount する
4. storage file が存在していても resume/persistence を復活させない
5. mount side effect による hang や non-settle がある場合は、その side effect を guard するか順序を是正する
6. preview shell と missing-state shell の両方に stable locator / testid を付ける
7. fallback copy は repo 既存パターンを優先する
8. Task 30 の harness fix と矛盾しないように合わせる

acceptance:
- tests/e2e/charts-report-print.msw.spec.ts が pass する、または少なくとも hang が除去され deterministic pass/fail に変わる
- preview shell と missing-state shell の render が deterministic
- missing-state は fail-close
- storage resume / persistence を再導入していない
- stable locator / testid が preview shell / missing-state shell に付与されている
- patient context 非永続、right rail chooser-only、3 ペイン責務固定を崩していない
- TODO / shim / timeout-bump only のごまかしを残していない

run tests:
- repo の既存 Playwright 実行手段で tests/e2e/charts-report-print.msw.spec.ts を再実行
- touched charts/print component or unit tests があれば再実行
- cd web-client && npm run typecheck
- canonical commands はこの task の完了報告とは別。未実行なら release-ready と主張しない

report format:
- summary
- task30_trigger_evidence
- root_cause
- changed_files
- route_state_contract_before_after
- deterministic_shell_strategy
- locator_strategy
- tests_run
- residual_risks
- if_path_moved_mapping
