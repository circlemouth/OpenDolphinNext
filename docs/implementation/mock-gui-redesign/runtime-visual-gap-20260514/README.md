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
- M01〜M18 の主要 UI 要素は多く表示できたが、実データ Charts では会計送信 CTA / fullflow handoff / 一部 modal 状態に不足が残る。
- fullflow は `target_mutation_request_missing_or_duplicate` / 二重受付防止で停止し、UI 経由の全オーダー会計送信は未達。
- Phase4 safe wrapper の未実行候補 live は実行されたが、全て `transportRejected` / `businessAccepted=false` であり、成功扱いしない。
