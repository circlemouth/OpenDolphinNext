タイトル:
OpenDolphin WebClient 残ブロッカー解消 orchestrator prompt

あなたの役割:
あなたは main Codex agent です。repo 実体を開いて実装を行います。あなたの仕事は、下記 3〜4 タスクを worker 裁定どおりの順序で進め、各タスクごとに subagent を起動し、調査結果のマージ、実装、競合解消、retest、報告を行うことです。

使用可能情報:
- repo 実体
- docs/web-client/ux/dads_app_ui_design_rules_20260411.md
- この prompt
- 過去の repo bundle / review package / recovery zip は使わない
- 外部サイト、一般論、記憶補完は禁止

モデル指定:
- subagent は全て gpt 5.4 high
- main agent は subagent の順序、差分統合、最終報告を担当する

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
- 後方互換性は考慮不要
- build artifacts / logs / screenshots / test-results / worktree artifacts は無視
- TODO / shim / format-only change 禁止

現時点の裁定:
- Reception fail は spec drift ではなく projection bug 優先
- OrcaSummary fail は locator typo ではなく mount contract gap 優先
- Print preview は harness issue が主分類、confidence は medium
- history split は後回し可
- 現時点の release judgement は NO-GO

実行順:
1. Task 10: Reception transmission projection fix
2. Task 20: OrcaSummary mount contract fix
3. Task 30: Print preview harness-first isolation / fix
4. Task 30 で route-state 明示ありでも preview shell / missing shell のどちらにも deterministic に収束しない証拠が出た場合のみ Task 31
5. その後に canonical commands
6. manual QA / ORCA live QA はこの prompt の外だが、条件未達なら GO を主張しない

必須タスク運用:
- 各 task 開始時に、その task docset に記載された subagent を起動する
- subagent の返答を main agent が比較し、矛盾点は repo 証拠で解決する
- task ごとに targeted retest を実施し、pass しなければ次 task へ進まない
- print は harness-first。app 側に広げるのは Task 31 条件を満たした場合のみ
- spec を緩めて通す、意味を崩して通す、hidden detail に逃がす、persistence を戻す、right rail の責務を増やす、send と paid を混ぜる提案は禁止

targeted retest order:
1. tests/reception/e2e-rec-001-status-mvp.spec.ts
2. tests/charts/e2e-orca-billing-status.spec.ts
3. tests/e2e/charts-report-print.msw.spec.ts

canonical command order:
1. cd web-client && node scripts/runtime-ready-smoke.mjs
2. cd web-client && npm run ci
3. mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify

出力義務:
最終報告は次の順で出す
- summary
- task_10_result
- task_20_result
- task_30_result
- task_31_result_if_any
- targeted_retests
- canonical_commands
- fixed_premise_drift_check
- residual_risks
- stop_ship_status

想定提出物:
この prompt 群と docset 群は zip 化して repo に配置される前提で扱うこと。main agent は実装だけでなく、各 task report をそのまま package に戻せる粒度で書くこと。
