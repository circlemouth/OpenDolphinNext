# browser-manual-qa-report

## summary
- RUN_ID: `20260417T143935Z`
- 判定: repo-local で確認可能な browser verification は `PASS`。manual QA entry は repo-local 観点では close 可能。
- ただし live ORCA / 運用環境 / 実プリンタ依存の確認は対象外のため `BLOCKED` として残す。
- 既存 spec のうち `tests/e2e/charts-1280-compression.spec.ts` と `tests/e2e/charts-missing-context-recovery.spec.ts` は旧 login 前提 drift で失敗したが、同 UI contract は現行 repo-local browser 実測で再確認済み。

## app_startup_path
- startup command: `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
- app URL: `https://localhost:5173/`
- repo-local auth basis: `setup-modernized-env.sh` 既定の smoke login と [web-client/scripts/qa-lib/session-auth.mjs](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/scripts/qa-lib/session-auth.mjs)
- reused evidence/tests:
  - [tests/reception/e2e-rec-001-status-mvp.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/reception/e2e-rec-001-status-mvp.spec.ts)
  - [tests/reception/e2e-billing-correction-note.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/reception/e2e-billing-correction-note.spec.ts)
  - [tests/charts/e2e-orca-billing-status.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/charts/e2e-orca-billing-status.spec.ts)
  - [tests/charts/e2e-billing-correction-note.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/charts/e2e-billing-correction-note.spec.ts)
  - [tests/e2e/charts-report-print.msw.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/e2e/charts-report-print.msw.spec.ts)
  - [web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts)
  - [web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx)

## scenario_results
| scenario | url | width | result | observed text |
| --- | --- | ---: | --- | --- |
| A Reception 送信状態 | `https://localhost:5173/f/1.3.6.1.4.1.9414.72.103/reception?date=2026-04-17&msw=1` | 1280 | PASS | `会計待ち`, `送信: 送信済`, `会計済み tab には同患者なし`, `カード表示でも 送信: 送信済` |
| A Reception 送信状態 | same | 1024 | PASS | `会計待ち`, `送信: 送信済`, `会計済み tab には同患者なし`, `カード表示でも 送信: 送信済` |
| A Reception 送信状態 | same | 768 | PASS | `会計待ち`, `送信: 送信済`, `会計済み tab には同患者なし`, `カード表示でも 送信: 送信済` |
| B Charts correction/setting note | `https://localhost:5173/f/1.3.6.1.4.1.9414.72.103/charts?sort=time&date=2026-04-17` | 1280 | PASS | `Correction / 補正メモ`, `補正が必要です。補正候補があります。`, `Setting / 確認条件メモ`, `収納情報の確認前です。送信済みですが、会計確定は未判定です。` |
| B Charts correction/setting note | same | 1024 | PASS | `Correction / 補正メモ`, `補正が必要です。補正候補があります。`, `Setting / 確認条件メモ`, `収納情報の確認前です。送信済みですが、会計確定は未判定です。` |
| B Charts correction/setting note | same | 768 | PASS | `Correction / 補正メモ`, `補正が必要です。補正候補があります。`, `Setting / 確認条件メモ`, `収納情報の確認前です。送信済みですが、会計確定は未判定です。`, `primary count = 1` |
| C billing semantics | same | 1280 | PASS | `before refresh: transmission: 送信済`, `before refresh: confirmation: 会計待ち+送信済`, `収納情報を確認`, `after refresh: confirmation: 会計済み` |
| D reload fail-close | `https://localhost:5173/f/1.3.6.1.4.1.9414.72.103/charts?runId=20260417T143935Z&sort=time&date=2026-04-17` | 1280 | PASS | `before reload: confirmation: 会計待ち+送信済`, `after reload: 患者未選択`, `状態 再選択が必要`, `受付へ戻る`, `send disabled` |
| D new tab fail-close | `https://localhost:5173/f/1.3.6.1.4.1.9414.72.103/charts?sort=time&date=2026-04-17&msw=1` | 1280 | PASS | `患者未選択`, `状態 再選択が必要`, `受付へ戻る`, `send disabled`, `会計済み positive restore なし` |
| F print preview route-state | `https://localhost:5173/f/FAC-PRINT/charts/print/document?msw=1` | 1280 | PASS | `処方箋 PDFプレビュー`, `Data_Id=DATA-PRINT-1`, `PDFを開く`, `printPreview storage key なし` |
| F print preview missing-state | same | 1280 | PASS | `文書プレビューの状態が見つかりません。`, `状態が無いため出力できません。`, `Chartsへ戻る`, `printPreview storage key なし` |

補足:
- A は table / card の両表示を確認した。
- B は details を開く前に note が visible で、開いた後も `confirmation: 会計待ち+送信済` と `transmission: 送信済` が別 sematics として読めた。
- E width compression は A/B の 1280 / 1024 / 768 実測に含めて確認した。

## failures_with_evidence
- なし
- failure screenshots directory: [qa/browser-manual-qa-failures/20260417T143935Z](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/qa/browser-manual-qa-failures/20260417T143935Z)

## blocked_items
- live ORCA 実接続での `official confirmation / incomeinfv2` 実データ整合性確認
- 運用認証情報や運用環境が必要な role / facility 差分の実機確認
- OS print dialog / 実プリンタ出力 / PDF viewer 実運用相性

## human_only_checks_remaining
- live ORCA 応答の臨床運用上の妥当性確認
- 日本語 copy / tone の最終可読性判断
- 実運用端末での narrow width 実地確認

## fixed_premise_drift_check
- `3 ペイン責務固定`: PASS
  - Charts で left=`病名・過去カルテ`, center=`PRIMARY WORKSPACE`, right=`chooser-only rail` を確認。
- `patient context 非永続`: PASS
  - reload / new tab 後に `患者未選択` + `再選択が必要` に fail-close。patient-bound detail の unsafe restore は未観測。
- `finish と send の分離`: PASS
  - send success 単独では `会計済み` にならず、incomeinfv2 取得後にのみ `会計済み` へ遷移。
- `right rail chooser-only`: PASS
  - 768 幅でも right rail は `処方 / 注射 / 処置 / 検査 / 算定` chooser-only。generic document nav 化は未観測。
- `送信済 と 会計済み の非統合`: PASS
  - Reception は `会計待ち` のまま `送信: 送信済`。`会計済み` tab へは投影されなかった。
- `send success != paid`: PASS
  - `before refresh: 会計待ち+送信済`、`after refresh: 会計済み` を確認。
- `generic bottom navigation の新規導入禁止`: PASS
  - 1280 / 1024 / 768 で generic bottom navigation は未観測。
- `重要情報を disclosure に隠さない`: PASS
  - correction note / setting note は details 展開前から visible。
- `1 画面 1 primary`: PASS
  - 768 幅で `.charts-actions__button--primary-route` visible count は `1`。
- `unknown は gate として残し、fail-close fallback を添える`: PASS
  - no-context / reload 後に `再選択が必要`、`受付へ戻る`、`send disabled` を確認。
- `spec/harness premise drift`: FOUND
  - [tests/e2e/charts-1280-compression.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/e2e/charts-1280-compression.spec.ts) と [tests/e2e/charts-missing-context-recovery.spec.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/tests/e2e/charts-missing-context-recovery.spec.ts) は旧 login 前提のままで失敗した。current repo-local browser 実測では該当 UI contract 自体は通過しており、ここは app defect ではなく test harness drift。

## recommended_next_step
- repo-local browser verification は通過しているため、human manual QA へ進めてよい。
- 進行前に、上記 2 本の既存 spec の login 前提 drift だけは別タスクで整備しておくと、次回の repo-local gate が安定する。
