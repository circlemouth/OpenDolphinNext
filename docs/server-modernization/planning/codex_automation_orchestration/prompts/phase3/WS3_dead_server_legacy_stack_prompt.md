# Codex Prompt: WS3 dead server legacy resource stack 削除

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読み、`WS3` を実装してください。

## ミッション
runtime から外れている未登録 resource / helper / unit test を delete-first で整理する。ただし current registered route で使う code は消さない。

## サブエージェント指示
- subagent A: `PublicRouteInventoryContractTest` / `WebXmlEndpointExposureTest` から「未登録前提 class 一覧」を抽出
- subagent B: 各 dead resource の usage と専用 helper/test の到達性を調べ、削除候補を分類
- subagent C: 最小パッチと target Maven test セットを提案

## 実装ガード
- `/api/operations/readiness` を resurrect しない。
- blocked outpatient/local-medical route を revive しない。
- `LegacyOrcaResponseMapper` のように current route でも使う helper は消さない。
- broad ORCA modernization には広げない。

## 最低限見るべきファイル
- `server-modernized/src/main/java/open/dolphin/rest/OperationsReadinessResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsReadinessResourceTest.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalOutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
- `server-modernized/src/main/java/open/orca/rest/OrcaResource.java`
- `server-modernized/src/main/java/open/orca/rest/OrcaFacilityResource.java`
- `server-modernized/src/main/java/open/orca/rest/OrcaPatientDiseaseResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`

## 完了条件
- dead resource stack が削除される
- contract tests が green
- 変更した class / test / helper の一覧が最終報告に残る
