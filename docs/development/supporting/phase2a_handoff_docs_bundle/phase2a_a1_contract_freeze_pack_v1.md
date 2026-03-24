# Phase2-A1 Contract Freeze Pack v1

> Note: This file was reconstructed on 2026-03-24 from the available A1 design source (`phase2a_a1_business_state_machine_design.md`) and the manager-facing A1 completion summary in this workspace because the original artifact file was not present in `/mnt/data` at packaging time.

作成日: 2026-03-24  
対象: Phase2-A1 handoff pack  
前提: 後方互換は考慮しない。dangerous path stopgap は戻さない。

---

## 1. Freeze summary

この pack で次を正本として固定する。

1. **正本境界**
   - ORCA 正本: patient basic / insurance / appointment / reception / visit / billed / cancelled / ORCA master
   - local 正本: chart / document / attachment / local diagnosis / UI projection / worklist metadata
   - ORCA live view と local projection は同一 route / 同一 DTO / 同一 service に混在させない

2. **canonical key**
   - `scheduleKey = facilityId + orcaAppointmentId`
   - `encounterKey = facilityId + orcaAcceptanceId`
   - `patient + day` / `patient + pvtDate` を encounter identity に使わない

3. **business state machine**
   - business state は `scheduled / checked_in / chart_opened / billed / cancelled`
   - raw int bit state は public contract から除去する
   - `owner / memo / hurry / go_out / notupdate / byomeiCount` などは business state ではなく worklist metadata に分離する

4. **command separation**
   - `document save` と `encounter transition` は別 command
   - document save は encounter state を best-effort 更新しない
   - external contract としては明示 transition command を用いる

5. **facility / scope / auth**
   - ORCA 境界は facility explicit
   - bare numeric ID のみで mutation しない
   - encounter-scoped write は `facilityId + patientId + karteId + encounterKey`
   - diagnosis / document / attachment mutation は `facilityId + patientId + karteId + targetId`

---

## 2. API freeze for handoff to A2

### 2.1 namespace policy

A2 は少なくとも次の namespace 境界を前提に API contract を起票する。

- `schedule`
- `encounter`
- `local-summary`
- `orca-live`

ルール:
- ORCA 名義 route は ORCA live のみを返す
- local summary / local diagnosis / local worklist は ORCA namespace に置かない
- one-route-one-schema
- JSON-only
- `"0"` / `null` / magic code を成功/失敗契約に使わない
- 401/403/404/409/422/5xx を JSON で返す
- requestId / traceId / idempotencyKey を持つ

### 2.2 transition command policy

state transition は明示 command に寄せる。

- `POST /encounters/{encounterKey}/transitions`
- document save route は encounter transition を兼務しない
- mutation failure は JSON error

### 2.3 live vs local separation

- ORCA live disease view と local diagnosis を分離
- ORCA live outpatient と local outpatient summary を分離
- local projection route 名には local / chart / projection を明示する

---

## 3. Delete-first / rename-first policy

### 3.1 delete-first candidates

- raw PVT state write route
- `/document/pvt/{params}` の結合 route
- public disease mutation の bare `diagnosisId` 契約

### 3.2 rename-first candidates

- ORCA 名義 local outpatient route
- `PatientModV2OutpatientResource operation=create`（実質 import）
- `PVT` / `visit` / `encounter` の混在命名

### 3.3 rules

- hidden consumer inventory 完了前に public route rename/delete を実行しない
- dangerous path stopgap を戻さない
- dual support / alias route / compat key を作らない

---

## 4. Minimum data model handoff to A4

A4 は少なくとも次を表現できる schema を設計する。

### 4.1 schedule_projection
- facilityId
- scheduleKey
- patientId
- karteId (nullable)
- orcaAppointmentId
- scheduledDateTime
- departmentCode
- physicianCode
- state (`scheduled|cancelled`)
- linkedEncounterKey
- sourceUpdatedAt
- projectedAt

### 4.2 encounter_projection
- facilityId
- encounterKey
- patientId
- karteId
- scheduleKey (nullable)
- orcaAcceptanceId
- acceptanceDateTime
- businessState (`checked_in|chart_opened|billed|cancelled`)
- chartOpenedAt
- billedAt
- cancelledAt
- ownerUserId (nullable, businessState と別)
- memo (nullable)
- worklistFlags
- lastOrcaSyncAt
- stateVersion

### 4.3 encounter_transition_log / reconciliation_task
- facilityId
- encounterKey
- operation
- requestId
- traceId
- idempotencyKey
- attemptCount
- lastError
- reconciliationRequired
- updatedAt

### 4.4 immutable snapshot minimum
- insuranceSnapshot
- patientDisplaySnapshot
- document linkage metadata

---

## 5. Handoff to A5

A5 は少なくとも次を受け取る。

### 5.1 composite scope
- patient-scoped read/write: `facilityId + patientId`
- karte-scoped write: `facilityId + patientId + karteId`
- encounter-scoped write: `facilityId + patientId + karteId + encounterKey`
- diagnosis / document / attachment mutation: `facilityId + patientId + karteId + targetId`

### 5.2 request correlation
- requestId
- traceId
- idempotencyKey

### 5.3 audit taxonomy (minimum)
- `schedule.projected`
- `encounter.checked_in`
- `encounter.chart_opened`
- `encounter.transition_rejected`
- `document.saved`
- `encounter.billing_requested`
- `encounter.billed`
- `encounter.cancel_requested`
- `encounter.cancelled`
- `projection.reconcile_required`
- `patient.synced_from_orca`

ルール:
- audit payload に clinical free text / document body / raw query / tokens / secrets を入れない
- business key / actor / request correlation を優先する

---

## 6. Alignment with A3

A3 とは次で整合している。

- facility explicit
- ORCA live / local projection 分離
- `OrcaWrapperService` から `OrcaLiveGateway` 方向への整理
- hidden consumer 未棚卸しの rename 保留
- default/session/MDC facility 依存を ORCA runtime path に戻さない

---

## 7. Open blockers intentionally left unresolved in A1

A1 では次を閉じない。blocker として次工程へ送る。

1. ORCA appointment / acceptance field 契約
2. billed の canonical ORCA source
3. cancel 後 signed document の扱い
4. hidden consumer inventory
5. `PatientVisitModel` / 既存 PVT cache の置換方針

---

## 8. Acceptance handoff statement

A1 の割当としては、正本境界 / canonical key / business state machine / command separation / API freeze 前提 / A4 minimum data model / A5 auth-audit handoff 条件は固定済みとする。  
次工程は、この pack を正として A2 / A4 / A5 を進めてよい。
