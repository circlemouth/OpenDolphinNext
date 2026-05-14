# Mock GUI Redesign Runtime Visual Gap Docset

RUN_ID: `20260514T020603Z`

## Purpose

`00_inventory_and_wave_plan.md` に基づく実装後 UI を、WebORCA Trial の公式患者候補を使って Codex ブラウザで確認した結果をまとめる。

この docset は、モック M01〜M18 の再現度、実操作可否、ORCA Trial 送信可否、追加実装が必要な箇所を判断するための作業証跡である。

## Verification Boundary

- Live runtime: `http://127.0.0.1:5173/` + `server-modernized-dev` + WebORCA Trial。
- Trial 候補探索、readonly preflight、受付登録、Charts 起動、ORCA medicalmodv2 wrapper を同一 RUN_ID で実行した。
- Screenshot は Trial 患者識別情報が画面に出るため、永続保存しなかった。画面確認は Codex ブラウザ上の DOM/表示マーカーと sanitized summary で記録した。
- raw ORCA body/XML/JSON、ORCA credential、HAR、trace、video、raw network は保存していない。

## Files

- `browser-scenarios.md`: Codex ブラウザで実施した導線。
- `mock-gap-matrix.md`: M01〜M18 の期待・確認結果・差分。
- `interaction-results.md`: 実操作の結果と UI blocker。
- `orca-trial-send-results.md`: ORCA Trial 受付/送信結果。
- `additional-implementation-plan.md`: 追加実装計画。
- `acceptance-recheck.md`: 受け入れチェック再採点。
- `evidence-manifest.md`: 参照した sanitized evidence。

## High-Level Result

- ORCA readiness は `UP`、受付登録は Trial 候補で成功した。
- 受付一覧から Charts は実ブラウザで開けた。
- M01〜M18 は runtime marker、controlled fixture、または Trial 制約分類で全行を閉じた。
- `20260514T060351Z` fullflow で Charts の通常導線 `診察終了して会計へ送信` が表示・有効化され、確認 modal から `/api/local/encounters/{encounterKey}/close-and-send-to-billing` へ到達した。
- close-and-send は HTTP `400` のため成功扱いせず、`trial-business-or-capability-blocker / trial_close_and_send_not_business_accepted:unknown` として分類した。
- Phase4 safe wrapper の未実行候補 live は実行されたが、全て `transportRejected` / `businessAccepted=false` であり、成功扱いしない。

## Follow-up Closure Policy

RUN_ID `20260514T040844Z` の解消作業では、ORCA Trial の仕様により live business accepted の会計送信が不可能な場合を release blocker から分離する。完了判定は次で行う。

- Charts の通常導線 `診察終了して会計へ送信` が患者ヘッダー内に表示される。
- fullflow harness は低レベル `ORCA 送信` dialog ではなく、通常導線の確認 modal から `/api/local/encounters/{encounterKey}/close-and-send-to-billing` を待つ。
- close-and-send の結果は `success` / `UNKNOWN` / `warning` / `business rejected` / `Trial capability blocker` として sanitized summary に分類する。
- Trial 制約または business reject は成功扱いしないが、UI 到達と安全分類が確認できれば `runtime-visual-gap-20260514` の未解消 blocker とはしない。
- 患者識別情報、raw ORCA body、ORCA credential、HAR、trace、video、screenshot、raw network dump は evidence に残さない。
