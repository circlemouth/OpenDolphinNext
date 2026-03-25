# Hidden Consumer Inventory

作成日: 2026-03-24  
RUN_ID: 20260324T115338Z  
対象: repo 内 consumer のみ  
判定方針: repo 外 consumer は追わない。repo 内 evidence が 0 件なら `no in-repo consumer found` と記載する。

## Candidate: `/api/orca/pusheventgetv2`

repo 内 consumer found:
- `web-client/src/features/outpatient/orcaQueueApi.ts`
- `web-client/src/features/outpatient/__tests__/orcaQueueApi.test.ts`
- `web-client/src/features/shared/chartEventReplayRecovery.ts`
- `web-client/src/mocks/handlers/orcaQueue.ts`
- `docs/legacy-cutover-allowlist.md`
- `docs/web-client/architecture/doctor-workflow-status-20260120.md`

判定:
- active in-repo consumer found
- rename/delete を行う場合は web-client / mocks / docs / tests を同時 cutover する

## Candidate: `/karte/document/pvt/{params}`

repo 内 consumer found:
- `server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java`
- `docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md`
- `docs/server-modernization/server-api-inventory.yaml`
- `docs/server-modernization/server-api-inventory.md`
- `docs/server-modernization/phase2/domains/API_PARITY_MATRIX.md`
- `docs/modernization/p4-01-karte-resource-split.md`

判定:
- web-client direct consumer は grep で確認できず
- repo 内では server/docs inventory consumer のみ
- no in-repo web-client consumer found
- 2026-03-25 時点で public route は削除済み。残る consumer evidence は docs 更新対象のみ

## Candidate: `/api/orca/disease/import/{patientId}`

repo 内 consumer found:
- `web-client/src/features/charts/diseaseApi.ts`
- `docs/web-client/architecture/doctor-workflow-status-20260120.md`
- `docs/web-client/architecture/web-client-emr-charts-design-20260128.md`
- `docs/web-client/architecture/orca-disease-api-mapping.md`
- `docs/legacy-cutover-allowlist.md`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`

判定:
- active in-repo consumer found
- local diagnosis / ORCA live split の cutover 時は web-client と contract docs を同時更新する
- 2026-03-25 時点で web-client consumer は `/api/local-summary/diagnoses/{patientId}` へ切替済み

## Candidate: `/api/orca/disease`

repo 内 consumer found:
- `web-client/src/features/charts/diseaseApi.ts`
- `web-client/src/libs/http/httpClient.ts`
- `docs/web-client/architecture/orca-disease-api-mapping.md`
- `docs/web-client/architecture/doctor-workflow-status-20260120.md`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaDiseaseResourceTest.java`

判定:
- active in-repo consumer found
- bare `diagnosisId` mutation を再公開しない contract に合わせて payload cutover が必要
- 2026-03-25 時点で web-client consumer は `/api/local-summary/diagnoses` へ切替済み

## Candidate: `/api/orca/local-medical/outpatient`

repo 内 consumer found:
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResourceTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `docs/DEVELOPMENT_STATUS.md`

判定:
- repo 内 web-client consumer は grep で確認できず
- no in-repo web-client consumer found
- route rename/delete は server test と docs の更新だけで進められる可能性が高い
- 2026-03-25 時点で public registration から削除済み

## Candidate: `OrcaMedicalOutpatientResource` ORCA 名義 local delegate

repo 内 consumer found:
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalOutpatientResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a3_orca_boundary_design_report.md`

判定:
- repo 内 direct web-client consumer evidence は未確認
- no in-repo web-client consumer found
- 2026-03-25 時点で public registration から削除済み

## Candidate: bare `diagnosisId` mutation

repo 内 consumer found:
- `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/KarteLegacyArtifactSupport.java`
- `web-client/src/features/charts/__tests__/chartOrderSetStorage.test.ts`
- `docs/web-client/architecture/orca-disease-api-mapping.md`

判定:
- public route payload の bare `diagnosisId` 使用は A2 freeze で禁止
- server/session legacy lookup は cutover 対象として inventory 継続

## Candidate: `PatientVisitModel` / PVT cache

repo 内 consumer found:
- `server-modernized/src/main/java/open/dolphin/session/PVTServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/PVTServiceBeanSupport.java`
- `server-modernized/src/main/java/open/dolphin/session/PatientServiceBeanSupport.java`
- `server-modernized/src/main/java/open/dolphin/session/KarteServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/KarteDetailAssemblySupport.java`
- `server-modernized/src/main/java/open/dolphin/session/SystemServiceBean.java`
- `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java`

判定:
- active in-repo consumer found
- CT-H02 cutover 前に専用 inventory が必要

## Conclusion

- hidden consumer inventory 完了前 rename/delete 禁止ルールについて、repo 内証跡の一覧化は完了
- repo 外 consumer は不明だが、repo 内 evidence が 0 件の項目は本書を根拠に待たずに cutover 可
