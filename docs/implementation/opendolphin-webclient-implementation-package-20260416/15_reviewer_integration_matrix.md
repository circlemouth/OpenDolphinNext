# 15. Reviewer Integration Matrix

## 1. reviewer mapping
| reviewer | source file | primary focus | adopted now | kept as gate | rejected |
| --- | --- | --- | --- | --- | --- |
| reviewer-01 | `貼り付けたマークダウン（9）.md` | WS-01 Reception | workflow / transmission / correction / setting 4 層、row-local key requirement、must-visible row inventory | `会計済み` owner、`再計待` clear rule | `送信済 = 会計済み`、patientId-only overlay |
| reviewer-02 | `貼り付けたマークダウン（8）.md` | WS-02 Charts main | encounter context band、action bar owner 一本化、visible save/print/return | context source order gap、safe direct return label mapping | summary bar に main CTA を残すこと |
| reviewer-03 | `貼り付けたマークダウン（7）.md` | WS-03 Right rail | chooser-only、source taxonomy、picker note と sendability note 分離 | cp-set / consult-set scope、Do 複写の最終位置 | right rail second editor、`document` / `orca` runtime tool |
| reviewer-04 | `貼り付けたマークダウン（2）.md` | WS-04 Disease | insurance-local / ORCA mirror / candidate、manual-resolution default visible | clinical owner、mirror sync direction、code/date semantics | single-list truth、auto-confirm、mirror truth |
| reviewer-05 | `貼り付けたマークダウン（4）.md` | WS-05 Document / Image | snapshot-only、reference-remove-only、print route-state only、attachability visible | reference-only backend contract、attachment rehydrate、hard delete scope | patient-specific storage restore、silent drop |
| reviewer-06 | `貼り付けられたテキスト（3 点）.txt` | WS-06 Billing | `send success != paid`、`再計待` workflow、correction note catalog | `会計済み` owner、same-day same-test correction automation | `send success == paid`、correction workflow state 化 |
| reviewer-07 | `貼り付けたマークダウン（1）.md` | WS-07 Setting dependency | authoritative source inventory、feature-off fallback、admin scope note | full setting inventory owner | `/api/admin/config` bulk expansion、unknown setting success 扱い |
| reviewer-08 | `貼り付けられたテキスト（6 点）.txt` | WS-08 Responsive / DADS | width matrix、must-visible rule、1 screen 1 primary、focus/live-region整理 | exact thresholds / 390 target | generic bottom nav、重要情報の disclosure 隠し |
| reviewer-09 | `貼り付けられたテキスト（5 点）.txt` | WS-09 Test / release gate | canonical commands、docs/tests/code 同梱 PR、release packet | every-PR required checks、repo-external release blockers | docs-only PR、responsive standalone PR |

## 2. integration payload by reviewer
| reviewer | current repo truth | recovery delta | fixed now | gate | implementation task | test touchpoint | merge dependency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reviewer-01 | handoff は `scheduleKey` / `encounterKey` fail-close、Reception current bug は send success で `会計済み` override | workflow / transmission / correction / setting 4 層へ再編 | `会計待ち + 送信済` fallback、`再計待` 追加、must-visible row inventory | UG-01, UG-02, WS01-G1 | `types.ts`, `receptionDailyState.ts`, `ReceptionPage.tsx`, docs | `ReceptionPage.test.tsx`, `receptionDailyState.test.ts`, `e2e-rec-001-status-mvp.spec.ts` | PR-01, PR-06b |
| reviewer-02 | `SoapNotePanel` 主面、debug-only surface 非昇格、send/print guard fail-close | encounter band と CTA owner を固定 | `ChartsPatientSummaryBar` = encounter context band、`ChartsActionBar` = page CTA owner | WS02-G1, WS02-G2, UG-16 | `ChartsPatientSummaryBar.tsx`, `ChartsActionBar.tsx`, `ChartsPage.tsx`, docs | `chartsActionBar.test.tsx`, `chartsPageDirtyDot.test.tsx`, `charts-missing-context-recovery.spec.ts` | PR-02 |
| reviewer-03 | runtime right rail は `document`/`orca` と embedded editor を持つ | chooser-only hardening | runtime rail から `document`/`orca` と editor form を除去 | UG-11, UG-16 | `rightUtilityTools.ts`, `RightUtilityDock.tsx`, `RightUtilityDrawer.tsx`, docs | `RightUtilityDrawer.test.tsx`, `e2e-order-save-send-flow.spec.ts` | PR-03 after PR-02 |
| reviewer-04 | current writable disease surface は single list `保険病名` | 3 層モデルと conflict matrix を追加 | insurance-local / mirror / candidate、manual-resolution default visible | UG-04〜07, WS04-G1, WS04-G2 | `DiagnosisEditPanel.tsx`, `diseaseApi.ts`, server disease support, docs | `DiagnosisEditPanel.test.tsx`, `e2e-disease-sync-note.spec.ts`, `OrcaDiseaseMirrorSyncSupportTest` | PR-04 after PR-03 |
| reviewer-05 | patient image asset API と document attach / SOAP insert 分離は current repo にある | lifecycle taxonomy、print fail-close、delete scope 明確化 | snapshot-only、reference-remove-only、attachability visible | UG-08, UG-09, WS05-G1, WS05-G2 | `DocumentCreatePanel.tsx`, print files, image files, server attach contract, docs | `documentCreatePanel.test.tsx`, `e2e-document-hydration-warning.spec.ts`, `PatientImageAttachmentReferenceTest` | PR-05 after PR-02 |
| reviewer-06 | Charts 側では paid を income info で見ているが Reception は崩している | billing boundary / correction note / rebill の統合 | Charts/Reception 双方で `send success != paid` 固定 | UG-01, UG-02, UG-03, UG-12 | `orcaBillingStatus.ts`, `OrcaSummary.tsx`, `ReceptionPage.tsx`, docs | `orcaSummary.billing-status.test.ts`, `e2e-orca-billing-status.spec.ts`, `e2e-billing-correction-note.spec.ts` | PR-06a then PR-06b |
| reviewer-07 | admin/config, connection, capability, runtime は current repo で分かれている | authoritative source inventory と scope note 追加 | unknown setting は feature-off、`/api/admin/config` bulk expansion 禁止 | UG-14 | admin web files, admin server resources, docs | `AdministrationPage.connection.test.tsx`, `e2e-management-setting-visibility.spec.ts`, `FacilitySettingContractTest` | PR-07 after PR-06a |
| reviewer-08 | center-first、named return、focus trap、Mobile Images 390 が current repo anchor | width matrix と DADS must-visible を contract 化 | 1440/1280/1024/768/390 rule、1 screen 1 primary | UG-16, UG-17 | styles, shell, action bar drift, docs | `charts-1280-compression.spec.ts`, `charts-keyboard-aria.spec.ts`, `charts-a11y-page.spec.ts` | owner PR absorb, residual in PR-08 |
| reviewer-09 | canonical commands と existing anchors は current repo にある | docs/tests/code 同梱 PR と release packet へ再編 | docs-only PR を廃止、PR-09 は gate/packet only | repo-external required checks、release blockers | workflows, scripts, release docs, packet | canonical commands 3 本 + QA scripts + targeted suites | PR-09 final |

## 3. adopted summary
- reviewer-01: 採用。Reception 4 層 taxonomy、row-local key requirement、must-visible row inventory
- reviewer-02: 採用。encounter context band、CTA owner 一本化、visible save/print/return
- reviewer-03: 採用。right rail chooser-only、source taxonomy、second editor 排除
- reviewer-04: 採用。disease 3 層、candidate-not-truth、manual-resolution default visible
- reviewer-05: 採用。snapshot-only、reference-remove-only、attachability visible、print fail-close
- reviewer-06: 採用。`send success != paid`、`再計待`、correction note catalog
- reviewer-07: 採用。setting source inventory、admin scope note、feature-off fallback
- reviewer-08: 採用。width matrix、must-visible、1 screen 1 primary、focus/live-region rule
- reviewer-09: 採用。canonical commands、owner PR 同梱、release packet

## 4. rejected summary
- `send success == paid`
- correction required を workflow state にする案
- right rail second editor
- runtime right rail の `document` / `orca`
- disease single-list truth
- order-derived disease auto-confirm
- ORCA mirror truth 化
- session/local storage で patient-specific preview を復元する案
- `/api/admin/config` への未証明 setting 一括追加
- docs-only 実装 PR
- responsive/a11y standalone broad PR
- generic bottom navigation

## 5. integration completion criteria
- reviewer ごとの fixed now が `01_final_fixed_decisions.md` と一致
- reviewer ごとの gate が `08_open_gates_and_risk_register.md` / `13_open_gates.csv` と一致
- reviewer ごとの implementation task が `12_implementation_task_register.csv` に落ちている
- reviewer ごとの test touchpoint が `14_test_matrix.csv` に落ちている
