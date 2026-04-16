# 03. Repo Touchpoint Plan

## 1. touchpoint 方針
本 package で扱う touchpoint は **web-client / server-modernized / docs / tests** の 4 面で整理する。
目的は「どこを触るか」だけでなく、「どこは触らないか」を先に固定し、実装担当の追加判断をなくすことにある。

### touchpoint 共通ルール
- `source / tests / docs / notes` を正本とし、build artifact / logs / screenshot は触らない
- docs patch と tests patch は owner PR と同梱する
- gate 未解決項目は **no-touch or fail-close** に倒す
- route taxonomy、patient context、billing confirmation、document hydration のような境界は **server owner と docs owner の両面** で固定する

## 2. domain 別 touchpoint 一覧

### 2-1. Reception / handoff / queue / workflow
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/reception/pages/ReceptionPage.tsx`<br>`web-client/src/features/reception/receptionDailyState.ts`<br>`web-client/src/features/reception/receptionHandoff.ts`<br>`web-client/src/features/outpatient/types.ts`<br>`web-client/src/features/charts/orcaClaimSendCache.ts` | workflow / transmission / correction / setting 4層、row-local key、canonical handoff 維持 | `patientId` first-match handoff を戻さない。`entry.note` を correction slot に流用しない。`送信済` を workflow state に昇格しない |
| server | `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java` | Reception が依存する visit/appointment public contract の owner を固定 | UG-01/UG-02 が閉じるまで paid promotion logic を足さない |
| docs | `web-client/notes/ui-current-contract.md`<br>`web-client/notes/patient-context-contract.md`<br>`web-client/notes/feedback-spec.md`<br>`web-client/notes/billing-boundary-correction-scenarios.md` | row semantics / handoff / copy / fail-close を文書で固定 | Digikar manual wording を current repo truth の代替根拠として昇格しない |
| tests | `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx`<br>`web-client/src/features/reception/__tests__/receptionDailyState.test.ts`<br>`web-client/src/features/reception/__tests__/receptionHandoff.test.ts`<br>`tests/reception/e2e-rec-001-status-mvp.spec.ts`<br>`tests/reception/e2e-acceptmodv2.spec.ts`<br>`tests/reception/e2e-billing-correction-note.spec.ts` | Reception regressions を先に止める | current bug (`send success -> 会計済み`) を anchor として残さない |

### 2-2. Charts main / encounter context / action bar
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/charts/ChartsPatientSummaryBar.tsx`<br>`web-client/src/features/charts/ChartsActionBar.tsx`<br>`web-client/src/features/charts/pages/ChartsPage.tsx`<br>`web-client/src/features/charts/SoapNotePanel.tsx`<br>`web-client/src/features/charts/OrcaSummary.tsx`<br>`web-client/src/features/charts/styles.ts`<br>`src/AppRouter.tsx`<br>`src/styles/app-shell.css`<br>`src/features/workspaceTabs/WorkspaceTabBar.tsx` | encounter band、single CTA owner、lost-context fail-close、width rule、shell focus order | `DocumentTimeline` と `MedicalOutpatientRecordPanel` を通常 runtime 主面に昇格しない。`finish` と `send` を再統合しない |
| server | `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java` | Charts send/summary が依存する official support boundary を keep | new route 追加で current contract を回避しない |
| docs | `web-client/notes/ui-current-contract.md`<br>`web-client/notes/patient-context-contract.md`<br>`web-client/notes/feedback-spec.md` | encounter band inventory、CTA priority、named return、send/print fail-close を文書化 | docs だけで code と食い違う source order を fixed fact として上書きしない |
| tests | `web-client/src/features/charts/__tests__/chartsActionBar.test.tsx`<br>`web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`<br>`web-client/src/features/charts/__tests__/encounterContext.test.ts`<br>`web-client/src/features/charts/__tests__/encounterContextUrlSync.guard.test.tsx`<br>`web-client/src/features/charts/__tests__/chartsPageDirtyDot.test.tsx`<br>`tests/e2e/charts-missing-context-recovery.spec.ts`<br>`tests/e2e/charts-1280-compression.spec.ts`<br>`tests/e2e/charts-keyboard-aria.spec.ts`<br>`tests/e2e/charts-a11y-page.spec.ts` | encounter context / CTA / width / focus regressions を固定 | disclosure に required action を押し込む変更を screenshot だけで通さない |

### 2-3. Right rail / orders / reusable assets
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/charts/rightUtilityTools.ts`<br>`web-client/src/features/charts/RightUtilityDock.tsx`<br>`web-client/src/features/charts/RightUtilityDrawer.tsx`<br>`web-client/src/features/charts/orderChooserSources.ts`<br>`web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`<br>`web-client/src/features/charts/OrderBundleEditPanel.tsx`<br>`web-client/src/features/charts/OrderSummaryPane.tsx`<br>`web-client/src/features/charts/SoapNotePanel.tsx` | runtime rail を order-facing chooser-only に縮退し、editor を center 側へ戻す | `document` / `orca` tool を runtime rail に残さない。`OrderDockPanel` を最終 runtime shell の根拠にしない |
| server | `server-modernized/src/main/java/open/dolphin/rest/orca/LocalOrderBundleResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/LocalPrescriptionOrderResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderMasterResource.java` | order chooser / save / master search の route taxonomy を keep | UG-11 が閉じるまで cp-set / consult-set 用の guessed endpoint を足さない |
| docs | `web-client/notes/chart-domain-boundary.md`<br>`web-client/notes/reusable-assets-taxonomy.md`<br>`web-client/notes/orca-order-contract-cleanup-20260404.md` | chooser source taxonomy、picker note、sendability note の責務を固定 | document template / findings template / generated artifact を order asset に混ぜない |
| tests | `web-client/src/features/charts/__tests__/RightUtilityDrawer.test.tsx`<br>`web-client/src/features/charts/__tests__/orderDockPanel.categoryButtons.test.tsx`<br>`web-client/src/features/charts/__tests__/orderBundleStampFlow.test.tsx`<br>`tests/charts/e2e-order-save-send-flow.spec.ts` | chooser-only 化と center primary を regression net に入れる | editor-in-drawer を期待する既存 test を残さない |

### 2-4. Disease
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/charts/DiagnosisEditPanel.tsx`<br>`web-client/src/features/charts/diseaseApi.ts`<br>`web-client/src/features/charts/chartOrderSetStorage.ts`<br>`web-client/src/features/charts/pages/OrderSetEditorPage.tsx` | insurance-local / ORCA mirror / candidate の 3層、manual-resolution note、candidate-only order-set semantics | single list truth、order-derived auto-confirm、silent merge/delete を入れない |
| server | `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java`<br>`server-modernized/src/main/java/open/dolphin/orca/service/DiseaseProjectionService.java`<br>`server-modernized/src/main/java/open/orca/rest/OrcaDiseaseQuerySupport.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java`<br>`server-modernized/src/main/java/open/dolphin/orca/read/OrcaLiveDiseaseMasterReadService.java` | insurance-local authoring route と mirror support を test-first で固定 | clinical source 未確定のまま fake clinical route を作らない |
| docs | `web-client/notes/disease-insurance-orca-contract.md`<br>`web-client/notes/ui-current-contract.md`<br>`web-client/notes/feedback-spec.md` | 3層、conflict matrix、manual-resolution copy を固定 | outcome/date rule を docs だけで guessed fix しない |
| tests | `web-client/src/features/charts/__tests__/DiagnosisEditPanel.test.tsx`<br>`web-client/src/features/charts/diseaseApi.test.ts`<br>`web-client/src/features/charts/__tests__/chartOrderSetStorage.test.ts`<br>`web-client/src/features/charts/__tests__/orderSetEditorPage.test.tsx`<br>`web-client/src/features/charts/__tests__/ChartsPage.orderSetBoundary.test.tsx`<br>`tests/charts/e2e-disease-sync-note.spec.ts`<br>`server-modernized/src/test/java/open/dolphin/rest/LocalDiagnosisResourceTest.java`<br>`server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseMirrorSyncSupportTest.java` | single-list truth / silent merge を止める | mirror unavailable を sync success 扱いしない |

### 2-5. Document / image / print
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/charts/DocumentCreatePanel.tsx`<br>`web-client/src/features/charts/documentImageAttach.ts`<br>`web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx`<br>`web-client/src/features/charts/print/documentPrintPreviewStorage.ts`<br>`web-client/src/features/images/components/ImageDockedPanel.tsx`<br>`web-client/src/features/images/pages/MobileImagesUploadPage.tsx`<br>`web-client/src/features/images/patientImagesApi.ts` | snapshot-only / reference-remove-only / asset attachability / route-state print を固定 | patient-specific preview を sessionStorage/localStorage に戻さない。hard delete UI を先出ししない |
| server | `server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`<br>`server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`<br>`server-modernized/src/main/java/open/dolphin/security/integrity/DocumentIntegrityService.java` | reference-only attachment、snapshot contract、patient image mainline、integrity contract を保持 | reference-only payload 未証明のまま silent success にしない |
| docs | `web-client/notes/document-image-lifecycle.md`<br>`web-client/notes/patient-context-contract.md`<br>`docs/contracts/patient-images.md`<br>`docs/contracts/document-integrity.md`<br>`docs/web-client/architecture/document-embedded-attachment-policy.md` | template / snapshot / reference / asset / print preview の語彙を固定 | generic uploaded file flow を current repo truth として埋めない |
| tests | `web-client/src/features/charts/__tests__/documentCreatePanel.test.tsx`<br>`web-client/src/features/charts/__tests__/documentImageAttach.test.ts`<br>`web-client/src/features/images/__tests__/imageApi.test.ts`<br>`web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`<br>`tests/charts/e2e-image-upload.spec.ts`<br>`tests/charts/e2e-image-attach-to-document.spec.ts`<br>`tests/charts/e2e-document-reuse.spec.ts`<br>`tests/charts/e2e-document-hydration-warning.spec.ts`<br>`tests/e2e/charts-report-print.msw.spec.ts` | silent drop / print restore / stale mock drift を止める | localStorage history 前提を new truth にしない |

### 2-6. Billing / ORCA correction
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/charts/orcaBillingStatus.ts`<br>`web-client/src/features/charts/OrcaSummary.tsx`<br>`web-client/src/features/charts/orcaIncomeInfoCache.ts`<br>`web-client/src/features/reception/pages/ReceptionPage.tsx` | send / paid / correction / rebill を 4層 taxonomy に沿って表示する | `send success == paid` copy を入れない。correction note を workflow state へ入れない |
| server | `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java` | send/confirmation boundary を server 側で再混線させない | Visit/Appointment を paid confirmation owner にしない |
| docs | `web-client/notes/billing-boundary-correction-scenarios.md`<br>`web-client/notes/ui-current-contract.md`<br>`web-client/notes/feedback-spec.md` | send success != paid、correction catalog、rebill note を固定 | structured correction source が無いのに client 自動解決を fixed にしない |
| tests | `web-client/src/features/charts/__tests__/orcaSummary.billing-status.test.ts`<br>`tests/charts/e2e-orca-billing-status.spec.ts`<br>`tests/e2e/charts/e2e-orca-claim-send.spec.ts`<br>`tests/charts/e2e-billing-correction-note.spec.ts`<br>`server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportResourceTest.java` | send / paid / correction の分離を regression net に入れる | `ReceptionPage.test.tsx` の旧期待を残さない |

### 2-7. Management setting / admin / runtime
| 面 | touchpoint | 目的 | no-touch guidance |
| --- | --- | --- | --- |
| web-client | `web-client/src/features/administration/AdministrationPage.tsx`<br>`web-client/src/features/administration/delivery/WebOrcaConnectionCard.tsx`<br>`web-client/src/features/administration/api.ts` | config / connection / capability の scope note を visible にし、unknown setting を feature-off にする | `/api/admin/config` を global facility setting 正本に見せない。fake toggle を出さない |
| server | `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigSnapshot.java`<br>`server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java`<br>`server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`<br>`server-modernized/src/main/java/open/dolphin/rest/AdminOrcaCapabilitiesResource.java`<br>`server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java` | charts delivery only / connection only / capability only / runtime only の boundary を保持 | source 未確定 setting を `/api/admin/config` に一括追加しない |
| docs | `web-client/notes/management-setting-dependent-behavior.md`<br>`docs/contracts/runtime-config.md`<br>`docs/contracts/orca-connection.md`<br>`web-client/notes/ui-current-contract.md` | authoritative source inventory と feature-off fallback を文書化 | setting dependency と ORCA correction を同一 note として書かない |
| tests | `web-client/src/features/administration/__tests__/AdministrationPage.connection.test.tsx`<br>`web-client/src/features/administration/__tests__/AdministrationPage.internalWrapper.test.tsx`<br>`tests/charts/e2e-management-setting-visibility.spec.ts`<br>`server-modernized/src/test/java/open/dolphin/rest/admin/AdminConfigResourceTest.java` | unknown setting -> feature-off / scope note / testedScope split を固定 | `/api/admin/delivery` を second SoT として resurrect しない |

## 3. no-touch guidance 横断版
- **No guessed schema**: route / DTO / setting field / copy の推測追加をしない
- **No legacy resurrection**: `/api/admin/delivery` 第二正本化、`patientId` first-match handoff、sessionStorage patient restore を戻さない
- **No broad rewrite**: responsive/a11y 専用 broad PR、right rail 全面置換、debug surface 主面昇格をしない
- **No cross-domain mixing**: 1 PR に Reception / Disease / Document / Billing を混ぜない
- **No hidden critical info**: correction / rebill / missing-context / delete-scope / disabled-reason を disclosure に入れない

## 4. touched files の優先順位
1. current repo truth を固定する docs / notes
2. user-visible contract を表現する web-client owner files
3. route / DTO / support contract を持つ server owner files
4. regression を止める tests / QA scripts / workflows
