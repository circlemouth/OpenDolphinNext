# 07. Test and Release Gate Plan

## 1. canonical commands
release 前の canonical commands は current repo truth の 3 本をそのまま使う。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

### command policy
- 新しい別系統 command を正本に追加しない
- owner workstream の targeted suite は canonical commands の下にぶら下げる
- `runtime-ready-smoke.mjs` は **release 前 mandatory**
- every-PR required かどうかは repo-external 設定なので gate に残す

## 2. test anchor
### existing web/client anchors
- `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx`
- `web-client/src/features/reception/__tests__/receptionDailyState.test.ts`
- `web-client/src/features/reception/__tests__/receptionHandoff.test.ts`
- `web-client/src/features/charts/__tests__/chartsActionBar.test.tsx`
- `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `web-client/src/features/charts/__tests__/encounterContext.test.ts`
- `web-client/src/features/charts/__tests__/encounterContextUrlSync.guard.test.tsx`
- `web-client/src/features/charts/__tests__/chartsPageDirtyDot.test.tsx`
- `web-client/src/features/charts/__tests__/RightUtilityDrawer.test.tsx`
- `web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx`
- `web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx`
- `web-client/src/features/charts/__tests__/documentImageAttach.test.ts`
- `web-client/src/features/administration/__tests__/AdministrationPage.connection.test.tsx`

### existing server anchors
- `PublicRouteInventoryContractTest`
- `WebXmlEndpointExposureTest`
- `AdminConfigResourceTest`
- `AdminOrcaConnectionResourceTest`
- `AdminOrcaCapabilitiesResourceTest`
- `OrcaChartSupportResourceTest`
- `OrcaVisitResourceTest`
- `OrcaAppointmentResourceTest`
- `LocalDiagnosisResourceTest`
- `KarteDocumentWriteResourceTest`
- `PatientImagesResourceTest`
- `DocumentIntegrityServiceTest`

### existing e2e anchors
- `tests/reception/e2e-rec-001-status-mvp.spec.ts`
- `tests/reception/e2e-acceptmodv2.spec.ts`
- `tests/charts/e2e-order-save-send-flow.spec.ts`
- `tests/charts/e2e-orca-billing-status.spec.ts`
- `tests/charts/e2e-image-upload.spec.ts`
- `tests/charts/e2e-image-attach-to-document.spec.ts`
- `tests/charts/e2e-document-reuse.spec.ts`
- `tests/e2e/charts-report-print.msw.spec.ts`
- `tests/e2e/charts-keyboard-aria.spec.ts`
- `tests/e2e/charts-a11y-page.spec.ts`
- `tests/e2e/charts/e2e-orca-claim-send.spec.ts`

## 3. 新設 test
### new component / unit
- `web-client/src/features/charts/__tests__/ChartsPage.orderSetBoundary.test.tsx`
- `web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts`

### new server
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseMirrorSyncSupportTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/KarteDocumentSnapshotContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/PatientImageAttachmentReferenceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaBillingCorrectionScenarioSupportTest.java`

### new e2e
- `tests/reception/e2e-billing-correction-note.spec.ts`
- `tests/e2e/charts-missing-context-recovery.spec.ts`
- `tests/e2e/charts-1280-compression.spec.ts`
- `tests/charts/e2e-disease-sync-note.spec.ts`
- `tests/charts/e2e-document-hydration-warning.spec.ts`
- `tests/charts/e2e-billing-correction-note.spec.ts`
- `tests/charts/e2e-management-setting-visibility.spec.ts`

## 4. manual QA
### QA-01 Reception
- send success 後も workflow が `会計待ち` のままで transmission が `送信済` になる
- correction / rebill note が table / collapsed card で読める
- `patientId` 単独一致 handoff が復活していない

### QA-02 Charts main
- minimal context loss で editor が fail-close し、`受付へ戻る` が primary になる
- `保存`, `印刷`, `受付へ戻る` が disclosure に入らない
- `finish` success が `会計待ち` で止まる

### QA-03 Right rail
- runtime rail に `document` / `orca` tool が無い
- drawer 内に editor form が出ない
- `反映` / `編集面で開く` が center flow へ handoff する

### QA-04 Disease
- `保険病名` / `ORCA mirror` / `候補` が分かれて見える
- conflict / stale / manual-resolution note が default visible
- order-set disease が auto-save されない

### QA-05 Document / Image
- attachment-linked document の `編集` が fail-close block される
- delete impact に `患者画像実体は削除しません` が見える
- print preview は reload/new tab で復元せず fail-close する
- attachability reason が save 前に visible

### QA-06 Billing
- `送信済` と `会計済み` が同じ意味で見えない
- correction note と setting note が別 slot / 別 tone
- paid 後 edit が `再計待` へ落ちる

### QA-07 Settings / Admin
- admin page が `/api/admin/config` を global setting 正本のように見せない
- WebORCA access/config/testedScope/push が 1 line に潰れていない
- unknown setting は feature-off で visible reason がある

### QA-08 Accessibility / Responsive
- 1280 / 1024 / 768 で important info が disclosure に入らない
- focus trap / retry focus / success focus が壊れていない
- generic bottom nav が追加されていない

## 5. stop-ship 条件
- `send success` を `会計済み` と表示する
- correction note / rebill note / delete scope / missing-context reason が hidden disclosure に落ちる
- right rail に `document` / `orca` tool または editor form が残る
- disease diff が silent merge / silent delete される
- attachment-linked document の existing reference が silent drop する
- print preview が sessionStorage/localStorage で patient-specific state を復元する
- unknown setting が enabled / success 扱いになる
- canonical commands のいずれかが fail する
- `runtime-ready-smoke.mjs` で blocked route / placeholder patient / missing handoff blocker / summary refresh failure が出る
- ORCA live QA blocker を defect と取り違えて release 継続する

## 6. release packet 必須項目
1. 実施 commit / branch / RUN_ID
2. canonical commands 実行結果
3. workstream ごとの targeted suite 実行結果
4. manual QA checklist 結果
5. ORCA live QA 結果または blocker 記録
6. open gates の最新状態
7. stop-ship 条件の確認結果
8. changed docs / routes / tests の一覧
9. rollback / reopen 条件
10. reviewer packet（before/after screenshots が必要な項目のみ）
11. evidence 保存先

## 7. release-ready handling
- repo-local merge ready と release-ready を分ける
- repo-external blocker（required checks, secrets, environment drift, ORCA seed mismatch）は packet に残す
- unknown gate は close されていなくても、fallback が実装され release owner が受領した状態なら release packet に残せる
- fallback が無い unknown は merge しても release-ready にしない
