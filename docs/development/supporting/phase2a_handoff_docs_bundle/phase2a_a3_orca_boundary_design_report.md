# Phase2-A3 ORCA 境界 / facility / sync 設計レポート

## 1. Executive Summary

A3 を開始した。

今回の supplied snapshot を source inspection した結果、dangerous path stopgap の目的だった **prod-like での停止** は概ね達成されている。一方で、恒久設計としては ORCA 境界がまだ不十分で、特に次の 4 点が A3 の主対象である。

1. **facility が ORCA 境界の第一級引数になっていない**  
   `OrcaWrapperService` と `OrcaTransport` が facility を引数で受けず、`RestOrcaTransport` が `SessionTraceManager` / MDC / composite actor から暗黙解決している。背景ジョブや push/recovery ではこの前提が壊れる。

2. **ORCA live と local projection が分離されていない**  
   `OrcaMedicalOutpatientResource` は `OrcaLocalMedicalOutpatientResource` の delegate であり、ORCA 名義の route が local 集約結果を返す。`OrcaDiseaseResource` の import も ORCA live read ではなく local diagnosis read に依存している。

3. **push / recovery / sync が truthful state model になっていない**  
   dedup は apply 成功前に確定し、state store は施設単位の last-* 情報しか持たない。`received / fetched / applied / failed` の分離がなく、per-facility cursor も未成立。

4. **facility-native 化されていない ORCA 関連 link / runtime state が残っている**  
   `d_orca_user_link` は facility を列として持たず、`orca_user_id` が全体 unique。multi-facility 本番の前提と合わない。

A3 の target は、**「facility explicit」「ORCA live/local 分離」「truthful state model」「default/session/MDC 依存除去」** を実装可能な設計に固定すること。

## 2. Target Design

### 2.1 ORCA 境界の canonical layering

A3 の target layering を次に固定する。

- **Request edge / admin edge**
  - facility を受け取る最上流。
  - default facility を扱ってよい唯一の境界。
- **Application service / adapter / scheduler / push / recovery**
  - facility を必須引数で受ける。
  - default facility / session / MDC から facility を引かない。
- **ORCA live gateway**
  - ORCA read/write を行う唯一の境界。
  - facility 必須。
  - fail-closed。
- **Local projection service**
  - local DB / UI projection を返す境界。
  - ORCA live と namespace も service 名も分離する。

### 2.2 新しい service contract

#### Transport

```java
public interface OrcaTransport {
    OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request);
}
```

- `facilityId` は必須。
- `SessionTraceManager` / MDC から facility を引く処理は transport から削除する。
- traceId / requestId / actorId は audit 用 context として別管理にする。

#### Live gateway

`OrcaWrapperService` は名称と責務が曖昧なので、A3 target では **`OrcaLiveGateway`** に置き換える。

```java
public interface OrcaLiveGateway {
    PatientBatchResponse getPatientBatch(String facilityId, PatientBatchRequest request);
    PatientIdListResponse getPatientIdList(String facilityId, PatientIdListRequest request);
    PatientSearchResponse searchPatients(String facilityId, PatientNameSearchRequest request);
    VisitMutationResponse mutateVisit(String facilityId, VisitMutationRequest request);
    AppointmentMutationResponse mutateAppointment(String facilityId, AppointmentMutationRequest request);
    // ... other live ORCA operations
}
```

- ORCA live read/write はすべて facility 必須。
- `OrcaWrapperService` の current API は delete-first 対象。
- request thread では resource が facility を resolve して渡す。
- background path では scheduler / push client / recovery runner が facility を保持して渡す。

#### Local projection service

ORCA 名義の local view をやめ、local projection service を分離する。

```java
public interface OutpatientProjectionService {
    MedicalOutpatientResponse getLocalOutpatient(String facilityId, LocalDate targetDate);
}
```

```java
public interface DiseaseProjectionService {
    DiseaseImportResponse getLocalDiseaseProjection(String facilityId, String patientId, DateRange range, boolean activeOnly);
}
```

- route 名・resource 名に `Orca` を含めない。
- A2 で public path を確定するが、A3 で service boundary を先に固定する。

### 2.3 ORCA live / local projection の分離ルール

A3 で固定する分離ルールは次のとおり。

- **ORCA live**
  - source of truth は ORCA。
  - ORCA 障害時は 5xx / gateway error。
  - local fallback を返さない。
  - synthetic visit / synthetic outpatient / synthetic disease を返さない。
- **local projection**
  - source of truth は local projection。
  - ORCA availability を前提にしない。
  - ORCA 名義 DTO / endpoint / audit action を使わない。

これにより、`ORCA live view` と `local view` を DTO 名・service 名・path の全てで分離する。

### 2.4 Sync の target model

`OrcaPatientSyncService` は責務を分割する。

- **`OrcaPatientImportService`**
  - facility + patientIds の on-demand import。
  - patientlst2v2 / detail fetch / local upsert。
- **`OrcaPatientSyncPlanner`**
  - facility ごとの増分範囲と cursor を決める。
- **`OrcaPatientSyncRunner`**
  - planner が出した work を実行する。
- **`OrcaPatientSyncCursorStore`**
  - per-facility cursor を保持する。
- **`OrcaSyncRunStore`**
  - run 単位の truthful state を保持する。

#### Sync cursor

A3 では patient sync cursor を `last_sync_date` だけで終わらせない。

最低限、次を run と分離して保持する。

- facilityId
- streamKind (`patient_sync`)
- cursorType (`date` / 将来 token 対応可)
- cursorValue
- lastAppliedRunId
- updatedAt

#### Sync run state

run 単位では次を保持する。

- runId
- facilityId
- trigger (`api` / `scheduler`)
- requestedAt / startedAt / finishedAt
- requestedCount
- fetchedCount
- appliedCount
- failedCount
- skippedCount
- status (`requested` / `fetching` / `applying` / `completed` / `partial` / `failed`)
- errorCode / errorMessage

### 2.5 Push / recovery の truthful model

現行 push/recovery は D11 の target を満たしていないため、A3 target では **event inbox + per-facility cursor** に整理する。

#### Event truth table

push / recovery の event state は facility + event 単位で次を分離する。

- `received`
- `fetched`
- `applied`
- `failed`
- `duplicate`

#### Important rule

**dedup を apply 成功の前に確定しない。**

現行 `OrcaPushSeenEventStore.markSeen()` は handler 冒頭で呼ばれており、apply 失敗時も duplicate 扱いになる。A3 target では次に変更する。

- inbox に `received` を記録
- handler / fetch を実行
- local apply 成功後に `applied` を記録
- duplicate 判定は `facilityId + eventUuid + applied` を基準にする
- apply 失敗時は `failed` と retry 可能状態を残す

#### Recovery

recovery は「現在時刻から lookback」ではなく、**per-facility cursor recovery** にする。

保持対象:

- facilityId
- streamKind (`reception_push` / `medical_push`)
- lastFetchedEventTime
- lastFetchedEventUuid
- lastAppliedEventTime
- lastAppliedEventUuid
- lastRecoveryRunId
- updatedAt

これにより、`received / fetched / applied / failed` の整合と replay gap の可視化が可能になる。

### 2.6 Scheduler model

`OrcaPatientSyncScheduler` の single-facility model は target では廃止する。

scheduler は次のどちらかで explicit facility を列挙する。

1. admin-config に保存された有効 facility の列挙
2. runtime table に保存された per-facility schedule 定義

A3 時点では 2 を推奨する。

```text
facility_id + job_kind + enabled + interval_minutes + initial_lookback_days
```

- single `ORCA_PATIENT_SYNC_FACILITY_ID` env は remove 候補。
- scheduler は facility ごとに independent runId を発行する。

### 2.7 facility-native user link

`d_orca_user_link` は target で facility-native にする。

#### Current

- PK: `ehr_user_pk`
- unique: `orca_user_id`

#### Target

- columns: `facility_id`, `ehr_user_pk`, `orca_user_id`, `created_at`, `updated_at`, `updated_by`
- PK: `(facility_id, ehr_user_pk)` または surrogate key + unique `(facility_id, ehr_user_pk)`
- unique: `(facility_id, orca_user_id)`

これにより multi-facility で同じ `orca_user_id` が存在しても衝突しない。

## 3. Current → Target の差分

### 差分-1: facility resolution

- Current:
  - `RestOrcaTransport` が `SessionTraceManager` / MDC / composite actor から facility を暗黙解決
  - `OrcaWrapperService` が facility を引数で受けない
  - `DefaultOrcaPatientAdapter` / `OrcaPatientSyncService` / `PatientModV2OutpatientOrcaCoordinator` が facility を持っていても ORCA call に渡さない
- Target:
  - transport / live gateway / adapter / sync / push / recovery / scheduler の全てで facility 必須
- 変える理由:
  - PB-02。background ORCA call を multi-facility で安全にするため

### 差分-2: ORCA live vs local view

- Current:
  - `OrcaMedicalOutpatientResource` が local delegate
  - `OrcaLocalMedicalOutpatientResource` が `/orca/local-medical` namespaceにいる
  - `OrcaDiseaseResource#import` は ORCA live read でなく local diagnosis read
- Target:
  - ORCA live と local projection を別 service / 別 route / 別 DTO 系列に分離
- 変える理由:
  - PB-01 / PB-05。ORCA 名義 fail-open を禁止するため

### 差分-3: push / recovery semantics

- Current:
  - `markSeen()` が apply 前に走る
  - `OrcaPushStateStore` は facility 単位の last-* しか持たない
  - `OrcaPushRecoveryService` は time-window lookback で per-facility cursor を持たない
- Target:
  - event inbox + run state + per-facility cursor
  - `received / fetched / applied / failed / duplicate` を分離
- 変える理由:
  - PB-07。truthful semantics を成立させるため

### 差分-4: sync state

- Current:
  - `d_orca_patient_sync_state` は `last_sync_date / last_synced_at / last_run_id / last_error` のみ
  - run 単位状態がない
- Target:
  - cursor store と run store を分離
- 変える理由:
  - run の partial / failed / retry / replay を観測可能にするため

### 差分-5: ORCA user link

- Current:
  - `d_orca_user_link` が facility 非保持、`orca_user_id` 全体 unique
- Target:
  - facility-native unique へ変更
- 変える理由:
  - D2 の multi-facility 前提に合わせるため

## 4. Delete First / Rename First 一覧

### Delete First

1. `open.orca.rest.OrcaPatientDiseaseResource`
2. `OrcaMedicalOutpatientResource`（ORCA 名義 local delegate）
3. ORCA 名義の local projection route 群
4. 現行 `shadowMode` 運用モデル
5. `OrcaPatientSyncScheduler` の single-facility env 依存

### Rename First

1. `OrcaWrapperService` → `OrcaLiveGateway`
2. `OrcaPatientSyncService` → 分割
   - `OrcaPatientImportService`
   - `OrcaPatientSyncPlanner`
   - `OrcaPatientSyncRunner`
3. `OrcaLocalMedicalOutpatientResource` → `LocalOutpatientProjectionResource`
4. `OrcaPushStateStore` → `OrcaPushConnectionStateStore`
   - event truth table は別 table / store に分離

## 5. 実装前提 / 契約 / データ境界

### API 契約

- ORCA live API は facility 必須。
- local projection API は ORCA namespace を使わない。
- ORCA live API は local fallback を返さない。
- background job / push / recovery は request context を前提にしない。

### データ正本

- ORCA 正本:
  - patient basic
  - insurance
  - appointment
  - reception / visit
  - ORCA master
- local 正本:
  - chart
  - document
  - attachment
  - UI projection
- disease / outpatient summary:
  - live ORCA view と local projection を明示分離

### facility / scope

- facility は ORCA 境界の compile-time 必須引数。
- default facility は admin connection 設定の UI/default 選択に限定。
- `resolve(null)` や `MDC` 由来 facility は ORCA runtime path から排除。

### error / auth / audit

- ORCA unavailable は fail-closed。
- local fallback で 200 を返さない。
- audit には facilityId / runId / trigger / source / requested/fetched/applied/failed を残す。
- push/recovery では event 単位 audit を残す。

## 6. Acceptance Criteria

- **AC-1**: `OrcaTransport` / `OrcaLiveGateway` / push / sync / recovery / scheduler の公開 API が facility 必須になっている
- **AC-2**: ORCA 名義 endpoint から local projection が返らない
- **AC-3**: push/recovery が `received / fetched / applied / failed / duplicate` を per-facility/event で保持する
- **AC-4**: sync が per-facility cursor と run state を分離保持する
- **AC-5**: `d_orca_user_link` が facility-native unique へ移行している
- **AC-6**: background ORCA call が request/session/MDC facility なしで動作可能で、implicit/default facility に落ちない

## 7. Open Blockers

### Blocker-1
- Blocker: clean source bundle / authoritative branch が未確定
- 理由: compile-safe な大規模 interface break を入れる基準点が曖昧
- 依存: source intake の整理

### Blocker-2
- Blocker: 現行 ORCA upstream の `pusheventgetv2` replay / cursor 契約が不明
- 理由: recovery cursor の厳密設計に upstream 契約確認が必要
- 依存: fact-finding

### Blocker-3
- Blocker: 現行 ORCA 名義 local projection route の hidden consumer 未確認
- 理由: A2 で public surface を整理する前に consumer inventory が必要
- 依存: hidden consumer 調査

### Blocker-4
- Blocker: A4 の DB support が必要
- 理由: run store / cursor store / event inbox は schema 追加前提
- 依存: A4 schema design

## 8. Phase2-B へ渡すべき前提

- **SRE**:
  - facility ごとの job 有効化/無効化と run visibility が必要
  - push / recovery の cursor 運用を dashboard 化する
- **QA**:
  - 2 facility 以上の fixture 必須
  - duplicate event / partial failure / replay gap / ORCA outage をケース化する
- **Performance**:
  - patient sync batch size と replay backlog 上限を測る
- **Refactoring**:
  - wrapper → live gateway への compile-break を許容する
  - local projection route の namespace 変更を許容する
- **Reporting**:
  - metrics は `received / fetched / applied / failed / duplicate` を分ける

## 9. 正規化Issue一覧

### NI-A3-01
- Title: ORCA transport が facility を暗黙解決している
- Area: transport
- Severity: High
- Type: design gap
- Evidence: `RestOrcaTransport.resolveFacilityId()` が `SessionTraceManager` / MDC / composite actor 依存
- Impact: background path と multi-facility で誤動作要因
- Recommended Action: `OrcaTransport.invoke(facilityId, ...)` へ変更
- Dependency: Slice-1
- Effort: M
- Production Blocker: Yes

### NI-A3-02
- Title: ORCA live gateway が facility explicit でない
- Area: service boundary
- Severity: High
- Type: design gap
- Evidence: `OrcaWrapperService` 全メソッドが facility 引数なし
- Impact: request edge 以外で facility 明示を強制できない
- Recommended Action: `OrcaLiveGateway` へ置換
- Dependency: Slice-1
- Effort: M
- Production Blocker: Yes

### NI-A3-03
- Title: facility を持つ caller が ORCA call に facility を渡していない
- Area: adapter / coordinator / sync
- Severity: High
- Type: implementation smell
- Evidence: `DefaultOrcaPatientAdapter`, `OrcaPatientSyncService`, `PatientModV2OutpatientOrcaCoordinator`
- Impact: background / retry / replay で facility 取り違えリスク
- Recommended Action: facility explicit API に追随させる
- Dependency: Slice-1
- Effort: M
- Production Blocker: Yes

### NI-A3-04
- Title: default facility fallback が runtime path に残っている
- Area: config / transport registry
- Severity: High
- Type: design gap
- Evidence: `OrcaConnectionConfigStore.selectRecordForFacilityLocked(null)` と `resolve()` fallback
- Impact: implicit/default facility の混入余地
- Recommended Action: default facility を admin edge 限定に閉じ込める
- Dependency: Slice-1
- Effort: S
- Production Blocker: Yes

### NI-A3-05
- Title: ORCA 名義 endpoint が local projection を返す
- Area: api semantics
- Severity: High
- Type: semantic mismatch
- Evidence: `OrcaMedicalOutpatientResource` → `OrcaLocalMedicalOutpatientResource` delegate
- Impact: ORCA live と local view の誤認
- Recommended Action: local projection を別 namespace / 別 resource へ移す
- Dependency: Slice-2
- Effort: M
- Production Blocker: Yes

### NI-A3-06
- Title: disease import が ORCA live read でなく local read
- Area: api semantics
- Severity: High
- Type: semantic mismatch
- Evidence: `OrcaDiseaseResource#import` が `karteServiceBean.getDiagnosis()` を使用
- Impact: ORCA 名義 fail-closed 契約に反する
- Recommended Action: live ORCA disease view と local disease projection を分離
- Dependency: Slice-2
- Effort: M
- Production Blocker: Yes

### NI-A3-07
- Title: sync scheduler が single-facility env model のまま
- Area: scheduler
- Severity: Medium
- Type: scalability gap
- Evidence: `OrcaPatientSyncScheduler.resolveFacilityId()` が単一 facility 設定前提
- Impact: multi-facility 本番に不適合
- Recommended Action: per-facility schedule registry へ変更
- Dependency: Slice-3
- Effort: M
- Production Blocker: Yes

### NI-A3-08
- Title: sync state が truthful run model を持たない
- Area: runtime state
- Severity: High
- Type: observability gap
- Evidence: `d_orca_patient_sync_state` は `last_sync_date` など最終値のみ
- Impact: partial / failed / retry / replay 可視化不能
- Recommended Action: cursor store と run store に分離
- Dependency: Slice-3 / A4
- Effort: M
- Production Blocker: Yes

### NI-A3-09
- Title: push dedup が apply 成功前に確定している
- Area: push
- Severity: High
- Type: semantic bug
- Evidence: `ReceptionPushHandler` / `MedicalPushHandler` が handler 冒頭で `markSeen()`
- Impact: apply failure 後に replay 不能になる
- Recommended Action: inbox + applied-state dedup に変更
- Dependency: Slice-4 / A4
- Effort: M
- Production Blocker: Yes

### NI-A3-10
- Title: push state store が event truth を表現できない
- Area: push runtime state
- Severity: High
- Type: observability gap
- Evidence: `OrcaPushStateStore` は facility 単位 last-event / connection 状態のみ
- Impact: `received / fetched / applied / failed` 分離不能
- Recommended Action: event inbox / cursor / connection state に分離
- Dependency: Slice-4 / A4
- Effort: M
- Production Blocker: Yes

### NI-A3-11
- Title: recovery が per-facility cursor ではなく time-window lookback
- Area: recovery
- Severity: High
- Type: design gap
- Evidence: `OrcaPushRecoveryService` が `Instant.now() - lookbackMinutes` ベース
- Impact: truthful replay / gap detection / monotonic recovery が成立しない
- Recommended Action: cursor-based recovery に変更
- Dependency: Slice-4 / upstream fact-finding
- Effort: M
- Production Blocker: Yes

### NI-A3-12
- Title: ORCA user link が facility-native でない
- Area: data model
- Severity: High
- Type: schema gap
- Evidence: `d_orca_user_link` が facility 列なし、`orca_user_id` 全体 unique
- Impact: multi-facility で衝突可能
- Recommended Action: `(facility_id, orca_user_id)` unique へ変更
- Dependency: Slice-5 / A4
- Effort: M
- Production Blocker: Yes

## 10. 実装スライス

### Slice-1 — facility explicit compile-break
- `OrcaTransport` を facility 必須へ変更
- `OrcaWrapperService` を `OrcaLiveGateway` へ置換
- call site 全更新
- `SessionTraceManager` / MDC 依存 facility 解決を削除

### Slice-2 — ORCA live / local projection 分離
- `OrcaMedicalOutpatientResource` delete
- `OrcaLocalMedicalOutpatientResource` rename / local namespace へ移動
- disease live vs local projection 分離

### Slice-3 — patient import / sync truthful redesign
- `OrcaPatientSyncService` を import/planner/runner に分割
- per-facility schedule 定義導入
- cursor store + run store に分離

### Slice-4 — push / recovery truthful redesign
- inbox / connection state / cursor state 分離
- dedup を apply 成功後基準へ変更
- recovery を cursor-based に変更

### Slice-5 — facility-native ORCA link / A4 handoff
- `d_orca_user_link` facility-native 化
- run/cursor/event schema を A4 へ引き渡し

