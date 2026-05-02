# Clinical Full-Screen QA Runbook

RUN_ID root: `20260502T073422Z`

## 1. Start

1. 新しい実行ごとに `RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)` を採番する。
2. `git status --short` を確認し、既存のユーザー変更を把握する。
3. `docs/implementation/clinical-fullscreen-qa-automation-20260502T073422Z/` の全ファイルを読む。
4. 証跡 root を `artifacts/clinical-fullscreen-qa/<RUN_ID>/` とする。

## 2. Environment

標準起動:

```bash
WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
```

ORCA Trial 資格情報は次のいずれかから読み込む。

- `ORCA_ENV_FILE`
- `./orca.env.local`
- `~/.config/opendolphin/orca.env`

raw 値はログ、summary、doc、tracked evidence に書かない。

## 3. Browser Debugging

Codex ブラウザを使い、可視 UI と DOM の両方で確認する。

- 各 iteration の最初に Browser attach probe を 1 回だけ実行する。probe は Browser Use skill の guarded first browser cell と同じ形にし、成功した場合は `browser-attached`、失敗した場合は `browser-unavailable` として iteration log に記録する。
- Browser Use は in-app browser 文脈が付いた通常ユーザー turn で最も安定する。heartbeat turn では IAB backend が一時的に未検出になることがあるため、repo defect と混同しない。
- 最初の browser action は Browser Use skill の guarded first browser cell で行う。`setupAtlasRuntime({ globals: globalThis, backend: "iab" })`、`agent.browser.nameSession(...)`、`agent.browser.tabs.selected()` の順に試す。
- `tab` / `agent` が生きている場合は再利用し、予防的な `js_reset` は行わない。
- 通常ユーザー turn に `# In app browser` 文脈が付いている場合、heartbeat より優先して Browser scenario を進める。この turn で接続できた DOM は、次回 heartbeat の focused/no-artifacts 検証と同じ QA iteration の証跡として扱う。
- heartbeat turn で `Browser turn does not belong to this IAB pipe` が出た場合は、その turn の IAB 操作権がないものとして `environment-blocker` に分類し、`js_reset` せず focused tests / no-artifacts e2e へ切り替える。通常ユーザー turn で同じエラーが出た場合だけ、`js_reset` を 1 回行い再接続を試す。
- `No Codex IAB backends were discovered` が出た場合は `environment-blocker` として記録し、同じ iteration では Browser 接続に固執せず focused tests / no-artifacts e2e へ切り替える。
- Chrome DevTools が `about:blank` だけを返す場合や Computer Use が Codex app を inspect できない場合、それを Codex ブラウザ証跡として代用しない。
- 画面表示確認は screenshot ではなく DOM snapshot と画面上の状態説明を基本にする。
- screenshot、HAR、trace、video、raw network dump は tracked evidence にしない。
- 失敗時は、表示上の症状、console/page error の sanitized summary、request path と status class だけを残す。

Browser attach probe の最小形:

```js
if (!globalThis.agent) {
  const { setupAtlasRuntime } = await import('/Users/Hayato/.codex/plugins/cache/openai-bundled/browser-use/0.1.0-alpha1/scripts/browser-client.mjs');
  const backend = 'iab';
  await setupAtlasRuntime({ globals: globalThis, backend });
}
await agent.browser.nameSession('🔎 OpenDolphin QA');
if (typeof tab === 'undefined' || !globalThis.tab) {
  globalThis.tab = await agent.browser.tabs.selected();
  if (!globalThis.tab) globalThis.tab = await agent.browser.tabs.new();
}
```

成功時は `await tab.url()`、`await tab.title()`、`await tab.playwright.domSnapshot()` で current tab の URL、title、DOM summary を確認する。既に目的 URL にいる場合は `goto` で reload しない。

## 4. Iteration Order

各30分 iteration は次の順で進める。

1. 前回の `ITERATION_LOG` と checklist の未完了を確認する。
2. 最優先 scenario を1つから数個選び、Codexブラウザで再現する。
3. 失敗を分類する。
4. `repo-defect` / `security-blocker` は原因を調査し、最小修正する。
5. focused test を実行する。
6. 同じブラウザ scenario を再試行する。
7. checklist と iteration log を更新する。
8. スレッドに日本語で進捗を報告する。

### Repeated Failure Handling

同じ分類または同じ症状の失敗が連続する場合は、単に blocker として積み増さない。

- 直近の iteration log と今回の失敗を比較し、再発条件、成功時との差分、再開条件を調査する。
- ブラウザ接続失敗に限らず、test-data、environment、repo defect、security blocker のいずれでも再発なら runbook / automation prompt / checklist の不足を疑う。
- 運用手順や automation prompt の不足で再発している場合は、この docset と実 automation を更新する。
- repo defect / security blocker の再発なら、`web-client/` と `server-modernized/` に限定して根本原因を修正し、focused test と同一 scenario 再試行を行う。
- 外部要因で直せない場合も、次回 heartbeat が同じ失敗を繰り返さないよう、再開条件、代替検証、打ち切り条件を明記する。
- 報告には「再発調査」「修正した運用/コード」「次回は何を変えて試すか」を含める。

## 5. Failure Classification

| Classification | Definition | Action |
| --- | --- | --- |
| `repo-defect` | repo の実装、契約、テスト、設定サンプルに原因がある | 修正し、focused test とブラウザ再試行 |
| `security-blocker` | 情報漏えい、認可不備、SSRF、XSS、session 残存等 | 根本修正、docs 更新、異常系再検証 |
| `test-data-blocker` | Trial/local seed に必要な候補患者、受付行、保険、予約が不足 | repo defect と混同せず、sanitized blocker summary |
| `environment-blocker` | 資格情報未投入、Trial 停止、Docker/port/secret store 問題 | 環境条件と再開条件を記録 |
| `not-applicable` | feature flag off または権限上対象外 | 判定理由を checklist に残す |

## 6. Focused Tests

変更または確認対象に応じて実行する。

```bash
cd web-client && npm test -- --run \
  src/features/reception/__tests__/ReceptionPage.test.tsx \
  src/features/charts/__tests__/prescriptionOrderEditorPanel.test.tsx \
  src/features/charts/__tests__/prescriptionOrderEditorPanel.orca-support.test.tsx \
  src/features/charts/__tests__/orderBundleMasterSearch.test.tsx \
  src/features/charts/__tests__/orderDockPanel.state-compat-and-rp-regression.test.tsx
```

追加候補:

```bash
cd web-client && npm test -- --run \
  src/features/charts/__tests__/SoapNotePanel.test.tsx \
  src/features/charts/__tests__/DiagnosisEditPanel.test.tsx \
  src/features/charts/__tests__/PatientInfoEditDialog.test.tsx \
  src/features/patients/__tests__/PatientsPage.test.tsx \
  src/features/administration/__tests__/AdministrationPage.connection.test.tsx \
  src/features/administration/__tests__/AccessManagementPanel.passwordReset.test.tsx
```

## 7. Safe Browser Gate

local persistence と UI 回復系は no-artifacts wrapper で実行する。

```bash
PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id <RUN_ID> \
  tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts \
  tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts
```

期待:

- wrapper が screenshot/HAR/trace/video/raw-network 出力を含む spec を拒否する。
- `test-results/no-artifacts` に forbidden artifact が残らない。
- guarded ORCA endpoint は read-only allowlist 以外を block する。

## 8. WebORCA Trial Live Path

live mutation は次の順でのみ進める。

```bash
cd web-client && node scripts/qa-weborca-candidate-discovery.mjs
cd web-client && QA_PATIENT_ID=<accepted-candidate> node scripts/qa-weborca-readonly-preflight.mjs
cd web-client && QA_PATIENT_ID=<phase3AttemptPatientId> node scripts/qa-acceptmodv2-weborca.mjs
cd web-client && QA_PATIENT_ID=<phase3AttemptPatientId> node scripts/qa-fullflow-weborca.mjs
```

Rules:

- discovery summary だけでは mutation に進まない。
- exact selected-candidate readonly preflight が accepted の場合だけ `qa-acceptmodv2-weborca.mjs` に進む。
- `medicalInformation` 未指定時に browser request body へ field が入ったら failure。
- HTTP 200 や generic all-zero parser だけで accepted としない。
- raw ORCA body、患者詳細、credential-bearing URL を保存しない。

## 9. Final Gates

完了前に実行する。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

`runtime-ready-smoke` は sanitized JSON-only evidence に限定する。smoke seed 不一致で止まる場合は `test-data-blocker` または `environment-blocker` として分類する。

## 10. Reporting

各 iteration の最後に次を日本語で報告する。

- RUN_ID
- 実施 scenario
- 結果
- 修正した場合は対象ファイルと理由
- 実行した検証
- 残ブロッカーと分類
- 次回の最優先タスク
