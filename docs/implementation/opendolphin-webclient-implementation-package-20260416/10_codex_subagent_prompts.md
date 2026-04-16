# 10. Codex Subagent Prompts

以下は **そのまま subagent に渡せる全文 prompt**。  
すべて **GPT 5.4 high** 前提。  
main agent は package の該当 section と、ここに書いた file scope / docset だけを渡すこと。  
各 subagent は **external site / 一般論 / 自分の記憶で補完しない**。  
repo truth に証拠がないことは **unknown** と書き、**fallback 実装 + gate 維持** で返すこと。

---

## SA-01 Reception / Handoff / Row Semantics

```text
あなたは OpenDolphin WebClient 改修の PR-01 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
Reception の row semantics / handoff / workflow-transmission-correction 分離を実装してください。
current repo truth と fixed premise を守り、send success で `会計済み` に上げないように修正してください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-01
- 03_repo_touchpoint_plan.md の Reception
- 04_file_by_file_implementation_plan.md の 4-07, 4-09, 4-10, 4-11, 4-12
- 05_screen_state_copy_spec.md の Reception / Billing / Missing-context
- 06_api_contract_and_boundary_plan.md の Reception handoff / Billing confirmation
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-01, reviewer-06

### file scope
- web-client/notes/ui-current-contract.md
- web-client/notes/patient-context-contract.md
- web-client/notes/feedback-spec.md
- web-client/notes/billing-boundary-correction-scenarios.md
- web-client/notes/release-gate.md
- web-client/src/features/outpatient/types.ts
- web-client/src/features/reception/receptionDailyState.ts
- web-client/src/features/reception/receptionHandoff.ts
- web-client/src/features/reception/pages/ReceptionPage.tsx
- web-client/src/features/reception/__tests__/ReceptionPage.test.tsx
- web-client/src/features/reception/__tests__/receptionDailyState.test.ts
- web-client/src/features/reception/__tests__/receptionHandoff.test.ts
- tests/reception/e2e-rec-001-status-mvp.spec.ts
- tests/reception/e2e-acceptmodv2.spec.ts

### fixed now
- `scheduleKey` / `encounterKey` handoff fail-close を崩さない
- `send success != paid`
- `送信済` は workflow state に入れない
- `再計待` を workflow state に追加する
- correction note と generic memo を混ぜない
- patientId-only overlay / handoff を戻さない
- important info を collapsed-card の selected-only detail に隠さない

### やってよいこと
- workflow / transmission / correction / setting の 4 層 taxonomy へ整える
- row-local key に移すための型・state・cache 参照修正
- visible row inventory の固定
- docs / tests / code を同 PR scope で揃える
- gate 未解決項目は fallback を実装し、gate を残す

### non-goal
- ORCA confirmation source を新規に決めること
- billing core の authoritative owner を推測で埋めること
- disease / document / admin を横断して直すこと
- bottom navigation を入れること

### 実装 fallback
- UG-01 未解決時は `会計待ち + 送信済`
- UG-02 未解決時は paid 後 edit を `再計待`
- row-local key が曖昧なら positive `送信済` を貼らない

### 必須 test
- web-client/src/features/reception/__tests__/ReceptionPage.test.tsx
- web-client/src/features/reception/__tests__/receptionDailyState.test.ts
- web-client/src/features/reception/__tests__/receptionHandoff.test.ts
- tests/reception/e2e-rec-001-status-mvp.spec.ts
- tests/reception/e2e-acceptmodv2.spec.ts

### 返却フォーマット
- changed files
- fixed now に対する遵守確認
- open gate に触れた点
- 実施 test と結果
- residual risk
```

---

## SA-02 Charts Main / Encounter Band / Action Bar

```text
あなたは OpenDolphin WebClient 改修の PR-02 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
Charts main を center-first のまま整え、`ChartsPatientSummaryBar = encounter context band`、`ChartsActionBar = page CTA owner` に移行してください。
`保存 / 印刷 / 受付へ戻る` を disclosure 外へ出し、lost-context を fail-close にしてください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-02
- 03_repo_touchpoint_plan.md の Charts
- 04_file_by_file_implementation_plan.md の 4-07, 4-08, 4-13, 4-14, 4-15
- 05_screen_state_copy_spec.md の Charts / Missing-context / Narrow layout
- 06_api_contract_and_boundary_plan.md の Charts send / Billing confirmation
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-02, reviewer-08

### file scope
- web-client/notes/ui-current-contract.md
- web-client/notes/patient-context-contract.md
- web-client/notes/feedback-spec.md
- web-client/notes/release-gate.md
- docs/managerdocs/03_web_current_contract_summary.md
- web-client/src/features/charts/ChartsPatientSummaryBar.tsx
- web-client/src/features/charts/ChartsActionBar.tsx
- web-client/src/features/charts/pages/ChartsPage.tsx
- web-client/src/features/charts/SoapNotePanel.tsx
- web-client/src/features/charts/OrcaSummary.tsx
- web-client/src/features/charts/styles.ts
- src/AppRouter.tsx
- src/styles/app-shell.css
- src/features/workspaceTabs/WorkspaceTabBar.tsx
- web-client/src/features/charts/__tests__/chartsActionBar.test.tsx
- web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx
- web-client/src/features/charts/__tests__/encounterContext.test.ts
- web-client/src/features/charts/__tests__/encounterContextUrlSync.guard.test.tsx
- web-client/src/features/charts/__tests__/chartsPageDirtyDot.test.tsx
- tests/e2e/charts-missing-context-recovery.spec.ts
- tests/e2e/charts-1280-compression.spec.ts
- tests/e2e/charts-keyboard-aria.spec.ts
- tests/e2e/charts-a11y-page.spec.ts

### fixed now
- `SoapNotePanel` を main primary surface のまま維持
- `finish` と `send` を分離
- `send success != paid`
- minimal context loss では editor を fail-close
- `受付へ戻る` を named return CTA にする
- `閉じる` を return 代替にしない
- important info を disclosure に隠さない
- 1 画面 1 primary

### やってよいこと
- encounter context band の field inventory 実装
- action owner 一本化
- width 1280 / 1024 / 768 の center-first 再配置
- docs / tests / code を同 PR に含める

### non-goal
- right rail taxonomy の変更
- disease / document / billing contract の再設計
- ORCA authoritative paid owner の推測決め
- debug-only surface の通常 runtime 化

### 実装 fallback
- WS02-G1 は docs に gap 明記
- WS02-G2 は `受付へ戻る` を fixed label とする
- UG-16 未解決時は hidden ではなく再配置で対応する

### 必須 test
- web-client/src/features/charts/__tests__/chartsActionBar.test.tsx
- web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx
- web-client/src/features/charts/__tests__/encounterContext.test.ts
- web-client/src/features/charts/__tests__/encounterContextUrlSync.guard.test.tsx
- web-client/src/features/charts/__tests__/chartsPageDirtyDot.test.tsx
- tests/e2e/charts-missing-context-recovery.spec.ts
- tests/e2e/charts-1280-compression.spec.ts
- tests/e2e/charts-keyboard-aria.spec.ts
- tests/e2e/charts-a11y-page.spec.ts

### 返却フォーマット
- changed files
- encounter band / action bar / fail-close の実装要約
- open gate への影響
- 実施 test と結果
- residual risk
```

---

## SA-03 Right Rail / Order Chooser Boundary

```text
あなたは OpenDolphin WebClient 改修の PR-03 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
runtime right rail を order-facing chooser-only に縮退し、`document` / `orca` / embedded editor を runtime rail から除去してください。
chooser source taxonomy を visible copy と tests に固定してください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-03
- 03_repo_touchpoint_plan.md の Right rail / Orders
- 04_file_by_file_implementation_plan.md の 4-01, 4-02, 4-07, 4-16, 4-17, 4-18
- 05_screen_state_copy_spec.md の Right rail / Charts
- 06_api_contract_and_boundary_plan.md の Disease candidate / Orders / no-cross-boundary rule
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-03

### file scope
- web-client/notes/chart-domain-boundary.md
- web-client/notes/reusable-assets-taxonomy.md
- web-client/notes/ui-current-contract.md
- web-client/notes/orca-order-contract-cleanup-20260404.md
- web-client/src/features/charts/rightUtilityTools.ts
- web-client/src/features/charts/RightUtilityDock.tsx
- web-client/src/features/charts/RightUtilityDrawer.tsx
- web-client/src/features/charts/orderChooserSources.ts
- web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx
- web-client/src/features/charts/OrderBundleEditPanel.tsx
- web-client/src/features/charts/OrderSummaryPane.tsx
- web-client/src/features/charts/SoapNotePanel.tsx
- web-client/src/features/charts/__tests__/RightUtilityDrawer.test.tsx
- web-client/src/features/charts/__tests__/orderBundleStampFlow.test.tsx
- web-client/src/features/charts/__tests__/orderDockPanel.categoryButtons.test.tsx
- web-client/src/features/charts/__tests__/orderDockPanel.state-compat-and-rp-regression.test.tsx
- tests/charts/e2e-order-save-send-flow.spec.ts

### fixed now
- right rail chooser-only
- center primary を崩さない
- `document` / `orca` tool を runtime rail に戻さない
- `picker note` と `sendability note` を分離
- Do source は `PastHubPanel` に残す
- consult set / cp-set を right rail に入れない

### やってよいこと
- chooser source taxonomy を shared module に集約
- drawer 内 editor form を除去
- `反映` / `編集面で開く` / `新規作成を開く` の copy に統一
- docs / tests / code を同 PR に入れる

### non-goal
- disease / document / billing の主面 redesign
- new server endpoint の追加
- `bottom-integrated` 実験を final UX に昇格
- stamp 管理の redesign

### 実装 fallback
- UG-11 未解決時は multi-domain asset を右に出さない
- source 不明 asset は chooser に出さない
- narrow width は overlay / drawer 化しても chooser-only を維持

### 必須 test
- web-client/src/features/charts/__tests__/RightUtilityDrawer.test.tsx
- web-client/src/features/charts/__tests__/orderBundleStampFlow.test.tsx
- web-client/src/features/charts/__tests__/orderDockPanel.categoryButtons.test.tsx
- web-client/src/features/charts/__tests__/orderDockPanel.state-compat-and-rp-regression.test.tsx
- tests/charts/e2e-order-save-send-flow.spec.ts

### 返却フォーマット
- changed files
- drawer から除去した runtime surface
- source taxonomy の実装要約
- open gate / fallback
- 実施 test と結果
```

---

## SA-04 Disease Boundary Recovery

```text
あなたは OpenDolphin WebClient 改修の PR-04 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
Disease を single-list truth から外し、insurance-local / ORCA mirror / candidate を分けてください。
silent merge / delete を禁止し、manual-resolution note を default visible にしてください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-04
- 03_repo_touchpoint_plan.md の Disease
- 04_file_by_file_implementation_plan.md の 4-03, 4-07, 4-19, 4-20
- 05_screen_state_copy_spec.md の Disease
- 06_api_contract_and_boundary_plan.md の disease sections
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-04

### file scope
- web-client/notes/disease-insurance-orca-contract.md
- web-client/notes/ui-current-contract.md
- web-client/notes/feedback-spec.md
- web-client/src/features/charts/DiagnosisEditPanel.tsx
- web-client/src/features/charts/diseaseApi.ts
- web-client/src/features/charts/chartOrderSetStorage.ts
- web-client/src/features/charts/pages/OrderSetEditorPage.tsx
- server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java
- server-modernized/src/main/java/open/dolphin/orca/service/DiseaseProjectionService.java
- server-modernized/src/main/java/open/orca/rest/OrcaDiseaseQuerySupport.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java
- server-modernized/src/main/java/open/dolphin/orca/read/OrcaLiveDiseaseMasterReadService.java
- web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx
- web-client/src/features/charts/__tests__/api.medicalSummary.test.ts
- tests/charts/e2e-disease-sync-note.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseMirrorSyncSupportTest.java

### fixed now
- insurance-local authoring only
- ORCA mirror read-only
- candidate-not-truth
- order-derived auto-confirm 禁止
- silent merge / silent delete 禁止
- clinical source 未実装なら fake list を出さない
- conflict / stale / manual-resolution note は default visible

### やってよいこと
- UI layer を `保険病名` / `ORCA mirror` / `候補` に分ける
- `diseaseApi.ts` の型分割
- order-set disease を candidate-only semantics に変える
- docs / tests / code を同 PR に入れる

### non-goal
- clinical source owner を推測で決めること
- ORCA mirror sync direction を勝手に閉じること
- stale threshold を heuristic で決めること
- raw ORCA payload を通常画面に常時表示すること

### 実装 fallback
- UG-04 未解決時は insurance-local のみ writable
- UG-05 未解決時は mirror read-only
- UG-06 未解決時は visible diff + manual resolution
- UG-07 未解決時は current outcome preset を input assist としてだけ扱う

### 必須 test
- web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx
- web-client/src/features/charts/__tests__/api.medicalSummary.test.ts
- tests/charts/e2e-disease-sync-note.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseMirrorSyncSupportTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterReadServiceTest.java

### 返却フォーマット
- changed files
- 3 層境界の実装要約
- gate に残した unknown
- 実施 test と結果
- residual risk
```

---

## SA-05 Document / Image Lifecycle

```text
あなたは OpenDolphin WebClient 改修の PR-05 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
document / image lifecycle を snapshot / asset / reference / print preview に分離し、sessionStorage preview restore を除去してください。
attachment-linked saved document の silent drop を防いでください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-05
- 03_repo_touchpoint_plan.md の Document / Image
- 04_file_by_file_implementation_plan.md の 4-04, 4-07, 4-08, 4-21, 4-22, 4-23, 4-24
- 05_screen_state_copy_spec.md の Document / Image / Mobile Images / Missing-context
- 06_api_contract_and_boundary_plan.md の Document snapshot / Patient image asset / Attachment reference / Print preview
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-05

### file scope
- web-client/notes/document-image-lifecycle.md
- web-client/notes/ui-current-contract.md
- web-client/notes/patient-context-contract.md
- docs/contracts/patient-images.md
- docs/contracts/document-integrity.md
- docs/contracts/runtime-config.md
- docs/web-client/architecture/document-embedded-attachment-policy.md
- web-client/src/features/charts/DocumentCreatePanel.tsx
- web-client/src/features/charts/print/documentPrintPreviewStorage.ts
- web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx
- web-client/src/features/charts/documentImageAttach.ts
- web-client/src/features/images/components/ImageDockedPanel.tsx
- web-client/src/features/images/pages/MobileImagesUploadPage.tsx
- web-client/src/features/images/patientImagesApi.ts
- server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java
- server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java
- server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java
- server-modernized/src/main/java/open/dolphin/security/integrity/DocumentIntegrityService.java
- web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx
- web-client/src/features/charts/__tests__/documentImageAttach.test.ts
- tests/charts/e2e-image-upload.spec.ts
- tests/charts/e2e-image-attach-to-document.spec.ts
- tests/charts/e2e-document-reuse.spec.ts
- tests/charts/e2e-document-hydration-warning.spec.ts
- tests/e2e/charts-report-print.msw.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/KarteDocumentWriteResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/KarteDocumentSnapshotContractTest.java
- server-modernized/src/test/java/open/dolphin/rest/PatientImageAttachmentReferenceTest.java
- server-modernized/src/test/java/open/dolphin/rest/PatientImagesResourceTest.java
- server-modernized/src/test/java/open/dolphin/security/integrity/DocumentIntegrityServiceTest.java

### fixed now
- odletter snapshot が patient-specific document 正本
- patient image asset は `/patients/{patientId}/images`
- attachment reference は asset 実体と別
- print preview は route-state only
- history delete = reference remove only
- hard delete は gate 閉鎖まで UI 非表示
- patient context 非永続

### やってよいこと
- delete copy / impact copy の明確化
- attachment-linked edit の fail-close block
- attachability reason の visible 化
- preview storage 除去
- backend contract test の追加と unsupported 時 feature-off fallback

### non-goal
- generic uploaded file flow を推測で新設すること
- patient image hard delete API を新設すること
- template 管理 UI の全面 redesign
- send/finish/billing contract をいじること

### 実装 fallback
- UG-08 未解決時は snapshot-only
- UG-09 未解決時は reference remove only
- WS05-G1 未解決時は document attach action を feature-off
- WS05-G2 未解決時は saved attachment-linked doc の edit を block

### 必須 test
- web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx
- web-client/src/features/charts/__tests__/documentImageAttach.test.ts
- tests/charts/e2e-image-upload.spec.ts
- tests/charts/e2e-image-attach-to-document.spec.ts
- tests/charts/e2e-document-reuse.spec.ts
- tests/charts/e2e-document-hydration-warning.spec.ts
- tests/e2e/charts-report-print.msw.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/KarteDocumentWriteResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/KarteDocumentSnapshotContractTest.java
- server-modernized/src/test/java/open/dolphin/rest/PatientImageAttachmentReferenceTest.java
- server-modernized/src/test/java/open/dolphin/rest/PatientImagesResourceTest.java
- server-modernized/src/test/java/open/dolphin/security/integrity/DocumentIntegrityServiceTest.java

### 返却フォーマット
- changed files
- snapshot / asset / reference / preview の境界実装
- gate/fallback の残し方
- 実施 test と結果
- residual risk
```

---

## SA-06 Billing Core / ORCA Correction

```text
あなたは OpenDolphin WebClient 改修の PR-06a 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
Charts 側で billing boundary を固定し、workflow / transmission / correction / setting の 4 層を実装してください。
`send success != paid` を Charts 側で崩さないようにし、correction note を visible にしてください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-06
- 03_repo_touchpoint_plan.md の Billing
- 04_file_by_file_implementation_plan.md の 4-05, 4-07, 4-25, 4-26
- 05_screen_state_copy_spec.md の Billing / Charts
- 06_api_contract_and_boundary_plan.md の Billing sections
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-06

### file scope
- web-client/notes/billing-boundary-correction-scenarios.md
- web-client/notes/ui-current-contract.md
- web-client/notes/feedback-spec.md
- web-client/notes/release-gate.md
- web-client/src/features/charts/orcaBillingStatus.ts
- web-client/src/features/charts/OrcaSummary.tsx
- web-client/src/features/charts/orcaClaimSendCache.ts
- web-client/src/features/charts/ChartsActionBar.tsx
- web-client/src/features/charts/orcaIncomeInfoCache.ts
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java
- web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts
- web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx
- tests/charts/e2e-orca-billing-status.spec.ts
- tests/charts/e2e-billing-correction-note.spec.ts
- tests/e2e/charts/e2e-orca-claim-send.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaBillingCorrectionScenarioSupportTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaVisitResourceTest.java

### fixed now
- `send success != paid`
- transmission source と confirmation source を分ける
- correction required は workflow state にしない
- setting note と correction note を混ぜない
- `income-info` と `medical-mod-v2` の意味分離を崩さない
- paid source 未確定なら `会計待ち + 送信済`

### やってよいこと
- correction note catalog / resolver の追加
- OrcaSummary の compact slot 整理
- send cache を paid owner にしない構造固定
- docs / tests / code を同 PR に入れる

### non-goal
- authoritative `会計済み` owner を推測で閉じること
- Reception row semantics まで同 PR で巻き取ること
- ORCA-only correction を client だけで自動解決すること
- new route を推測で増やすこと

### 実装 fallback
- UG-01 未解決時は `会計待ち + 送信済`
- UG-02 未解決時は rebill clear を自動解除しない
- UG-12 未解決時は correction note 表示のみ

### 必須 test
- web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts
- web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx
- tests/charts/e2e-orca-billing-status.spec.ts
- tests/charts/e2e-billing-correction-note.spec.ts
- tests/e2e/charts/e2e-orca-claim-send.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaBillingCorrectionScenarioSupportTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/orca/OrcaVisitResourceTest.java

### 返却フォーマット
- changed files
- transmission / paid / correction 分離の要約
- gate/fallback
- 実施 test と結果
- residual risk
```

---

## SA-07 Billing Reception Projection

```text
あなたは OpenDolphin WebClient 改修の PR-06b 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
billing core 完了後、Reception 側の billing projection を Charts 側 contract に揃えてください。
`再計待` と correction note を Reception の table / card に落とし込んでください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-01, WS-06
- 03_repo_touchpoint_plan.md の Reception / Billing
- 04_file_by_file_implementation_plan.md の 4-09, 4-10, 4-11, 4-12, 4-25
- 05_screen_state_copy_spec.md の Reception / Billing
- 06_api_contract_and_boundary_plan.md の Billing confirmation
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-01, reviewer-06

### file scope
- web-client/src/features/outpatient/types.ts
- web-client/src/features/reception/receptionDailyState.ts
- web-client/src/features/reception/pages/ReceptionPage.tsx
- web-client/src/features/charts/orcaClaimSendCache.ts
- web-client/src/features/reception/__tests__/ReceptionPage.test.tsx
- web-client/src/features/reception/__tests__/receptionDailyState.test.ts
- tests/reception/e2e-rec-001-status-mvp.spec.ts
- tests/reception/e2e-billing-correction-note.spec.ts

### fixed now
- Reception で send success だけで `会計済み` にしない
- `再計待` を workflow state として出す
- correction / rebill は separate slot
- must-visible info を collapsed card に残す

### やってよいこと
- PR-06a に合わせた projection 調整
- row-local signal の利用
- docs との wording 揃え
- tests 更新

### non-goal
- billing core / ORCA support の再変更
- disease / document / admin の巻き取り
- `送信済` を workflow tab に昇格すること

### 実装 fallback
- UG-01, UG-02 未解決時は `会計待ち + 送信済`, `再計待`
- row-local key が曖昧なら positive signal を出さない

### 必須 test
- web-client/src/features/reception/__tests__/ReceptionPage.test.tsx
- web-client/src/features/reception/__tests__/receptionDailyState.test.ts
- tests/reception/e2e-rec-001-status-mvp.spec.ts
- tests/reception/e2e-billing-correction-note.spec.ts

### 返却フォーマット
- changed files
- Reception projection の変更点
- PR-06a 依存の有無
- 実施 test と結果
- residual risk
```

---

## SA-08 Admin / Setting Dependency

```text
あなたは OpenDolphin WebClient 改修の PR-07 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
management-setting dependent behavior を authoritative source inventory ベースで整理してください。
`/api/admin/config` を charts delivery only に固定し、unknown setting を feature-off に倒してください。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-07
- 03_repo_touchpoint_plan.md の Admin / runtime
- 04_file_by_file_implementation_plan.md の 4-01, 4-06, 4-07, 4-08, 4-27, 4-28
- 05_screen_state_copy_spec.md の Billing / Missing-context / Narrow layout
- 06_api_contract_and_boundary_plan.md の Settings sections
- 07_test_and_release_gate_plan.md
- 08_open_gates_and_risk_register.md
- 15_reviewer_integration_matrix.md の reviewer-07

### file scope
- web-client/notes/management-setting-dependent-behavior.md
- web-client/notes/ui-current-contract.md
- web-client/notes/feedback-spec.md
- web-client/notes/release-gate.md
- docs/contracts/runtime-config.md
- docs/contracts/orca-connection.md
- web-client/src/features/administration/AdministrationPage.tsx
- web-client/src/features/administration/api.ts
- web-client/src/features/administration/orcaConnectionApi.ts
- web-client/src/features/administration/orcaCapabilitiesApi.ts
- web-client/src/features/administration/delivery/WebOrcaConnectionCard.tsx
- server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigSnapshot.java
- server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java
- server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigResource.java
- server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java
- server-modernized/src/main/java/open/dolphin/rest/AdminOrcaCapabilitiesResource.java
- server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java
- web-client/src/features/administration/__tests__/AdministrationPage.connection.test.tsx
- web-client/src/features/administration/__tests__/AdministrationPage.internalWrapper.test.tsx
- tests/charts/e2e-management-setting-visibility.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/AdminConfigResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/AdminOrcaCapabilitiesResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/FacilitySettingContractTest.java

### fixed now
- `/api/admin/config` = charts delivery only
- connection / capability / runtime-owned を分離
- unknown setting = feature-off / fail-close
- setting note と correction note を混ぜない
- access verified / ORCA connected / testedScope / push configured を 1 status に潰さない

### やってよいこと
- authoritative source inventory の docs 追加
- admin section scope note の追加
- server field の bulk expansion をしない範囲での contract 整理
- tests / docs / code を同 PR で揃える

### non-goal
- 根拠のない facility setting field 追加
- `/api/admin/delivery` の再正本化
- billing / disease の meaning を setting で変えること
- unknown setting を success 扱いすること

### 実装 fallback
- UG-14 未解決項目は inventory に unknown と書き、UI には toggle を出さない
- optional module visibility owner 不明なら feature-off

### 必須 test
- web-client/src/features/administration/__tests__/AdministrationPage.connection.test.tsx
- web-client/src/features/administration/__tests__/AdministrationPage.internalWrapper.test.tsx
- tests/charts/e2e-management-setting-visibility.spec.ts
- server-modernized/src/test/java/open/dolphin/rest/AdminConfigResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/AdminOrcaCapabilitiesResourceTest.java
- server-modernized/src/test/java/open/dolphin/rest/FacilitySettingContractTest.java

### 返却フォーマット
- changed files
- source inventory / feature-off の実装要約
- gate/fallback
- 実施 test と結果
- residual risk
```

---

## SA-09 Residual Stabilization / Responsive / A11y

```text
あなたは OpenDolphin WebClient 改修の PR-08 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
owner PR に吸収しきれなかった must-visible / responsive / focus / live-region drift だけを最小差分で整えてください。
ここでは new contract を作らず、既存 fixed decision の残差だけを解消します。

### 正本として読む docset
- README.md
- 01_final_fixed_decisions.md
- 02_phase_and_workstream_plan.md の WS-08
- 05_screen_state_copy_spec.md 全体
- 07_test_and_release_gate_plan.md の QA-08 / stop-ship
- 08_open_gates_and_risk_register.md の UG-16, UG-17
- 15_reviewer_integration_matrix.md の reviewer-08, reviewer-09

### file scope
- owner PR merge 後に drift が出た file のみ
- 典型例:
  - web-client/src/features/charts/styles.ts
  - src/styles/app-shell.css
  - web-client/src/features/reception/pages/ReceptionPage.tsx
  - web-client/src/features/charts/pages/ChartsPage.tsx
  - src/components/modals/FocusTrapDialog.tsx
- tests:
  - tests/e2e/charts-1280-compression.spec.ts
  - tests/e2e/charts-keyboard-aria.spec.ts
  - tests/e2e/charts-a11y-page.spec.ts
  - manual QA screenshots

### fixed now
- important info を disclosure に隠さない
- 1 screen 1 primary
- generic bottom nav を増やさない
- dialog trap / retry focus / success focus を壊さない
- new route / new DTO / new state owner を作らない

### やってよいこと
- CSS / layout / focus / aria の残差修正
- test drift 修正
- docs wording drift 修正

### non-goal
- domain contract の変更
- admin / billing / disease / document の meaning 変更
- broad rewrite
- new workstream の追加

### 実装 fallback
- UG-16 未解決時は center-first 再配置
- UG-17 未解決時は first-save-wins + explicit error を維持

### 必須 test
- tests/e2e/charts-1280-compression.spec.ts
- tests/e2e/charts-keyboard-aria.spec.ts
- tests/e2e/charts-a11y-page.spec.ts

### 返却フォーマット
- changed files
- drift 修正内容
- contract 非変更の確認
- 実施 test と結果
- residual risk
```

---

## SA-10 Test / Release Gate / Packet

```text
あなたは OpenDolphin WebClient 改修の PR-09 担当 subagent です。
モデルは GPT 5.4 high 前提です。

### 目的
canonical commands、targeted suites、manual QA、ORCA live QA、release packet を package と一致させて統合してください。
ここでは new user-visible contract を作りません。

### 正本として読む docset
- README.md
- 02_phase_and_workstream_plan.md の WS-09
- 07_test_and_release_gate_plan.md 全体
- 08_open_gates_and_risk_register.md
- 11_merge_order_and_pr_split.md
- 12_implementation_task_register.csv
- 13_open_gates.csv
- 14_test_matrix.csv
- 15_reviewer_integration_matrix.md の reviewer-09

### file scope
- web-client/notes/release-gate.md
- docs/runbooks/release-validation.md
- docs/releases/orca-remediation-cutover.md
- web-client/package.json
- web-client/scripts/runtime-ready-smoke.mjs
- web-client/scripts/verify-no-blocked-orca-route-strings.mjs
- web-client/scripts/qa-checklist-minimal.mjs
- web-client/scripts/qa-acceptmodv2-weborca.mjs
- web-client/scripts/qa-fullflow-weborca.mjs
- web-client/scripts/qa-document-modal.mjs
- web-client/scripts/qa-images-phaseA-web.mjs
- web-client/scripts/qa-mobile-images-ui-phase1.mjs
- web-client/scripts/qa-order-bundle-save.mjs
- .github/workflows/web-client-test-shards.yml
- .github/workflows/e2e.yml
- .github/workflows/server-modernized-characterization.yml
- .github/workflows/server-modernized-static-analysis-gate.yml

### fixed now
- canonical commands は 3 本のまま
- `runtime-ready-smoke.mjs` は release 前 mandatory
- docs-only PR を前提にしない
- owner PR の targeted suite と QA script を matrix に合わせる
- repo-local merge ready と release-ready を分ける

### やってよいこと
- new tests / scripts / workflows の登録
- packet checklist の整備
- stop-ship と manual QA の同期
- docs/runbook の最終同期

### non-goal
- branch protection の repo-external 設定変更
- secrets 投入
- domain code の意味変更
- `runtime-ready-smoke` を every PR required と断定すること

### 実装 fallback
- repo-external required checks / secrets / ORCA seed drift は packet に記録し、release-ready と merge-ready を分ける

### 必須 test / command
- cd web-client && npm run ci
- mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
- cd web-client && node scripts/runtime-ready-smoke.mjs

### 返却フォーマット
- changed files
- canonical commands / targeted suites / QA scripts の反映内容
- repo-external blocker の扱い
- 実施 test と結果
- release packet に残す evidence
```
