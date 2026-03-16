# Legacy Cutover Allowlist

- RUN_ID: `20260309T145604Z`
- Source of truth: `web-client/src/**` の production code
- 除外: `__tests__`, `mocks`, `artifacts`, `notes`, `dist`, `node_modules`, `target`
- 方針:
  - 現行 web-client が実際に呼ぶ path を keep とする
  - mock 専用 suffix (`/mock`) と削除済み legacy console のみが触る path は keep 根拠にしない
  - 「古そうな名前」でも production code が使っていれば keep する

## Keep Paths

| Path | Production source file(s) | Keep reason |
| --- | --- | --- |
| `/api/session/login`, `/api/session/login/factor2`, `/api/session/me` | `web-client/src/LoginScreen.tsx`, `web-client/src/AppRouter.tsx` | 現行ログイン/セッション維持の正規契約 |
| `/api/logout` | `web-client/src/AppRouter.tsx` | 現行ログアウト処理 |
| `/user/{userId}` | `web-client/src/features/charts/stampApi.ts` | スタンプ編集で userPk を引く current flow |
| `/stamp/tree/{userPk}`, `/stamp/id/{stampId}` | `web-client/src/features/charts/stampApi.ts` | スタンプ一覧/詳細の current flow |
| `/chart-events` | `web-client/src/libs/sse/chartEventStream.ts` | 現行 SSE 契約。`/chartEvent` とは別物 |
| `/api/orca/queue` | `web-client/src/features/outpatient/orcaQueueApi.ts`, `web-client/src/features/charts/pages/ChartsPage.tsx` | ORCA 送信状態監視/再送 |
| `/api/orca/pusheventgetv2` | `web-client/src/features/outpatient/orcaQueueApi.ts` | ORCA push event 取得 |
| `/api/orca/appointments/list`, `/api/orca/visits/list` | `web-client/src/features/reception/api.ts`, `web-client/src/features/charts/ChartsActionBar.tsx` | 受付/チャート共通の current outpatient flow |
| `/api/orca/patients/name-search`, `/api/orca/patients/import` | `web-client/src/features/reception/patientSearchApi.ts`, `web-client/src/features/outpatient/orcaPatientImportApi.ts` | 受付 patient search/import |
| `/api/orca/patients/local-search` | `web-client/src/features/patients/api.ts` | 患者一覧のローカル検索 |
| `/api/orca/patient/mutation` | `web-client/src/features/patients/api.ts`, `web-client/src/features/charts/PatientInfoEditDialog.tsx` | 患者更新 current contract |
| `/api/orca/patientgetv2`, `/orca/patientlst7v2`, `/orca/insuranceinf1v2` | `web-client/src/features/patients/patientOriginalApi.ts`, `web-client/src/features/patients/patientMemoApi.ts`, `web-client/src/features/patients/insuranceApi.ts` | ORCA 患者/保険 current flow |
| `/api/orca/medical/outpatient` | `web-client/src/features/charts/api.ts`, `web-client/src/features/reception/api.ts` | 現行 outpatient medical summary |
| `/api/orca/chart-support/medical-mod-v2`, `/api/orca/chart-support/medical-mod-v23` | `web-client/src/features/charts/orcaClaimApi.ts`, `web-client/src/features/charts/orcaMedicalModApi.ts` | ORCA claim/medical write current contract |
| `/orca/medicalgetv2`, `/orca/tmedicalgetv2`, `/orca/incomeinfv2`, `/orca/contraindicationcheckv2` | `web-client/src/features/charts/orcaMedicalGetApi.ts`, `web-client/src/features/charts/orcaIncomeInfoApi.ts`, `web-client/src/features/charts/contraindicationCheckApi.ts` | 現行 charts ORCA 参照系 |
| `/api01rv2/subjectiveslstv2`, `/orca25/subjectivesv2`, `/api/orca/chart/subjectives` | `web-client/src/features/charts/soap/subjectivesApi.ts`, `web-client/src/features/charts/soap/subjectiveChartApi.ts`, `web-client/src/features/administration/orcaInternalWrapperApi.ts` | 主訴一覧/登録の current flow |
| `/api/orca/disease`, `/api/orca/disease/name/{param}/`, `/api/orca/disease/import/{patientId}`, `/orca/diseasegetv2` | `web-client/src/features/charts/diseaseApi.ts`, `web-client/src/features/charts/orcaDiseaseGetApi.ts` | 病名 current flow |
| `/api/orca/order/bundles`, `/api/orca/prescription-orders` | `web-client/src/features/charts/orderBundleApi.ts`, `web-client/src/features/charts/prescriptionOrderApi.ts` | 現行オーダー編集 |
| `/api/orca/master/reference/status` | `web-client/src/features/charts/masterReferenceStatusApi.ts` | ORCA master 参照状態監視 |
| `/api/orca/master/address`, `/api/orca/master/hokenja`, `/api/orca/master/generic-price`, `/api/orca/master/drug`, `/api/orca/master/generic-class`, `/api/orca/master/youhou`, `/api/orca/master/material`, `/api/orca/master/kensa-sort`, `/api/orca/master/etensu`, `/api/orca/master/comment`, `/api/orca/master/bodypart` | `web-client/src/features/patients/orcaAddressApi.ts`, `web-client/src/features/patients/orcaHokenjaApi.ts`, `web-client/src/features/charts/orcaGenericPriceApi.ts`, `web-client/src/features/charts/orderMasterSearchApi.ts` | 現行 master search/current ORCA 契約 |
| `/orca/systeminfv2`, `/orca/system01dailyv2`, `/orca/acceptlstv2`, `/orca/system01lstv2`, `/orca/insprogetv2` | `web-client/src/features/administration/api.ts`, `web-client/src/features/administration/orcaXmlProxyApi.ts` | 現行 administration/QA 導線 |
| `/api/orca101/manageusersv2`, `/api/orca102/medicatonmodv2`, `/api/orca21/medicalsetv2`, `/api/orca51/masterlastupdatev3` | `web-client/src/features/administration/orcaXmlProxyApi.ts`, `web-client/src/features/administration/api.ts`, `web-client/src/features/reception/pages/ReceptionPage.tsx` | 現行 administration/reception ORCA 契約 |
| `/api/admin/config`, `/api/admin/delivery`, `/api/admin/access/users`, `/api/admin/master-updates/*`, `/api/admin/orca/connection`, `/api/admin/orca/connection/test`, `/api/admin/orca/users`, `/api/admin/orca/sync`, `/api/admin/users/{ehrUserId}/orca-link` | `web-client/src/features/administration/api.ts`, `web-client/src/features/administration/accessManagementApi.ts`, `web-client/src/features/administration/masterUpdateApi.ts`, `web-client/src/features/administration/orcaConnectionApi.ts`, `web-client/src/features/administration/orcaUserAdminApi.ts` | 現行 administration current flow |
| `/api/orca/medical-sets`, `/api/orca/birth-delivery`, `/api/orca/medical/records`, `/api/orca/patient/mutation`, `/api/orca/chart/subjectives` | `web-client/src/features/administration/orcaInternalWrapperApi.ts` | 管理画面の現行 ORCA wrapper 導線 |
| `/karte/image/{id}`, `/karte/attachment/{id}`, `/karte/document`, `/patients/{patientId}/images` | `web-client/src/features/images/api.ts`, `web-client/src/features/images/patientImagesApi.ts` | 画像 current flow |
| `/karte/freedocument`, `/karte/pid/{patientId},{fromDate}`, `/karte/revisions*`, `/karte/safety/{karteId}`, `/karte/rpHistory/list/{karteId}` | `web-client/src/features/charts/patientFreeDocumentApi.ts`, `web-client/src/features/charts/revisions/revisionWriteApi.ts`, `web-client/src/features/charts/revisions/revisionHistoryApi.ts`, `web-client/src/features/charts/karteExtrasApi.ts`, `web-client/src/features/charts/letterApi.ts` | Karte/current revision and letter flow |
| `/odletter/list/{karteId}`, `/odletter/letter*` | `web-client/src/features/charts/letterApi.ts` | 現行紹介状/文書 current flow |
| `/blobapi/{dataId}` | `web-client/src/features/charts/orcaReportApi.ts`, `web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx` | ORCA 帳票 PDF 取得 current flow |
| `/orca/prescriptionv2`, `/orca/medicinenotebookv2`, `/orca/karteno1v2`, `/orca/karteno3v2`, `/orca/invoicereceiptv2`, `/orca/statementv2` | `web-client/src/features/charts/orcaReportApi.ts` | 現行帳票出力 |

## Remove Aliases / Legacy Resources

| Remove target | Keep target | Reason |
| --- | --- | --- |
| `/orca/master/*` | `/api/orca/master/*` | production code は `/api/orca/master/*` のみ使用 |
| `/patient` | なし | 現行 web-client 参照なし |
| `/lab` | なし | 現行 web-client 参照なし |
| `/reporting/karte` | なし | 現行 web-client 参照なし |
| `/chartEvent` | `/chart-events` | SSE current contract は `/chart-events` のみ |
| `/pvt2` | なし | 現行 web-client 参照なし |
| `/schedule` | `/api/admin/master-updates/schedule` | 現行利用は admin master update の schedule のみ |
| `/serverinfo` | なし | 現行 web-client 参照なし |
| `/touch/*` | なし | production code の current contract に不要。legacy console も削除済み |
| `facilityId` header fallback | `X-Facility-Id` | 現行 header 契約は `X-Facility-Id` のみ |
| single-record ORCA config JSON | `records` 形式 | 現行 multi-facility config のみサポート |

## Notes

- `/orca/.../mock` 系は MSW/検証専用であり、server keep 判定の根拠に含めない。
- `debug/legacy-rest` 導線と `LegacyRestPanel` は本 allowlist 作成と同時に削除した。
- `touch`, `adm10`, `adm20` は current flow からの import を禁止対象とし、allowlist 外 resource と同様に切り落とす。
