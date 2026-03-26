# A2 Public Contract Freeze

作成日: 2026-03-24  
RUN_ID: 20260324T115338Z  
根拠:
- `docs/development/phase2_current_coding_tasks_checklist_v1.md`
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a1_contract_freeze_pack_v1.md`
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a1_handoff_ticket_seed.csv`
- `docs/development/supporting/phase2a_handoff_docs_bundle/phase2a_a3_orca_boundary_design_report.md`

## 目的

CT-H 着手条件として、public contract の repo 内正本を固定する。後方互換は考慮しない。alias / dual support / compat key は作らない。

## Namespace

- `schedule`
- `encounter`
- `local-summary`
- `orca-live`

ルール:
- ORCA 名義 route は ORCA live だけを返す
- local projection は ORCA namespace に置かない
- one-route-one-schema
- JSON-only
- `"0"` / `null` / magic code を成功契約に使わない

## Request Correlation

- すべての mutation / transition は `requestId` と `traceId` を扱う
- 冪等な mutation / transition は `idempotencyKey` を扱う
- correlation は request edge から audit / transition persistence まで通す

## Common Error JSON

最低 fields:
- `code`
- `message`
- `httpStatus`
- `traceId`
- `requestId`

HTTP status:
- `401`
- `403`
- `404`
- `409`
- `422`
- `5xx`

ルール:
- 内部例外詳細、stack trace、SQL、内部 URL は返さない
- 業務エラーと transport/system error を JSON で明示分離する

## Canonical Keys

- `scheduleKey = facilityId + ":" + orcaAppointmentId`
- `encounterKey = facilityId + ":" + orcaAcceptanceId`

禁止:
- `patient + day`
- `patient + pvtDate`
- bare numeric identifier を public mutation key に使うこと

## Business States

- `scheduled`
- `checked_in`
- `chart_opened`
- `billed`
- `cancelled`

ルール:
- raw int bit state は public contract から除去する
- `owner` / `memo` / `hurry` / `go_out` / `notupdate` / `byomeiCount` は business state ではなく metadata

## Transition Command

正規 mutation:
- `POST /encounters/{encounterKey}/transitions`

payload minimum:
- `operation`
- `facilityId`
- `patientId`
- `karteId`
- `encounterKey`
- `requestId`
- `traceId`
- `idempotencyKey`

ルール:
- document save route は encounter transition を兼務しない
- mutation failure は common error JSON を返す
- best-effort state update を禁止する

## Live / Local Separation

- ORCA live disease view と local diagnosis を分離する
- ORCA live outpatient と local outpatient summary を分離する
- local route 名には `local` / `chart` / `projection` のいずれかを含める
- ORCA route は local fallback を返さない
- DTO / service / route の共有は禁止

## Delete-First / Rename-First Policy

delete-first:
- raw PVT state write route
- `/document/pvt/{params}` の結合 route
- public disease mutation の bare `diagnosisId` 契約

rename-first:
- ORCA 名義 local outpatient route
- `PatientModV2OutpatientResource operation=create` の import 名義
- `PVT` / `visit` / `encounter` 混在命名

制約:
- hidden consumer inventory 完了前に public route rename/delete をしない
- consumer inventory 完了後は alias を残さず cutover する

## Mutation Scope

- patient-scoped read/write: `facilityId + patientId`
- karte-scoped write: `facilityId + patientId + karteId`
- encounter-scoped write: `facilityId + patientId + karteId + encounterKey`
- diagnosis / document / attachment mutation: `facilityId + patientId + karteId + targetId`

禁止:
- bare `diagnosisId` mutation の public 再公開
- `password reset` の public 再公開

## Explicit Separation Rule

- document save と encounter transition は分離する
- encounter transition と ORCA live mutation は分離する
- local projection update は ORCA live response の副作用として public contract に混在させない

## Repo Evidence

- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java` は現行 public route inventory を持つ
- `server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java` は `GET /api/schedules/{scheduleKey}` を公開する
- `server-modernized/src/main/java/open/dolphin/rest/EncounterResource.java` は `GET /api/encounters/{encounterKey}` と `POST /api/encounters/{encounterKey}/transitions` を公開する
- `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java` は `GET/POST /api/local-summary/diagnoses...` を公開する
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java` は ORCA live disease master lookup を `orca-live` namespace に限定する
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java` は `PVTResource` / `PatientModV2OutpatientResource` / `/karte/document/pvt/{*}` が public registration から外れたことを検証する

## A2 Freeze Statement

以後の public contract は本書を正本とする。CT-H01〜CT-H04 は、本書と `docs/development/hidden_consumer_inventory.md` を根拠に rename/delete/cutover を実行してよい。

## 2026-03-26 Current Public Route Freeze

- authoritative public route:
  - `GET /api/health`
  - `GET /api/health/readiness`
  - `GET /api/health/worker/pvt`
  - `GET /api/schedules/{scheduleKey}`
  - `GET /api/encounters/{encounterKey}`
  - `POST /api/encounters/{encounterKey}/transitions`
  - `GET /api/admin/access/users`
  - `POST /api/admin/access/users`
  - `PUT /api/admin/access/users/{userPk}`
- blocked / intentionally unavailable:
  - `GET /api/operations/readiness`
  - `POST /api/admin/access/users/{userPk}/password-reset`
  - `GET /api/orca/queue`
  - `DELETE /api/orca/queue`
  - `POST /api/orca/pusheventgetv2`
- handoff 決定事項:
  - Reception -> Charts の今後の public contract は `scheduleKey` / `encounterKey` を正本とする。
  - `appointmentId` / `receptionId` / `visitDate` の carryover は次タスクで置換対象とし、現行 task では key 生成を client へ逃がさない。
