# 11. Merge Order and PR Split

## 1. 基本方針
- docs-only 実装 PR は作らない
- 各 PR は **docs + tests + code** を owner scope で同梱する
- broad rewrite を避け、domain contract ごとに分ける
- PR-08 は residual stabilization only。new contract を持ち込まない
- PR-09 は test / gate / packet only。user-visible domain contract を変えない

## 2. PR split
| PR | workstream | 主担当 | 含めるもの | 主な target | non-goal |
| --- | --- | --- | --- | --- | --- |
| PR-01 | WS-01 | reception | Reception row semantics, row-local billing signal, handoff docs/tests | `ReceptionPage.tsx`, `receptionDailyState.ts`, `receptionHandoff.ts`, `types.ts` | billing core authoritative owner の推測決め |
| PR-02 | WS-02 | charts-shell | encounter context band, action bar ownership, lost-context fail-close, shell/css | `ChartsPatientSummaryBar.tsx`, `ChartsActionBar.tsx`, `ChartsPage.tsx`, `styles.ts`, app shell | right rail / disease / document redesign |
| PR-03 | WS-03 | orders | right rail chooser-only, source taxonomy, drawer/editor split | `rightUtilityTools.ts`, `RightUtilityDock.tsx`, `RightUtilityDrawer.tsx`, order chooser source files | new server endpoint, cp-set guessed support |
| PR-04 | WS-04 | disease | disease 3 層 UI, candidate-not-truth, mirror read-only, server contract docs/tests | `DiagnosisEditPanel.tsx`, `diseaseApi.ts`, `LocalDiagnosisResource.java` など | clinical owner / stale rule の推測 fix |
| PR-05 | WS-05 | document-image | document/image lifecycle, print route-state only, attachability, backend contract test | `DocumentCreatePanel.tsx`, `ChartsDocumentPrintPage.tsx`, `PatientImagesResource.java`, `KarteDocumentWriteResource.java` | generic file flow 新設, hard delete UI |
| PR-06a | WS-06 | billing | Charts-side billing boundary, send vs paid vs correction, server support | `orcaBillingStatus.ts`, `OrcaSummary.tsx`, `OrcaChartSupport*` | Reception projection まで巻き取ること |
| PR-06b | WS-01+06 | reception + billing | Reception side billing projection, `再計待`, rebill/correction row slot | `ReceptionPage.tsx`, `receptionDailyState.ts`, `types.ts` | billing core authoritative owner を閉じること |
| PR-07 | WS-07 | admin-runtime | authoritative source inventory, admin scope note, feature-off fallback | admin web files, `AdminConfig*`, `AdminOrcaConnection*`, `AdminOrcaCapabilities*`, runtime docs | `/api/admin/config` bulk expansion |
| PR-08 | WS-08 residual only | ui integrator | must-visible / responsive / focus / aria drift の残差修正 | owner PR merge 後に drift が出た files のみ | domain contract の変更 |
| PR-09 | WS-09 | qa-release | test matrix integration, workflows, QA scripts, release packet docs | `.github/workflows/*`, `release-gate.md`, `release-validation.md`, QA scripts | domain code の意味変更 |

## 3. merge order
1. PR-01 Reception  
2. PR-02 Charts main  
3. PR-03 Right rail  
4. PR-04 Disease  
5. PR-05 Document / image  
6. PR-06a Billing core  
7. PR-06b Billing reception projection  
8. PR-07 Admin / setting  
9. PR-08 Residual stabilization  
10. PR-09 Final gate / packet

## 4. merge order の理由
- PR-01 と PR-02 が patient context / status / CTA owner の基礎を固める
- PR-03 は Charts shell と right rail の責務が PR-02 後でないと安定しない
- PR-04 と PR-05 はそれぞれ独立度が高いが、UI shell / chooser rules へ追従する必要がある
- PR-06a は billing core を Charts 側で固め、PR-06b は Reception projection のみを追従させる
- PR-07 は billing/disease/document 側 wording と衝突しやすいため後ろに置く
- PR-08 は residual drift のみ
- PR-09 は test/gate 統合だけ

## 5. conflict hotspot
### 5-1. docs hotspot
- `web-client/notes/ui-current-contract.md`
- `web-client/notes/patient-context-contract.md`
- `web-client/notes/feedback-spec.md`
- `web-client/notes/release-gate.md`
- `docs/runbooks/release-validation.md`
- `docs/contracts/runtime-config.md`

### 5-2. UI hotspot
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/receptionDailyState.ts`
- `web-client/src/features/outpatient/types.ts`
- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/RightUtilityDrawer.tsx`
- `web-client/src/features/charts/DocumentCreatePanel.tsx`
- `web-client/src/features/charts/DiagnosisEditPanel.tsx`

### 5-3. server hotspot
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigResource.java`

## 6. final stabilization step
PR-08 では次だけを許可する。
- must-visible 情報の配置 drift 修正
- focus / aria / retry focus / success focus の drift 修正
- width 1280 / 1024 / 768 の layout drift 修正
- component test / e2e test の selector drift 修正
- docs wording drift 修正

PR-08 では次を禁止する。
- new route / DTO / state owner
- new user-visible state semantics
- right rail taxonomy 変更
- billing confirmation source 変更
- disease sync direction 変更

## 7. reopen 条件
次のどれかが起きたら、該当 PR を reopen して package に戻る。
1. repo truth と fixed decision が衝突する新証拠が見つかった
2. open gate を guessed implementation で閉じようとしている
3. stop-ship 条件に触れる regressions が出た
4. owner PR を越えて cross-domain rewrite が必要になった
5. `send success != paid`、patient context 非永続、right rail chooser-only のいずれかが崩れる
6. residual stabilization で contract change が必要になった
7. release gate 追加のために new canonical command を要求し始めた

## 8. final merge checklist
- docs/tests/code が owner PR に同梱されている
- open gate は `13_open_gates.csv` と一致している
- new tests は `14_test_matrix.csv` に登録されている
- PR-08 は residual only、PR-09 は gate/packet only を守っている
- canonical commands 3 本から逸脱していない
