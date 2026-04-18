# manual QA checklist

> Historical note: this checklist is a 2026-04-17 entry-condition template. `PASS` entries below describe required entry conditions, not current evidence. Use `docs/implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` for current static status; manual QA was not run by that static remediation.

## entry conditions
- correction-note spec verification 完了
- runtime-ready-smoke PASS
- `cd web-client && npm run ci` PASS
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` PASS
- fixed premise drift なし

## 重点確認範囲
### 1. Reception
- 送信状態が row で常時見える
- table / collapsed card の両 variant がある場合、表示契約が一致する
- `送信済` と `会計済み` が混ざっていない
- hidden detail / disclosure を開かないと重要情報が見えない状態になっていない

### 2. Charts / OrcaSummary
- minimal charts context で summary shell が mount する
- ORCA context 不足時、hidden ではなく fallback shell で説明される
- `send success != paid` が崩れていない
- `会計済み` 推論が単一 invoice のみ fail-close で動くことを、観察可能な範囲で確認する

### 3. Print preview
- route-state ありで preview shell が成立する
- route-state なし / unknown で missing-state shell に fail-close する
- patient context 非永続が崩れていない
- popup 依存ではなく、preview の visible contract が安定している

### 4. 共通 fixed premise
- 3 ペイン責務固定
- patient context 非永続
- `finish` と `send` の分離
- right rail chooser-only
- generic bottom navigation の新規導入なし
- 重要情報を disclosure に隠していない
- 1 画面 1 primary を崩していない

## 記録フォーマット
- area
- scenario
- expected
- actual
- pass_fail
- blocker_if_fail
