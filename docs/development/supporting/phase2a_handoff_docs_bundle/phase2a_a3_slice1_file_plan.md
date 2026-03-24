# Phase2-A3 Slice-1 ファイル計画

## 目的
facility explicit compile-break を最初に入れ、ORCA runtime path から implicit/default/session/MDC facility を抜く。

## 変更対象（優先順）

### 1. ORCA transport contract
- `src/main/java/open/dolphin/orca/transport/OrcaTransport.java`
  - `invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request)` へ変更
- `src/main/java/open/dolphin/orca/transport/RestOrcaTransport.java`
  - `resolveFacilityId()` / `requireResolvedFacilityId()` / MDC 依存削除
  - `currentSettings(facilityId)` / `rawHttpClient(facilityId)` を明示 facility 前提へ統一
- `src/main/java/open/dolphin/orca/transport/OrcaTransportRegistry.java`
  - runtime path の null/default facility fallback を禁止

### 2. ORCA live gateway
- `src/main/java/open/dolphin/orca/service/OrcaWrapperService.java`
  - facility 必須 API に変更
  - 可能なら `OrcaLiveGateway` へ rename
- `src/main/java/open/dolphin/orca/service/OrcaWrapperServiceSupport.java`
  - facility 非依存 helper に限定

### 3. facility を持つ caller の追随
- `src/main/java/open/dolphin/orca/adapter/DefaultOrcaPatientAdapter.java`
- `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncService.java`
- `src/main/java/open/dolphin/rest/PatientModV2OutpatientOrcaCoordinator.java`
- `src/main/java/open/dolphin/orca/push/ReceptionPushHandler.java`
- `src/main/java/open/dolphin/orca/push/MedicalPushHandler.java`
- `src/main/java/open/dolphin/orca/push/OrcaPushRecoveryService.java`

### 4. request-edge resources
- `src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java`
- `src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- `src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- `src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java`

### 5. tests
- `src/test/java/open/dolphin/orca/transport/RestOrcaTransportTest.java`
- `src/test/java/open/dolphin/orca/service/OrcaWrapperServiceFailClosedTest.java`
- `src/test/java/open/dolphin/orca/sync/OrcaPatientSyncServiceTest.java`
- push handler 関連 test 一式

## Slice-1 完了条件
- ORCA runtime path の public method が facility 必須になっている
- transport が request/session/MDC から facility を引かない
- null/default facility で compile または runtime fail-fast する
- push/sync/recovery が facility を call stack 上で保持したまま ORCA call できる
