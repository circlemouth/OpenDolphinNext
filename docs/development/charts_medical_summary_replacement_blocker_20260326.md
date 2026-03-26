# Charts Medical Summary Replacement Blocker Memo

作成日: 2026-03-26
RUN_ID: `20260326T030254Z`
対象 task: `7. Charts medical summary replacement 実装`

## 結論

この blocker は 2026-03-26 の manager-frozen spec により解消済みである。

current branch の formal route は `GET /api/local-summary/encounters/{encounterKey}/medical-summary` に確定し、Charts medical summary replacement は fail-closed placeholder から正式 GET contract へ移行した。

## 判定

- 実装可否: **Go**
- コード変更方針: **server / web-client の formal route 実装へ更新**
- 残存制約: **old blocked route は復活させない**

## 更新後の確定事項

### 1. formal route

- method: `GET`
- exact path: `/api/local-summary/encounters/{encounterKey}/medical-summary`
- canonical request target: `encounterKey` のみ
- `scheduleKey` fallback / dual-key / query parameter は v1 で採用しない

### 2. top-level envelope

- `recordsReturned`
- `outcome`
- `sourcePath`
- `payload.outpatientList`

を維持しつつ、`requestId` / `traceId?` / `runId?` / `fetchedAt` を含む success envelope を返す。

### 3. blocked route は引き続き未公開

- `/api/orca/medical/outpatient`
- `/api/orca/local-medical/outpatient`
- `/api/orca/deptinfo`

はいずれも public exposure に戻していない。

## 確定できた事項

### 1. blocked route は public exposure されていない

- [OpenDolphinRestApplication.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java) には
  `ScheduleResource`、`EncounterResource`、`LocalDiagnosisResource` は登録されているが、
  `OrcaMedicalOutpatientResource` と `OrcaLocalMedicalOutpatientResource` は登録されていない。
- [PublicRouteInventoryContractTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java) は
  `POST /api/orca/medical/outpatient`、
  `POST /api/orca/local-medical/outpatient`、
  `GET /api/orca/deptinfo`
  を blocked route として固定している。
- [WebXmlEndpointExposureTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java) は
  `open.dolphin.rest.orca.OrcaMedicalOutpatientResource` と
  `open.dolphin.rest.orca.OrcaLocalMedicalOutpatientResource`
  が application に登録されていないことを検証している。

### 2. Charts 側は replacement route 不在を前提に placeholder へ固定済み

- [web-client/src/features/charts/api.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/api.ts) は
  `buildUnavailableMedicalSummary()` で
  `recordsReturned=0`、
  `outcome='MISSING'`、
  `sourcePath='contract_removed'`、
  `payload.outpatientList=[]`
  を返す。
- 同ファイルの `fetchChartsMedicalSummary()` は server route を叩かず、その placeholder を audit / observability に流す実装である。

### 3. canonical key feed は task 6 までで成立している

- [public_route_key_feed_contract_20260326.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/development/public_route_key_feed_contract_20260326.md) により、
  `scheduleKey` / `encounterKey` は server 供給、client pass-through、key 無しでは fail-closed が確定している。
- [ScheduleResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java) と
  [EncounterResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/EncounterResource.java)
  が canonical key read route として public 登録されている。

## 確定できなかった事項

### 1. exact formal path

current branch の source には、Charts medical summary replacement として public exposure された route が存在しない。

- `local-summary` namespace で public 登録されているのは
  [LocalDiagnosisResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java)
  の `/api/local-summary/diagnoses` のみ。
- `OrcaMedicalOutpatientResource` と `OrcaLocalMedicalOutpatientResource` は class 自体は残っているが、
  public 登録から外されており replacement 候補には使えない。
- [web_client_contract_followup_checklist.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/development/web_client_contract_followup_checklist.md) は
  「現 bundle には local outpatient summary replacement route が見当たらない」「route を推測しない」と明記している。

### 2. canonical request target

`scheduleKey` 主体か `encounterKey` 主体か、あるいは両対応かを source から確定できない。

- public に存在する key read route は `/api/schedules/{scheduleKey}` と `/api/encounters/{encounterKey}` のみで、
  medical summary replacement の request contract は未定義。
- Charts placeholder 実装も key を query param / path に載せる route 契約をまだ持っていない。

### 3. 404 / 409 / 5xx structured error contract

共通 error envelope 自体は [RestExceptionMapper.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/RestExceptionMapper.java)
と [AbstractResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/AbstractResource.java) で存在するが、
**medical summary replacement 専用** の 404 / 409 / 5xx contract は source に未定義。

- 404 の対象不在条件
- 409 の trigger
- 409 用 error code enum
- 5xx の local projection/read model failure の表現

はいずれも route 実装または contract test が無いため未確定。

### 4. `outpatientList[]` の最小 item / section schema

[MedicalOutpatientResponse.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/api-contract/src/main/java/open/dolphin/rest/dto/outpatient/MedicalOutpatientResponse.java)
には DTO が残っているが、これは blocked route 側の残存 DTO であり、public replacement route の schema として凍結されていない。

`MedicalOutpatientRecordPanel` と
[medicalOutpatient.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/medicalOutpatient.ts)
が受理できる shape は推定できるが、それを public contract と断定する source は current branch に無い。

## 根拠ファイル

- [OpenDolphinRestApplication.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java)
- [PublicRouteInventoryContractTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java)
- [WebXmlEndpointExposureTest.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java)
- [LocalDiagnosisResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java)
- [OrcaMedicalOutpatientResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalOutpatientResource.java)
- [OrcaLocalMedicalOutpatientResource.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java)
- [MedicalOutpatientResponse.java](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/api-contract/src/main/java/open/dolphin/rest/dto/outpatient/MedicalOutpatientResponse.java)
- [web-client/src/features/charts/api.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/api.ts)
- [web-client/src/features/charts/medicalOutpatient.ts](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/web-client/src/features/charts/medicalOutpatient.ts)
- [docs/development/web_client_contract_followup_checklist.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/development/web_client_contract_followup_checklist.md)
- [docs/development/public_route_contract_matrix_20260325.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/development/public_route_contract_matrix_20260325.md)
- [docs/development/public_route_key_feed_contract_20260326.md](/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient/docs/development/public_route_key_feed_contract_20260326.md)

## 必要な意思決定

manager decision により本 memo の未決事項は解消済み。以後の変更は current code truth と contract test を正本として扱う。

## 現 branch で維持すべきこと

- guessed endpoint を追加しない
- `/api/orca/medical/outpatient` を復活させない
- `/api/orca/local-medical/outpatient` を復活させない
- ORCA namespace 配下に replacement route を作らない
- canonical key 無しで patient/day fallback 解決しない
- placeholder envelope
  - `recordsReturned`
  - `outcome`
  - `sourcePath`
  - `payload.outpatientList`
  を崩さない
