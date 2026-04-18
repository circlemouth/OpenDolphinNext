# OpenDolphin WebClient 追加作業 orchestrator prompt

> Historical note: this 2026-04-17 prompt is not current release truth. `PASS` / `完了済み` / `already closed` language below reflects the worker-report-based planning state at package creation time. Current truth is `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` plus current `docs/contracts/` and `docs/runbooks/`.

## 役割
あなたは main Codex agent です。repo 実体を開いて、今回の追加作業を release gate の観点で閉じてください。
今回の追加作業は、すでに解消済みの 3 blocker をやり直すことではありません。残っている release gate 項目を、必要なら最小限のコード修正で閉じることが目的です。

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
- 後方互換性は考慮不要
- build artifacts / logs / screenshots / test-results / worktree artifacts は無視
- TODO / shim / format-only change 禁止

## 既知の完了済み事項
- Reception transmission projection fix: PASS
- OrcaSummary mount contract fix: PASS
- Print preview harness-first isolation / fix: PASS
- Task 31 は未実施かつ不要。Task 30 の証拠では app-side 拡張条件を満たさない
- 3 件の targeted Playwright retest はすべて PASS

## 既知の未完了事項
1. `cd web-client && node scripts/runtime-ready-smoke.mjs`
   - FAIL
   - 理由: `127.0.0.1:9080` への接続で `ECONNREFUSED`
   - 現時点では実装不備ではなく backend 前提未充足という報告
2. `cd web-client && npm run ci`
   - FAIL
   - 20 failures / 5 files
   - 少なくとも次の file 群が失敗報告に含まれる
     - `src/features/charts/__tests__/chartsOrderDockCoexistence.recovery-order.test.tsx`
     - `src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx`
     - `src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx`
     - `src/features/charts/__tests__/prescriptionOrderOrcaSupport.test.tsx`
   - 5 つ目の file は actual `npm run ci` 出力で確認すること。invent しないこと
3. `e2e-billing-correction-note.spec.ts` は touched されたが targeted retest 対象外
4. manual QA 未実施
5. ORCA live QA 未実施
6. 現時点の release judgement は `NO-GO`

## 実行順
1. `e2e-billing-correction-note.spec.ts` の actual path を repo で特定し、単体再実行して契約確認する
2. runtime-ready-smoke の backend 前提を repo 証拠で確認し、前提を満たして再実行する
   - backend 未起動が原因ならコードをいじらず precondition closure として記録する
   - backend 起動後も失敗するなら code/integration blocker に昇格して報告する
3. `cd web-client && npm run ci` を actual 出力ごと再取得し、failure inventory を確定する
4. CI failure 群を cluster 化し、必要なコード修正を行う
5. `npm run ci` 再実行
6. runtime-ready-smoke / npm run ci / server verify の canonical commands を順に閉じる
7. manual QA handoff doc を使って manual QA へ渡す
8. ORCA live QA handoff doc を使って ORCA live QA へ渡す

## task gating
- 既に PASS の 3 blocker を巻き戻さない
- Task 31 を reopen しない
- `e2e-billing-correction-note.spec.ts` が fail した場合は、その failure を settings-note / reception contract 側の follow-up blocker として切り出す
- runtime-ready-smoke は、backend 前提未充足のまま script bug と断定しない
- `npm run ci` の failure は、report の 4 file 名だけで決め打ちせず actual inventory を先に確定する
- canonical commands が全部閉じるまで release-ready を主張しない

## subagent 運用
- subagent はすべて `gpt 5.4 high`
- まず `10_WEBCLIENT_CI_RECOVERY_DOCSET.yaml` の subagent を起動する
- runtime-ready-smoke は runbook に従い、repo 証拠が必要な場合だけ main agent が調べる
- manual QA / ORCA live QA は human handoff 前提で、checklist の整合を main agent が確認する

## report format
- summary
- correction_note_verification
- runtime_ready_smoke_status
- npm_run_ci_inventory
- changed_files_if_any
- canonical_commands
- manual_QA_handoff_status
- ORCA_live_QA_handoff_status
- fixed_premise_drift_check
- residual_risks
- final_release_judgement
