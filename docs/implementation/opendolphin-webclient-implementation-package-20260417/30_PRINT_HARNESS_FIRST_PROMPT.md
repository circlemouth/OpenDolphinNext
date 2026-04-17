タイトル:
OpenDolphin WebClient — Print preview harness-first isolation / fix

ゴール:
tests/e2e/charts-report-print.msw.spec.ts line 24 の fail/hang について、
現時点の主分類 `harness issue` / confidence `medium` を repo 証拠で検証し、
主因が harness drift なら harness/spec を修正する。
最優先の契約は次の 2 本立てである。
- route-state あり => preview shell
- route-state なし / unknown => fail-close missing-state shell

この task は harness-first であり、app 側を広く直す task ではない。
route-state 明示ありでも preview shell / missing shell のどちらにも deterministic に収束しない証拠が出た場合のみ、この task を停止して Task 31 へ escalate する。

使用可能情報:
- repo 実体
- docs/web-client/ux/dads_app_ui_design_rules_20260411.md
- この prompt
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

既知事実:
- failing/uncertain spec: tests/e2e/charts-report-print.msw.spec.ts line 24
- worker classification: harness issue
- worker confidence: medium
- worker reasoning:
  - route-state only / patient context 非永続 / no storage resume により、旧 persistence 前提の E2E は drift し得る
  - missing-state fail-close なので、required state 不足時に preview が出ないこと自体は app 契約違反ではない
  - 現時点では route-state 契約変更後の test harness drift が最有力
- worker が示した harness isolation 手順:
  1. line 24 前後で print preview 到達が route-state 明示受け渡しか、直開き/暗黙復元/旧 persistence 前提かを確認する
  2. 期待結果を `route-state あり => preview shell`, `route-state なし / unknown => missing-state shell` に二分する
  3. line 24 の待ち条件が preview 側しか見ていないか確認する
  4. route-state 明示あり/なしの 2 経路で見比べる
  5. どちらの shell にも収束しない場合だけ app 側へ昇格する
- app 無罪ではない
- Reception fail と OrcaSummary fail は別 blocker として混ぜない

repo touchpoints:
- tests/e2e/charts-report-print.msw.spec.ts
- web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx
- web-client/src/features/charts/print/documentPrintPreviewStorage.ts
- path が動いていた場合は repo 証拠で mapping を報告し、推測で補わない

subagent 利用:
以下 2 本を gpt 5.4 high で起動する
1. print_spec_route_state_probe
2. print_page_settle_probe
main agent は subagent 結果を比較し、repo 証拠で最終判断して実装する

non-goal:
- 先に app 側の大きな修正へ入ること
- route-state only を破って persistence / storage resume を再導入すること
- timeout 延長や wait 追加だけで hang を隠すこと
- repo 証拠なしの route payload / state schema / copy invent
- print preview 重要情報を hidden disclosure に逃がすこと
- unrelated charts/report UI の広範囲リファクタ

実装方針:
1. spec line 24 前後を確認し、route-state 明示受け渡しの有無を特定する
2. spec が直開き / 暗黙復元 / 旧 persistence 前提に依存しているなら harness issue として修正する
3. spec expectation を契約どおり二分する
   - route-state あり => preview shell
   - route-state なし / unknown => fail-close missing-state shell
4. preview だけを待つ hang になっている場合は、待ち条件と assertion を契約に合わせて修正する
5. app shell が既に存在していて locator だけ不足している場合に限り、minimal app-side locator/testid 追加は許可する
6. route-state 明示ありの経路でも preview shell / missing-state shell のどちらにも deterministic に収束しない場合は、
   - この task を mixed/app evidence ありとして停止
   - Task 31 へ escalate
   - app 振る舞い修正に広げない
7. storage resume の復活、patient context persistence の導入は禁止

acceptance:
- repo 証拠にもとづく classification を report できる
- harness issue の場合:
  - spec が route-state 契約に沿う
  - tests/e2e/charts-report-print.msw.spec.ts が hang せず pass する
  - preview shell と missing-state shell のどちらを見るべきかが明確になる
- mixed/app evidence の場合:
  - その証拠が report され、Task 31 に進む条件が満たされたことを示せる
  - ごまかしの wait/timeout 変更だけで閉じていない
- storage resume/persistence を再導入していない
- fixed premise drift を起こしていない

run tests:
- repo の既存 Playwright 実行手段で tests/e2e/charts-report-print.msw.spec.ts を再実行
- touched print/charts unit or component tests があれば再実行
- cd web-client && npm run typecheck
- canonical commands はこの task の完了報告とは別。未実行なら release-ready と主張しない

report format:
- summary
- classification_with_repo_evidence
- line24_contract_findings
- changed_files
- harness_fix_strategy_or_escalation_reason
- locator_strategy_if_any
- tests_run
- residual_risks
- if_path_moved_mapping
