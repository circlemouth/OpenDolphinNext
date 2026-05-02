# Automation Prompt

Name: `OpenDolphin 全業務画面QA反復`  
Kind: `heartbeat`  
Destination: `thread`  
Schedule: `FREQ=MINUTELY;INTERVAL=10`  
Status: `ACTIVE`

## Prompt

OpenDolphin_WebClient の全業務画面QA反復を継続する。

最初に `RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)` を採番し、`git status --short` を確認する。次に以下の docset を読む。

- `docs/implementation/clinical-fullscreen-qa-automation-20260502T073422Z/README.md`
- `docs/implementation/clinical-fullscreen-qa-automation-20260502T073422Z/CHECKLIST.md`
- `docs/implementation/clinical-fullscreen-qa-automation-20260502T073422Z/RUNBOOK.md`
- `docs/implementation/clinical-fullscreen-qa-automation-20260502T073422Z/ITERATION_LOG_TEMPLATE.md`

対象は debug 画面を除く現行業務 route 全体とする。

- login
- reception
- charts
- charts/order-sets
- charts print
- patients
- administration
- m/images 有効時

特に、カルテ受付、患者検索、SOAP、病名、処方 RP、複数 RP、オーダー項目の予測入力、代表的オーダー、会計送信、帳票、管理系を網羅する。

Codexブラウザを使って可視 UI と DOM を確認する。

Codexブラウザ接続は次の順で扱う。

- 各 iteration の最初に Browser attach probe を 1 回だけ実行し、成功した場合は `browser-attached`、失敗した場合は `browser-unavailable` として iteration log に記録する。
- Browser Use skill の guarded first browser cell を使い、`setupAtlasRuntime({ globals: globalThis, backend: "iab" })`、`agent.browser.nameSession(...)`、`agent.browser.tabs.selected()` の順に試す。
- 既存の `agent` / `tab` が生きている場合は再利用し、予防的な `js_reset` は行わない。
- 通常ユーザー turn に `# In app browser` 文脈が付いている場合、heartbeat より優先して Browser scenario を進める。この turn で接続できた DOM は、次回 heartbeat の focused/no-artifacts 検証と同じ QA iteration の証跡として扱う。
- heartbeat turn で `Browser turn does not belong to this IAB pipe` が出た場合は、その turn の IAB 操作権がないものとして `environment-blocker` に分類し、`js_reset` せず focused tests / no-artifacts e2e へ切り替える。通常ユーザー turn で同じエラーが出た場合だけ、`js_reset` を 1 回行い再接続を試す。
- `No Codex IAB backends were discovered` が出た場合は `environment-blocker` として記録し、同じ iteration では Browser 接続に固執せず focused tests / no-artifacts e2e へ切り替える。
- heartbeat turn では in-app browser backend が一時的に付かないことがある。通常ユーザー turn に `# In app browser` 文脈が付いている場合の成功結果を優先し、IAB 未検出を repo defect と混同しない。
- Chrome DevTools が `about:blank` だけを返す場合や Computer Use が Codex app を inspect できない場合、それを Codexブラウザ証跡として代用しない。
- Browser attach probe が成功したら、`await tab.url()`、`await tab.title()`、`await tab.playwright.domSnapshot()` で current tab の URL、title、DOM summary を確認する。既に目的 URL にいる場合は `goto` で reload しない。

失敗は次のいずれかに分類する。

- `environment-blocker`
- `test-data-blocker`
- `repo-defect`
- `security-blocker`
- `not-applicable`

`repo-defect` と `security-blocker` は原因を調査し、`web-client/` と `server-modernized/` に限定して修正し、必要なドキュメントを更新し、同じ scenario を再試行する。`client/` と `server/` は参照専用で変更しない。

同じ分類または同じ症状の失敗が連続する場合は、単に blocker として積み増さない。直近の iteration log と今回の失敗を比較し、再発条件、成功時との差分、再開条件を調査する。ブラウザ接続失敗に限らず、test-data、environment、repo defect、security blocker のいずれでも再発なら runbook / automation prompt / checklist の不足を疑う。運用手順や automation prompt の不足で再発している場合は、この docset と実 automation を更新する。repo defect / security blocker の再発なら、`web-client/` と `server-modernized/` に限定して根本原因を修正し、focused test と同一 scenario 再試行を行う。外部要因で直せない場合も、次回 heartbeat が同じ失敗を繰り返さないよう、再開条件、代替検証、打ち切り条件を明記する。報告には「再発調査」「修正した運用/コード」「次回は何を変えて試すか」を含める。

WebORCA Trialで確認可能なものは、local/MSW/no-artifacts の安全確認後に live preflight、acceptmodv2、可能なら medicalmodv2/fullflow へ進める。Trial のデータ不足や資格情報未投入は repo defect と混同しない。

raw 資格情報、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、患者氏名、住所、電話番号、保険詳細、HAR、trace、video、screenshot を tracked evidence へ保存しない。証跡は `artifacts/clinical-fullscreen-qa/<RUN_ID>/` に sanitized summary として残す。

各回の最後に日本語でこのスレッドへ報告する。

- RUN_ID
- 実施 scenario
- 結果
- 修正内容
- 検証コマンド
- 残ブロッカー
- 次回の最優先タスク

完了判定は、全対象 scenario が成功または外部要因として明確に分類され、以下が成功した状態とする。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```
