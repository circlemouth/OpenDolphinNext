# 08. Codex Subagent Prompts

## 共通ルール
- model: **gpt 5.4 high**
- current repo truth 優先
- build artifact は無視
- blocker 以外へ scope を広げない
- backward compatibility は不要
- guessed implementation 禁止
- 変更した code と tests と docs を同じ subtask 内で揃える

---

## SA-01 transport-security-hardening
```text
あなたは OpenDolphinNext の subagent SA-01 transport-security-hardening です。
model は gpt 5.4 high を使ってください。

目的:
- C1 facility fail-close
- C2 sanitize
を current repo truth に従って修正する。

主担当 file:
- server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java
- server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java
- server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java
- server-modernized/src/main/java/open/dolphin/orca/transport/OrcaHttpClient.java
- server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java
- server-modernized/src/main/java/open/dolphin/rest/OrcaGatewayExceptionMapper.java
- server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java
- server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionTestSupport.java
- 対応 test 群

必須 acceptance:
1. explicit defaultFacilityId が無いとき runtime facility へ fallback しない
2. facility unresolved / store missing / facility config missing のとき runtime config へ fallback しない
3. unresolved は facility_configuration_missing で fail-close
4. invalid host/baseUrl / malformed URL で raw host/baseUrl/url/pathPrefix/userinfo を log / error body / audit / admin test response に出さない
5. negative tests を追加し、再発を固定する

禁止:
- admin UI wording の broad rewrite
- new config source の追加
- mTLS 実装方針の全面変更

出力:
- commit-ready diff
- 追加/更新 test 一覧
- main agent 向け handoff note
  - changed files
  - remaining ambiguity
  - merge risk
```

## SA-02 charts-claim-signal-and-summary-visibility
```text
あなたは OpenDolphinNext の subagent SA-02 charts-claim-signal-and-summary-visibility です。
model は gpt 5.4 high を使ってください。

目的:
- C3 Charts transmission evidence row-local 化
- C4 OrcaSummary must-visible 化
を current repo truth に従って修正する。

主担当 file:
- web-client/src/features/charts/orcaClaimSendCache.ts
- web-client/src/features/charts/ChartsActionBar.tsx
- web-client/src/features/charts/OrcaSummary.tsx
- web-client/src/features/charts/print/useOrcaReportPrint.ts
- web-client/src/features/charts/OrderBundleEditPanel.tsx
- web-client/src/features/charts/OrderDockPanel.tsx
- web-client/src/features/charts/DocumentTimeline.tsx
- 関連 charts tests

必須 acceptance:
1. patientId latest cache を Charts positive signal source にしない
2. row-local helper で encounterKey > scheduleKey > receptionId > appointmentId 優先にする
3. save 側で strongest key を落とさない
4. row-local key 不足時は positive transmission / invoice / warning を出さない
5. OrcaSummary の Workflow / Transmission / ORCA収納情報 を closed details 外で初期表示する
6. ChartsActionBar が page CTA owner のままで、1画面1 primary を壊さない
7. same-day multi-encounter / multi-reception regression tests を追加する

DADS 制約:
- 重要情報は隠さない
- disclosure は補足用途だけに使う
- 1画面1 primary を守る

禁止:
- send success と paid の再統合
- Charts broad redesign
- right rail taxonomy 変更
- Reception row semantics の別件変更

出力:
- commit-ready diff
- 追加/更新 tests
- main agent 向け handoff note
  - changed files
  - any conflict with SA-04 expectations
  - merge risk
```

## SA-03 patients-canonical-readback
```text
あなたは OpenDolphinNext の subagent SA-03 patients-canonical-readback です。
model は gpt 5.4 high を使ってください。

目的:
- C5 Patients official create/update/import の canonical re-fetch success semantics を修正する。

主担当 file:
- web-client/src/features/patients/api.ts
- web-client/src/features/patients/PatientsPage.tsx
- web-client/src/features/charts/PatientInfoEditDialog.tsx
- web-client/src/features/outpatient/orcaPatientImportApi.ts
- 関連 tests

必須 acceptance:
1. full success は canonical re-fetch success を含む
2. write accepted でも canonical readback failure なら full-success copy にしない
3. Patients page は canonical/local sync 完了を誤表示しない
4. PatientInfoEditDialog は readback failure 時に success close しない
5. import flow も同じ semantics にする
6. negative tests を追加して固定する

禁止:
- local search / local mutation の redesign
- patient context owner の別件変更
- new route / new DTO 導入

出力:
- commit-ready diff
- 追加/更新 tests
- main agent 向け handoff note
  - changed files
  - user-visible semantics change summary
  - merge risk
```

## SA-04 docs-tests-qa-alignment
```text
あなたは OpenDolphinNext の subagent SA-04 docs-tests-qa-alignment です。
model は gpt 5.4 high を使ってください。

目的:
- C6 OrcaSummary visibility test drift
- C7 QA script / release doc gate drift
を current repo truth に従って修正する。

前提:
- SA-02 と SA-03 の merge 結果を見てから rebase する
- `OrcaSummary.tsx` 本体は SA-02 owner。必要なら main agent 経由で調整する

主担当 file:
- web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx
- docs/runbooks/release-validation.md
- docs/releases/orca-remediation-cutover.md
- web-client/scripts/qa-acceptmodv2-weborca.mjs
- web-client/scripts/qa-fullflow-weborca.mjs
- 必要な supporting tests/docs

必須 acceptance:
1. OrcaSummary must-visible sections について details 外 / initial visible を検査する
2. hidden DOM existence だけで通る test を残さない
3. `QA_MEDICAL_INFORMATION` 未指定 run で request body に `Medical_Information` が含まれたら script failure にする
4. runbook/cutover の gate 文言と script fail condition を一致させる
5. changed screens に DADS 例外メモが必要なら最小限だけ docs に残す

禁止:
- broad QA framework rewrite
- live ORCA script 実行
- OrcaSummary layout の owner 変更

出力:
- commit-ready diff
- 追加/更新 tests/docs/scripts
- main agent 向け handoff note
  - changed files
  - SA-02/SA-03 依存箇所
  - merge risk
```
