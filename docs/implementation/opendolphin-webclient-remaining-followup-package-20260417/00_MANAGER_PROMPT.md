# OpenDolphin WebClient 残タスク orchestrator prompt

## 役割
あなたは main Codex agent です。repo 実体を開いて実装します。今回の package では、残っている release blocker を 2 本の code-change task と、その後の release-gate handoff で閉じます。

## 使用可能情報
- repo 実体
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/`
- `artifacts/review-bundles/OpenDolphin_WebClient-review-package-curated-20260417T101132Z.zip`
- `docs/implementation/opendolphin-webclient-followup-release-gate-package-20260417/`
- この prompt と同梱 docset
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
- 後方互換性は考慮不要
- build artifacts / logs / screenshots / test-results / worktree artifacts は無視
- TODO / shim / format-only change 禁止

## 既知の閉鎖済み事項
- Reception transmission projection blocker: closed
- OrcaSummary mount contract blocker: closed
- print preview harness-first blocker: closed
- Task 31 print app-side escalation: closed without reopen
- older report にある `runtime-ready-smoke`, `npm run ci`, `server verify` の PASS claim は current truth として carry forward しない。必要なら rerun で再検証すること

## 今回の残タスク
1. Task 10: claim-send cache storage contract hardening
2. Task 20: charts correction-note / setting-note follow-up fix
3. Task 30: post-fix retest and release-gate handoff refresh

## 現時点の open blocker
- `tests/charts/e2e-billing-correction-note.spec.ts` が未解消
- `medicalWarnings` が sessionStorage に残っている実装ずれ
- manual QA 未実施
- ORCA live QA 未実施

## 実行順
1. Task 10 を先に行う
2. Task 10 の targeted/unit retest を通してから Task 20 に進む
3. Task 20 の targeted/e2e retest を通してから Task 30 に進む
4. manual QA / ORCA live QA はこの package の外だが、entry condition が満たされるよう handoff を整える

## subagent 運用
- 各 task 開始時に、その task docset に記載された subagent をすべて `gpt 5.4 high` で起動する
- main agent は調査結果の集約、実装、マージ順、競合解消、最終報告を担当する
- repo 証拠がない route / state / schema / copy は invent しない

## 禁止事項
- correction-note failure を closed 3 blocker に混ぜて説明しない
- `send success != paid` を崩す変更
- correction note / setting note を同じ slot に混ぜる変更
- patient context persistence や storage resume を戻す変更
- security spec と逆向きの永続化を増やす変更
- spec を緩めるだけの変更
- hidden detail / disclosure に重要情報を押し込む変更

## 最低限の再検証
- `cd web-client && npm run typecheck`
- Task 10/20 に関連する unit/component tests
- `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/charts/e2e-billing-correction-note.spec.ts`
- `PLAYWRIGHT_WEB_PORT=<repo convention> RUN_ID=<new> npx playwright test tests/reception/e2e-billing-correction-note.spec.ts`
- `cd web-client && npm run ci`
- `cd web-client && node scripts/runtime-ready-smoke.mjs` は、gate evidence に使うなら current run で再実行する。前回 PASS 証跡の carry forward は current truth とみなさない

## 最終報告フォーマット
- summary
- task_10_result
- task_20_result
- task_30_result
- tests_run
- carry_forward_or_rerun_of_runtime_ready_smoke
- fixed_premise_drift_check
- manual_QA_entry_status
- ORCA_live_QA_entry_status
- residual_risks
- final_release_judgement
