# Webクライアント ドキュメントハブ（現行）

- 更新日: 2026-03-26
- RUN_ID: 20260326T030254Z

> 本ファイルが **現行の入口**。Phase2 文書は Legacy/Archive として参照専用です。
> 全体の優先順位は `docs/DEVELOPMENT_STATUS.md` を最上位とします。

## 最新変更（2026-03-26 / charts medical summary replacement）
- RUN_ID: `20260326T030254Z`
- Charts medical summary は `GET /api/local-summary/encounters/{encounterKey}/medical-summary` を正本 route とし、query は `encounterKey` がある場合だけ起動する。`scheduleKey` 単独では summary fetch を開始しない。
- `fetchChartsMedicalSummary` / `medicalSummaryQuery` / `CHARTS_MEDICAL_SUMMARY_FETCH` の neutral naming は維持し、`encounterKey` 不在時は `recordsReturned=0`、`outcome=MISSING`、`sourcePath=key_unavailable`、`payload.outpatientList=[]` の local fail-closed placeholder を返す。
- non-2xx は renderable shape に正規化し、Charts UI を永続 loading にしない。`404` / `409` / `503` / `500` は error banner 側で扱える summary shape に落とし込む。
- summary refresh は start success 後の同一 `encounterKey` だけに接続し、`pause` / `finish` / `bill` とは結び付けない。old removed route `/api/orca/medical/outpatient` と guessed endpoint は再混入させない。

## 最新変更（2026-03-26 / scheduleKey / encounterKey feed contract）
- RUN_ID: `20260326T005423Z`
- Administration の operations 監視は current public contract に合わせ、`GET /api/health`、`GET /api/health/readiness`、`GET /api/health/worker/pvt` を利用する。旧 `/health/*` 相対 path と未登録 `GET /api/operations/readiness` は使用しない。
- `POST /api/admin/access/users/{userPk}/password-reset` は public route contract から除外されたままとし、web-client の password reset 導線は fail-closed に変更した。
- `/api/orca/queue` と `/api/orca/pusheventgetv2` は public route contract に存在しないため、web-client からの直接 call を停止した。internal/downstream ORCA path の public 流用は行わない。
- server は `GET /api/schedules/{scheduleKey}` で `scheduleKey` を常時返し、結合済み row では `encounterKey` も返す。`GET /api/encounters/{encounterKey}` は常時 `encounterKey` と `scheduleKey` を返す。Reception → Charts の client pass-through も `useAppNavigation` / `AppRouter` / `ReceptionPage` / `ChartsPage` に通っており、`scheduleKey` / `encounterKey` がない受付行は fail-closed、`appointmentId` / `receptionId` / `visitDate` は権威 identity ではなく volatile carryover のまま扱う。
- Charts の `start` は `POST /api/encounters/{encounterKey}/transitions` にのみ接続し、request body は `operation=chart_open` と canonical `patientId` / `karteId` / `requestId` / `traceId` / `idempotencyKey` を送る。`pause` / `finish` は encounter transition に接続しない。`encounterKey` / `patientId` / `karteId` が欠ける場合は fail-closed で止め、server success 前に success toast や `診療中` override を出さない。

## 最新変更（2026-03-15 / ORCA 境界整流と運用 UI 最終形）
- RUN_ID: `20260315T060323Z`
- Charts claim 送信の `medicalmodv2` / `medicalmodv23` は、browser で XML を組み立てず `POST /api/orca/chart-support/medical-mod-v2` / `POST /api/orca/chart-support/medical-mod-v23` の JSON 契約へ統一した。`server-modernized` 側には `OrcaChartSupportResource` と chart-support DTO 群を追加し、XML 組み立て・応答解析は server 側へ集約した。
- 収納情報と帳票発行も JSON 契約へ移行した。web-client は `POST /api/orca/chart-support/income-info` と `POST /api/orca/reports/{type}` を利用し、browser から `/api21/*` `/api01*` `/api/v1/orca/bridge` を直接呼ばない。
- 患者検索は `web-client/src/features/patients/api.ts` と `web-client/src/features/patients/PatientsPage.tsx` で `searchType=name|kana|patient-id|telephone|zipcode` を明示送信する形へ整理した。server 側の暗黙推論に依存せず、検索意図を client 契約へ持ち上げる。
- 患者画面では ORCA 原本/保険/メモの XML 補助 UI を撤去し、患者編集導線は local DB / modernized patient mutation 契約を中心に扱う構成へ整理した。受付画面でも ORCA ユーザー一覧 XML 補助処理を除去し、browser 側 `DOMParser` による physician 名抽出をやめた。
- Administration（設定配信タブ）は `operations` セクションを主導線として追加し、`/health`・`/health/readiness`・`/health/worker/pvt`・WebORCA接続テスト結果を統合表示する通常運用向け UI へ整理した。
- Administration から ORCA XML proxy 前提を除去し、旧 `master-health` / `medicalset` / XML raw 表示導線を廃止した。`OrcaInternalWrapperCard` は JSON payload のみを扱う診断セクションに限定した。
- 運用監視では readiness checks（`database` / `orca` / `attachmentStorage` / `pvtQueue` / `patientImages`）を可視化し、queue 要約とあわせて切替後監視の入口を強化した。
- 不要コード整理として、browser-side XML helper / patient memo・保険・原本参照 API / subjectives・contraindication・medical get・disease get/mod の dead file / `/api/v1/orca/bridge` 前提 / obsolete XML mock を削除した。`server-modernized` 側の未公開 `OrcaBridgeResource` も削除した。
- 検証:
  - `npm -C web-client run typecheck` PASS
  - `npm -C web-client run test -- --run src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx src/features/administration/__tests__/OrcaQueueCard.test.tsx src/features/charts/orcaReportApi.test.ts src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx src/features/charts/__tests__/chartsActionBar.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderBundleItemActions.test.tsx src/features/charts/__tests__/orderBundleBundleNumberUi.test.tsx src/features/charts/__tests__/orderBundleHistoryCopy.test.tsx src/features/patients/__tests__/PatientsPage.test.tsx src/features/reception/__tests__/ReceptionPage.test.tsx src/libs/http/httpClient.test.ts src/features/charts/orderMasterSearchApi.test.ts --silent=true` PASS（13 files / 143 passed, 1 skipped）
  - `mvn -f pom.server-modernized.xml -pl api-contract,server-modernized -Dtest=OperationsHealthResourceTest,OrcaChartSupportResourceTest,OrcaReportDocumentResourceTest,WebXmlEndpointExposureTest -Dsurefire.failIfNoSpecifiedTests=false test` PASS（16 tests）

## 最新変更（2026-02-26 / UIガイドライン適用 第1弾）
- RUN_ID: `20260226T103048Z`
- `docs/web-client/ux/web-client-ui-guideline.md` に沿って、共通基盤と主要画面（ログイン/シェル/受付/患者/管理/カルテ主要導線）のスタイルを先行改修。
- 共通: `global.css` / `app-shell.css` のトークンをガイドライン基準へ更新し、ナビ・主要操作のグラデーション依存を解消。選択状態に下線+太字を併用。
- 画面別: `reception/styles.ts` / `patients/patients.css` / `administration/administration.css` / `charts/styles.ts` を中心に、タブ非ピル化（8px）、カード角丸12px、入力・主要ボタン最小高36px以上へ整理。
- 成果物: `web-client/src/styles/global.css` / `web-client/src/styles/app-shell.css` / `web-client/src/features/reception/styles.ts` / `web-client/src/features/patients/patients.css` / `web-client/src/features/administration/administration.css` / `web-client/src/features/charts/styles.ts`。
- 検証:
  - `npm -C web-client run typecheck` PASS
  - `npm -C web-client run test -- --run src/AppRouter.navigation.test.tsx src/features/reception/__tests__/ReceptionPage.test.tsx src/features/patients/__tests__/PatientsPage.test.tsx src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx src/features/charts/__tests__/patientsTabFilterAndConfirm.test.tsx --silent=true` PASS（5 files / 51 tests）

## 最新変更（2026-02-26 / UIガイドライン整備）
- RUN_ID: `20260226T102426Z`
- Webクライアント全体で参照する UI ガイドライン v0.1 を新規作成し、色/余白/角丸/状態/コンポーネント規約/運用ルールを固定化。
- WCAG に基づく最低基準（文字 4.5:1、非テキスト 3:1、クリック対象 24x24 CSS px）を明記し、改修時のチェック項目として運用開始。
- 成果物: `docs/web-client/ux/web-client-ui-guideline.md` / `docs/web-client/CURRENT.md` / `docs/DEVELOPMENT_STATUS.md`。
- 検証: 文書更新のみ（コード変更なし）。

## 最新変更（2026-02-26）
- RUN_ID: `20260226T024837Z`
- 処方オーダーを `OrderBundleEditPanel` 依存から分離し、`PrescriptionOrderEditorPanel` に置換。右ドック「処方」および中列サマリの処方行クリックで、右ドロワー内の RP集合編集UI が開く構成へ移行。
- `SoapNotePanel` / `RightUtilityDrawer` / `OrderSummaryPane` / `ChartsPage` を更新し、処方のデータ経路を専用化（`prescriptionBundles`）しつつ、注射/処置/検査/算定は既存経路を維持。`prescriptionOrderApi` は `GET/POST /api/orca/prescription-orders` を直接利用するよう変更。
- 右ドロワー内コンテンツ切替へ `translateY + opacity` の下から生えるアニメーションを追加し、非モーダル要件（背景クリック可能・オーバーレイなし）を維持。
- `orderCategoryRegistry` に `resolveOrderEntity` と alias 解決を追加（`prescriptionOrder -> medOrder` 等）し、クライアント/サーバー解釈差の吸収を強化。
- 受け入れ検証（関連）:
  - `npm --prefix web-client run typecheck` PASS
  - `npm --prefix web-client run test -- --run src/features/charts/__tests__/soapNoteRightDockDrawer.test.tsx src/features/charts/__tests__/orderDockPanel.categoryButtons.test.tsx src/features/charts/__tests__/orderBundleBundleNumberUi.test.tsx src/features/charts/__tests__/orderBundleItemActions.test.tsx src/features/charts/__tests__/orderCategoryRegistry.test.ts src/features/charts/__tests__/chartsPageDirtyDot.test.tsx src/features/charts/__tests__/DoCopyDialog.test.tsx src/features/charts/__tests__/chartsOrderDockCoexistence.recovery-order.test.tsx src/features/charts/__tests__/chartsOrcaRecoveryAlert.test.tsx src/features/charts/__tests__/prescriptionOrderEditorPanel.test.tsx --silent=true` PASS（10 files / 45 passed, 1 skipped）。
  - `mvn -pl server-modernized test -DskipITs` PASS（347 tests / 0 failures）。

## 最新変更（2026-02-25）
- RUN_ID: `20260225T140546Z`
- `OrderBundleEditPanel.tsx` を処方/注射の行中心コンパクト配置へ再編。処方は薬剤行+コメント補助行+用法行、注射は薬剤行+コメント行+投与条件行に寄せ、開始日/メモは折りたたみ詳細へ集約。
- 仕様方針を反映: legacy臨時 `291/292` はWeb未実装、注射「手技料なし」は既存どおり `memo` 反映（classCode置換なし）。
- `web-client/src/features/charts/styles.ts` に `charts-side-panel__meta-section` の表示順制御と行中心レイアウトの余白圧縮（RX区分/用法行2列、狭幅時1列）を追加。
- 既存テスト期待を最小修正し、頓用文言差分・「保存して追加する」ラベル差分・行構造セレクタ検証を反映。
- 検証:
  - `npm -C web-client run typecheck` PASS
  - `npm -C web-client run test -- --run src/features/charts/__tests__/orderBundleTwoTableLayout.test.tsx src/features/charts/__tests__/orderBundleMasterSearch.test.tsx src/features/charts/__tests__/orderBundleItemActions.test.tsx src/features/charts/__tests__/orderBundleBundleNumberUi.test.tsx src/features/charts/__tests__/orderDockPanel.categoryButtons.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx --silent=true` PASS。
- RUN_ID: `20260224T213000Z`
- OUI-01〜OUI-05 を `OUI-ID / file / test / KPIイベント` で 1:1 追跡できる監査形式へ統一し、実装詳細ノートを追加。
- 今回の実装結果（RP主軸化・共存ガード・KPI計測・互換維持）を `refactor plan` / `DEVELOPMENT_STATUS` / 本ハブの3点へ正本反映。
- 導線を追加:
  - 計画: `docs/web-client/order-ui/charts-order-ui-refactor-plan-20260224.md`
  - 実装詳細: `docs/web-client/order-ui/charts-order-ui-implementation-trace-20260224.md`
- RUN_ID: `20260224T113000Z`
- Charts オーダーUI再編（OUI-01〜OUI-05）に対する回帰テストを強化。共存シナリオ（右欄編集中の下欄操作・未保存離脱ガード・復帰）と RP 主軸（複数RP連続編集、単独RP保存再編集、単独/複数RP送信）を追加。
- `quick-add/group-add` の `data-test-id` と `onStateChange(hasEditing/targetCategory/count)` の互換テストを維持し、追跡マトリクスへ反映。
- `laboTest`（legacy 検査エンティティ）を `testOrder` 互換で表示できるよう `orderCategoryRegistry` / `OrderDockPanel` を補強し、互換回帰を追加。
- `vitest` 実行時に `localhost` 名前解決へ依存しないよう `vite.config.ts` の test mode で `server.host=127.0.0.1` を明示。
- 最終検証: `npm -C web-client run typecheck` PASS、指定11ファイルテスト PASS（11 files / 97 tests）、追加回帰テスト PASS（3 files / 7 tests）。
- 実装詳細ノートを追加: `docs/web-client/order-ui/charts-order-ui-regression-test-notes-20260224.md`
- RUN_ID: `20260224T100000Z`
- Charts オーダーのカテゴリ/エンティティ定義を `orderCategoryRegistry` に単一化し、処方/注射RPの送信必須項目チェック（Medical_Class / Medical_Class_Number / Medication_info）を追加。
- `OrderDockPanel` / `OrderBundleEditPanel` / `ChartsActionBar` を registry 参照へ統一。quick-add/group-add data-test-id と onStateChange 互換を維持。
- 実装ノートを追加: `docs/web-client/order-ui/charts-order-rp-model-and-category-registry-20260224.md`
- RUN_ID: `20260224T084533Z`
- Charts 右側オーダー欄と下部フローティングの再編方針を、段階導入（短期: 両立 / 中期: 条件付き統合）で計画化。
- 改修追跡ドキュメントを追加: `docs/web-client/order-ui/charts-order-ui-refactor-plan-20260224.md`
- 右側オーダー欄の不要UI削減（段階ラベル・重複操作導線の整理）を前提に、次フェーズの仕様/KPIを明文化。

## 参照優先順位（Webクライアント領域）
1. `docs/DEVELOPMENT_STATUS.md`
2. `AGENTS.md` / `GEMINI.md`
3. 本ファイル
4. 目的別ドキュメント

## 目的別ドキュメント（現行）
### 設計・構成
- `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md`
- `docs/web-client/architecture/web-client-emr-reception-design-20260128.md`
- `docs/web-client/architecture/web-client-emr-charts-design-20260128.md`
- `docs/web-client/architecture/web-client-emr-patients-design-20260128.md`
- `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md`
- `docs/web-client/architecture/web-client-screen-structure-master-plan-20260106.md`
- `docs/web-client/architecture/doctor-workflow-status-20260120.md`
- `docs/web-client/architecture/web-client-api-mapping.md`
- `docs/web-client/architecture/orca-disease-api-mapping.md`
- `docs/web-client/architecture/document-embedded-attachment-policy.md`
- `docs/web-client/architecture/patient-image-management-status-20260120.md`
- `docs/web-client/architecture/order-master-revalidation-20260120.md`
- `docs/web-client/architecture/web-client-navigation-review-20260119.md`
- `docs/web-client/architecture/web-client-navigation-hardening-prerequisites-20260119.md`
- `docs/web-client/architecture/future-web-client-design.md`

### UX / 運用
- `docs/web-client/ux/ux-documentation-plan.md`
- `docs/web-client/ux/web-client-ui-guideline.md`
- `docs/web-client/ux/charts-claim-ui-policy.md`
- `docs/web-client/ux/reception-schedule-ui-policy.md`
- `docs/web-client/ux/patients-admin-ui-policy.md`
- `docs/web-client/ux/config-toggle-design.md`
- `docs/web-client/ux/admin-delivery-validation.md`
- `docs/web-client/ux/playwright-scenarios.md`
- `docs/web-client/ux/order-document-set-fastpath-check-20260120.md`
- `docs/web-client/ux/charts-compact-layout-proposal-20260110.md`
- `docs/web-client/ux/charts-stamp-set-consolidation-20260211.md`
- `docs/web-client/ux/charts-stamp-standalone-management-20260212.md`
- `docs/web-client/ux/charts-order-panel-floating-layout-20260211.md`
- `docs/web-client/ux/charts-order-orca-master-realtime-dropdown-20260211.md`
- `docs/web-client/ux/charts-order-inline-master-suggestions-20260212.md`
- `docs/web-client/ux/charts-semantic-color-system-20260212.md`
- `docs/web-client/ux/reception-status-tab-daily-state-20260211.md`
- `docs/web-client/ux/admin-master-update-console-20260212.md`

### Order UI（現行）
- `docs/web-client/order-ui/charts-order-dock-20260215.md`
- `docs/web-client/order-ui/charts-order-two-table-layout-20260214.md`
- `docs/web-client/order-ui/charts-order-ui-refactor-plan-20260224.md`
- `docs/web-client/order-ui/charts-order-ui-implementation-trace-20260224.md`
- `docs/web-client/order-ui/charts-order-rp-model-and-category-registry-20260224.md`

### ORCA 追加API / 接続計画
- `docs/web-client-orca-additional-api-plan.md`
- `docs/web-client-orca-additional-api-task-prerequisites.md`
- `docs/server-modernization/orca-additional-api-implementation-notes.md`
- ORCAオーダー仕様: `docs/server-modernization/ORCA-order-system-rule.md`
- `docs/server-modernization/orca-api-contract-unification-20260218.md`
- ORCA 接続ルール: `docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md`

### 運用 / デバッグ
- `docs/web-client/operations/debugging-outpatient-bugs.md`
- `docs/web-client/operations/reception-billing-flow-status-20260120.md`
- `docs/web-client/operations/orca-master-bodypart-trial-issue-20260121.md`

### 未活用 / 棚卸し
- `docs/web-client-unused-features.md`

## Legacy / Archive（参照専用）
- `docs/web-client/README.md`（Phase2 Legacy）
- `docs/web-client/planning/phase2/` 配下
- `docs/archive/2025Q4/web-client/` 配下
