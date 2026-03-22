# ORCA連携 回収実装手順書（server-modernized 詳細版）

更新日: 2026-03-22  
対象: `server-modernized`  
配置先: `docs/server-modernization/planning/server-modernized-plan/docs/development/orca-server-recovery-implementation-playbook.md`  
参照実装: `OpenDolphin-1.3.0-master`（元町皮ふ科 松村先生系の旧実装を含む参照元）  
形式: **進捗が見えるチェックボックス式**  
前提: **後方互換性は考慮しない。legacy 実装・legacy 設定・legacy API 名称は温存しない。**  
目的: 担当者がこの文書だけを見て、迷わず実装・テスト・段階リリースまで進められる状態にする。

---

## 0-a. 着手前に参照する現行文書

- `docs/server-modernization/planning/server-modernized-plan/README.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/README.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/contracts/orca-connection.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/contracts/runtime-config.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/runbooks/release-validation.md`
- `docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md`
- `docs/server-modernization/ORCA-order-system-rule.md`
- `docs/DEVELOPMENT_STATUS.md`

---

## 0. この文書の使い方

- `[x]` は **完了済み / 調査済み**
- `[ ]` は **未完了**
- ここに書かれた `src/...` / `config/...` / `tools/...` / `pom.xml` は、すべて `server-modernized/` ディレクトリを起点とした相対パスとして読むこと。
- 各 Phase の先頭に「担当」「着手」「完了」「PR」を書く欄を置いている。実作業時に埋めること。
- **Phase を飛ばさないこと。** 依存関係がある。
- **旧実装は移植しない。** 参照するのは「イベント名」「処理の流れ」「どの API を引くか」だけに限定する。
- **本番運用前提**で作る。単発デモ実装は禁止。受信、冪等化、再同期、監査、監視、段階リリースまで入れて完了とする。

---

## 1. まず最初に固定する方針

### 1-1. 絶対に守ること

- [x] ORCA Push は **WebSocket/JSON の通知を受け、詳細は ORCA API で取りに行く** 方式で組む。
- [x] 受付通知は `patient_accept`、診療行為通知は `patient_account` を対象とする。
- [x] Push 通知の一意判定は `data.id` ではなく **`data.uuid`** を使う。
- [x] Push 切断中のイベントは再接続後に自動再送されない前提で設計する。
- [x] `pusheventgetv2` は **クラウド版のみ**の補助 recovery として扱い、依存しすぎない。
- [x] 現行 SSE (`ReceptionRealtimeSseSupport`) は再利用する。
- [x] `medicalmodv2` は `class=01/02/03/04` を全て扱えるようにする。
- [x] `medicalmodv2` は `Medical_Push`、`Medical_Uid` を扱えるようにする。
- [x] `acceptmodv2` は `Request_Number=04` と `Claim_Send_Info` を扱えるようにする。
- [x] **本番で危険な旧実装の癖は持ち込まない。**

### 1-2. 旧実装から持ち込んではいけないもの

- [x] `X-GINBEE-TENANT-ID: 1` のハードコード
- [x] `SubscriptionEvent.ALL("*")` の全イベント購読
- [x] `patient_infomation` typo の踏襲
- [x] `DummyHeader` のような内部呼び出しハック
- [x] `.findFirst().get()` 前提の楽観処理
- [x] `Api_Result=90` に対する 25 分級の busy retry
- [x] ファイルベースの push event cache を本番冪等化の本体にする設計
- [x] 施設非考慮・単一ノード前提の実装

---

## 2. 現在の進捗サマリ

### 2-1. 調査済み

- [x] 現行 `server-modernized` に **実 WebSocket Push クライアントが無い**ことを確認
- [x] 現行 SSE は **`/orca/visits/mutation` 実行成功時のローカル通知**であり、ORCA Push 受信ではないことを確認
- [x] `PushEventDeduplicator` が `Event_Id` 前提で、`uuid` 冪等化になっていないことを確認
- [x] `OrcaChartSupportResource.medicalModV2()` が `class=01` 固定であることを確認
- [x] `OrcaChartSupportSupport.buildMedicalModV2RequestXml()` が `Medical_Push` 未対応であることを確認
- [x] `OrcaChartSupportSupport.parseMedicalModResponse()` が `Medical_Uid` 未取得・`ok` 判定不正であることを確認
- [x] `OrcaWrapperServiceMutationSupport.normalizeAcceptRequestNumber()` が `04` 未対応であることを確認
- [x] `/orca/medicalmodv2/outpatient` が ORCA 送信 API ではなくローカル返却 API であり、命名が危険であることを確認
- [x] 旧実装は `patient_accept` の流れの参考にはなるが、`patient_account` 完成版ではないことを確認
- [x] 松村先生コードの公開参照元として `MasudaNaika/OpenDolphin-ORCA-OQS` README を確認

### 2-2. これから実装するもの

- [x] Phase 1: DB と runtime config の基盤追加
- [x] Phase 2: ORCA 接続設定の拡張（pushUrl / pushTenantId）
- [x] Phase 3: Push クライアント基盤新設
- [x] Phase 4: 受付 Push (`patient_accept`) の本実装
- [x] Phase 5: 診療行為 Push (`patient_account`) の本実装
- [x] Phase 6: 送信系 API (`acceptmodv2` / `medicalmodv2`) の是正
- [x] Phase 7: readiness / metrics / 管理画面 / 運用面の整備
- [x] Phase 8: legacy 廃止と名称整理
- [x] Phase 9: テスト整備
- [ ] Phase 10: shadow mode → live の段階リリース

---

## 3. 最終到達像（完成の定義）

以下を満たしたら本件は完了。

- [ ] ORCA Push WebSocket に施設単位で接続できる
- [ ] `patient_accept` を購読し、詳細 pull 後に既存 SSE へ配信できる
- [ ] `patient_account` を購読し、詳細 pull・監査・状態記録ができる
- [ ] Push 切断 / 再接続 / recovery が動く
- [ ] `uuid` 冪等化が DB ベースで動く
- [ ] `acceptmodv2` が `Request_Number=04` まで扱える
- [ ] `medicalmodv2` が `class=01/02/03/04`・`Medical_Push`・`Medical_Uid` を扱える
- [ ] readiness / metrics / audit で異常検知できる
- [ ] 紛らわしい legacy path / config / class が除去される
- [ ] 受付 shadow mode → 受付 live → 診療行為 live の順で段階導入できる

---

## 4. 変更対象ファイルの全体一覧

## 4-1. 既存ファイルを修正する

- [ ] `src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- [ ] `src/main/java/open/dolphin/rest/ReceptionRealtimeSseSupport.java`
- [ ] `src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java`
- [ ] `src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- [ ] `src/main/java/open/dolphin/orca/service/OrcaWrapperServiceMutationSupport.java`
- [ ] `src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- [ ] `src/main/java/open/dolphin/orca/config/OrcaConnectionConfigRecord.java`
- [ ] `src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java`
- [ ] `src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- [ ] `src/main/java/open/dolphin/rest/OperationsReadinessEvaluator.java`
- [ ] `config/server-modernized.env.sample`
- [ ] `pom.xml`
- [ ] `src/main/java/open/dolphin/rest/orca/OrcaMedicalModV2Resource.java`（**rename / path 変更**）
- [ ] `src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
- [ ] `src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`
- [ ] `src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java`
- [ ] `src/test/java/open/dolphin/orca/config/OrcaConnectionConfigStoreTest.java`
- [ ] `src/test/java/open/dolphin/rest/orca/OrcaVisitResourceRealtimeTest.java`
- [ ] `src/test/java/open/dolphin/rest/ReceptionRealtimeSseSupportTest.java`
- [ ] `src/test/java/open/dolphin/rest/ReceptionRealtimeStreamResourceTest.java`
- [ ] `src/test/java/open/dolphin/rest/OrcaChartSupportResourceTest.java`
- [ ] `src/test/java/open/dolphin/rest/orca/OrcaChartSupportSupportTest.java`
- [ ] `src/test/java/open/dolphin/rest/OperationsReadinessResourceTest.java`
- [ ] `src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java`

## 4-2. 新規追加する

- [ ] `tools/flyway/sql/V0305__orca_push_runtime_tables.sql`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushLifecycleService.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushClientRegistry.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushClient.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushEventRouter.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushRecoveryService.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushStateStore.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushSeenEventStore.java`
- [ ] `src/main/java/open/dolphin/orca/push/ReceptionPushHandler.java`
- [ ] `src/main/java/open/dolphin/orca/push/MedicalPushHandler.java`
- [ ] `src/main/java/open/dolphin/orca/push/OrcaPushSocketFactory.java`
- [ ] `src/main/java/open/dolphin/orca/push/JdkOrcaPushSocketFactory.java`
- [ ] `src/main/java/open/dolphin/orca/push/dto/OrcaPushEnvelope.java`
- [ ] `src/main/java/open/dolphin/orca/push/dto/OrcaPushEventData.java`
- [ ] `src/main/java/open/dolphin/orca/push/dto/OrcaPushReceptionBody.java`
- [ ] `src/main/java/open/dolphin/orca/push/dto/OrcaPushMedicalBody.java`
- [ ] `src/main/java/open/dolphin/orca/push/dto/OrcaPushMedicalInformation.java`
- [ ] `src/main/java/open/dolphin/metrics/OrcaPushMetricsRegistrar.java`
- [ ] `src/test/java/open/dolphin/orca/push/...` 配下の単体テスト一式
- [ ] `src/test/java/open/dolphin/flyway/...` 必要に応じ migration 一貫性確認

## 4-3. 廃止する

- [ ] `src/main/java/open/dolphin/orca/support/PushEventDeduplicator.java`
- [ ] `src/test/java/open/dolphin/orca/support/PushEventDeduplicatorTest.java`
- [ ] `ServerRuntimeConfiguration.PushEventCacheSettings`
- [ ] `ServerConfigurationResolver.KEY_ORCA_PUSH_EVENT_CACHE_*`
- [ ] `server-modernized.env.sample` 内の `ORCA_PUSH_EVENT_CACHE_*`

---

## 5. 実装順序（この順で進める）

1. Phase 1: DB / runtime config
2. Phase 2: ORCA 接続設定拡張
3. Phase 3: Push クライアント基盤
4. Phase 4: `patient_accept`
5. Phase 5: `patient_account`
6. Phase 6: `acceptmodv2` / `medicalmodv2`
7. Phase 7: readiness / metrics / admin
8. Phase 8: rename / legacy 除去
9. Phase 9: テスト
10. Phase 10: shadow → live リリース

**理由:** Push を受ける土台と state が無い状態で handler を書いても、後で作り直しになるため。

---

# Phase 1. DB と runtime config の基盤追加

担当:  
着手日:  
完了日:  
PR:  

## 1-1. 目標

- Push 状態と冪等化を **DB で持つ**
- runtime 設定を **push 用に入れ替える**
- 旧 file cache 系を **完全廃止する**

## 1-2. 実装手順

### A. Flyway migration を追加する

- [ ] `tools/flyway/sql/V0305__orca_push_runtime_tables.sql` を新規作成する
- [ ] 以下の DDL をそのまま入れる

```sql
CREATE TABLE IF NOT EXISTS opendolphin.d_orca_push_state (
    facility_id varchar(64) PRIMARY KEY,
    connection_status varchar(16) NOT NULL,
    websocket_url varchar(512),
    last_connected_at timestamptz,
    last_disconnected_at timestamptz,
    last_event_at timestamptz,
    last_event_uuid varchar(64),
    last_event_name varchar(64),
    last_recovery_started_at timestamptz,
    last_recovery_finished_at timestamptz,
    last_recovery_window_start timestamptz,
    last_recovery_window_end timestamptz,
    last_error text,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opendolphin.d_orca_push_seen_event (
    facility_id varchar(64) NOT NULL,
    event_uuid varchar(64) NOT NULL,
    event_name varchar(64) NOT NULL,
    event_time timestamptz,
    received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (facility_id, event_uuid)
);

CREATE INDEX IF NOT EXISTS idx_d_orca_push_seen_event_expires_at
    ON opendolphin.d_orca_push_seen_event (expires_at);
```

### B. runtime config を置き換える

- [ ] `ServerRuntimeConfiguration` に以下 record を追加する  
  `OrcaPushSettings`
- [ ] フィールドは以下で固定する

```java
public record OrcaPushSettings(
        boolean enabled,
        boolean shadowMode,
        boolean receptionEnabled,
        boolean medicalEnabled,
        Integer connectTimeoutMs,
        Integer pingIntervalSeconds,
        Integer idleTimeoutSeconds,
        Integer reconnectInitialDelayMs,
        Integer reconnectMaxDelayMs,
        boolean recoveryEnabled,
        boolean recoveryUsePusheventget,
        Integer recoveryIntervalMinutes,
        Integer recoveryInitialLookbackMinutes,
        Integer recoveryOverlapMinutes,
        Integer dedupRetentionDays
) {}
```

- [ ] `PushEventCacheSettings` を削除する
- [ ] `ServerConfigurationResolver` に新規キーを追加する
- [ ] `ServerConfigurationResolver.orcaPush()` を追加する
- [ ] `ServerConfigurationValidator` で各値の範囲チェックを入れる

### C. config key を以下で固定する

- [ ] `orca.push.enabled`
- [ ] `orca.push.shadow-mode`
- [ ] `orca.push.reception.enabled`
- [ ] `orca.push.medical.enabled`
- [ ] `orca.push.connect-timeout-ms`
- [ ] `orca.push.ping-interval-seconds`
- [ ] `orca.push.idle-timeout-seconds`
- [ ] `orca.push.reconnect.initial-delay-ms`
- [ ] `orca.push.reconnect.max-delay-ms`
- [ ] `orca.push.recovery.enabled`
- [ ] `orca.push.recovery.use-pusheventget`
- [ ] `orca.push.recovery.interval-minutes`
- [ ] `orca.push.recovery.initial-lookback-minutes`
- [ ] `orca.push.recovery.overlap-minutes`
- [ ] `orca.push.dedup.retention-days`

### D. env sample を更新する

- [ ] `config/server-modernized.env.sample` から以下を削除する
  - [ ] `ORCA_PUSH_EVENT_CACHE_PATH`
  - [ ] `ORCA_PUSH_EVENT_CACHE_MAX_ENTRIES`
  - [ ] `ORCA_PUSH_EVENT_CACHE_TTL_DAYS`

- [ ] `config/server-modernized.env.sample` に以下を追加する

```env
ORCA_PUSH_ENABLED=false
ORCA_PUSH_SHADOW_MODE=true
ORCA_PUSH_RECEPTION_ENABLED=true
ORCA_PUSH_MEDICAL_ENABLED=false
ORCA_PUSH_CONNECT_TIMEOUT_MS=5000
ORCA_PUSH_PING_INTERVAL_SECONDS=20
ORCA_PUSH_IDLE_TIMEOUT_SECONDS=60
ORCA_PUSH_RECONNECT_INITIAL_DELAY_MS=1000
ORCA_PUSH_RECONNECT_MAX_DELAY_MS=30000
ORCA_PUSH_RECOVERY_ENABLED=true
ORCA_PUSH_RECOVERY_USE_PUSHEVENTGET=false
ORCA_PUSH_RECOVERY_INTERVAL_MINUTES=5
ORCA_PUSH_RECOVERY_INITIAL_LOOKBACK_MINUTES=30
ORCA_PUSH_RECOVERY_OVERLAP_MINUTES=5
ORCA_PUSH_DEDUP_RETENTION_DAYS=14
```

## 1-3. 完了条件

- [ ] Flyway が通る
- [ ] `ServerConfigurationResolverTest` が新キーで通る
- [ ] `ServerConfigurationValidatorTest` が不正値検知で通る
- [ ] 旧 push-event-cache 設定がコードから消える

## 1-4. テスト

- [ ] `ServerConfigurationResolverTest` を更新
- [ ] `ServerConfigurationValidatorTest` を更新
- [ ] `FlywayMigrationConsistencyTest` が通る
- [ ] `FreshSchemaBaselineTest` が通る

---

# Phase 2. ORCA 接続設定の拡張（pushUrl / pushTenantId）

担当:  
着手日:  
完了日:  
PR:  

## 2-1. 目標

- Push 接続先を **施設単位設定**にする
- クラウド / オンプレ / 環境差を **ハードコードしない**
- client certificate / CA certificate を **Push にも再利用**する

## 2-2. 実装手順

### A. 永続 record に push 設定を追加する

- [ ] `OrcaConnectionConfigRecord` に以下を追加する
  - [ ] `private String pushUrl;`
  - [ ] `private String pushTenantId;`
- [ ] getter / setter を追加する

### B. Store の UpdateRequest / ResolvedOrcaConnection を拡張する

- [ ] `OrcaConnectionConfigStore.UpdateRequest` に以下を追加
  - [ ] `String pushUrl`
  - [ ] `String pushTenantId`
- [ ] `OrcaConnectionConfigStore.ResolvedOrcaConnection` に以下を追加
  - [ ] `String pushUrl`
  - [ ] `String pushTenantId`
- [ ] `applyScalarUpdates()` で更新できるようにする
- [ ] `resolveFromRecord()` で Push 用値も返すようにする
- [ ] `pushTenantId` は secret ではないので暗号化不要とする

### C. Admin API を拡張する

- [ ] `AdminOrcaConnectionResource.parseUpdateRequest()` で `pushUrl`, `pushTenantId` を読む
- [ ] `buildView()` に以下を追加
  - [ ] `pushUrl`
  - [ ] `pushTenantId`
  - [ ] `pushConfigured`（`pushUrl` が入っているかの boolean）
- [ ] multipart の payload サンプルにも `pushUrl`, `pushTenantId` を反映する

### D. 入力ルールを固定する

- [ ] `pushUrl` は **絶対 URI** 必須
- [ ] `pushUrl` は `ws://` または `wss://` のみ許可
- [ ] `pushTenantId` は空許可
- [ ] `pushTenantId` は **空でなければそのままヘッダ送信**
- [ ] `pushTenantId` をコードにデフォルト挿入しない
- [ ] クラウド時も `pushTenantId` を自動で送らない

## 2-3. 実装上の注意

- [ ] Push URL は runtime env ではなく **admin ORCA connection config** で持つ  
      理由: 施設ごとに異なる可能性があるため
- [ ] TLS 材料は既存 `ResolvedOrcaConnection` の
  - [ ] `clientCertificateP12`
  - [ ] `clientCertificatePassphrase`
  - [ ] `caCertificate`
  をそのまま使う
- [ ] API 通信用 `baseUrl` と Push 通信用 `pushUrl` は別物として扱う

## 2-4. 完了条件

- [ ] 管理 API の GET/PUT で `pushUrl`, `pushTenantId` を保存・取得できる
- [ ] facility ごとに別の `pushUrl` を持てる
- [ ] 既存 API 接続設定を壊さない

## 2-5. テスト

- [ ] `OrcaConnectionConfigStoreTest` を更新
- [ ] `AdminOrcaConnectionResourceTest` を更新
- [ ] invalid `pushUrl` を弾くケースを追加

---

# Phase 3. Push クライアント基盤の新設

担当:  
着手日:  
完了日:  
PR:  

## 3-1. 目標

- 施設単位の Push 接続を管理できる
- 再接続、再購読、状態記録、監査が動く
- 受信と業務処理を分離できる

## 3-2. 技術方針

- [x] WebSocket クライアントは **JDK `java.net.http.WebSocket`** を使う
- [x] `jakarta.websocket` ベースにはしない
- [x] `pom.xml` の未使用 `jakarta.websocket-*` は削除対象にする
- [x] テストしやすいように socket factory を 1 層噛ませる

## 3-3. 新規クラスの責務

### A. `OrcaPushLifecycleService`

- [ ] `@ApplicationScoped`
- [ ] `@PostConstruct` で push 起動判定
- [ ] `@PreDestroy` で全 client close
- [ ] runtime push disabled の場合は何もしない

### B. `OrcaPushClientRegistry`

- [ ] 施設ごとに `OrcaPushClient` を保持
- [ ] 60 秒ごとに facility config fingerprint を確認
- [ ] `pushUrl` / cert / tenantId 変更を検知したら再接続
- [ ] default facility の変更にも追随

### C. `OrcaPushClient`

- [ ] 1 施設 1 接続
- [ ] 接続成功で subscribe 送信
- [ ] 受信 JSON を router に流す
- [ ] 切断時に指数バックオフで再接続
- [ ] ping 定期送信
- [ ] 最終 event 時刻を state store に保存
- [ ] エラー時は state store / metrics / audit に残す

### D. `OrcaPushEventRouter`

- [ ] `patient_accept` は `ReceptionPushHandler`
- [ ] `patient_account` は `MedicalPushHandler`
- [ ] 未知イベントは warning audit のみ
- [ ] `subscribed` / `error` / `unsubscribe` も構造化ログ化

### E. `OrcaPushStateStore`

- [ ] `d_orca_push_state` を読む/書く
- [ ] connection status を `DISCONNECTED / CONNECTING / CONNECTED / DEGRADED` で管理
- [ ] `lastConnectedAt`, `lastDisconnectedAt`, `lastEventAt`, `lastEventUuid`, `lastEventName`, `lastError` を更新

### F. `OrcaPushSeenEventStore`

- [ ] `facilityId + eventUuid` で insert
- [ ] insert 成功なら未処理
- [ ] PK conflict なら duplicate として即 return
- [ ] 定期 purge を入れる（`expires_at < now` 削除）

### G. `OrcaPushRecoveryService`

- [ ] startup 時 recovery
- [ ] reconnect 後 recovery
- [ ] 定期 recovery
- [ ] `recoveryUsePusheventget=true` のときだけ `pusheventgetv2` を使う
- [ ] recovery で取得したイベントも router にそのまま流す

## 3-4. 実装手順

### A. パッケージ作成

- [ ] `src/main/java/open/dolphin/orca/push/` を作る
- [ ] `dto/` を切る
- [ ] `support/` が必要なら切る

### B. DTO を作る

- [ ] `OrcaPushEnvelope`
  - [ ] `command`
  - [ ] `reqId`
  - [ ] `subId`
  - [ ] `data`
  - [ ] `message`
- [ ] `OrcaPushEventData`
  - [ ] `id`
  - [ ] `uuid`
  - [ ] `event`
  - [ ] `user`
  - [ ] `time`
  - [ ] `body`
- [ ] `OrcaPushReceptionBody`
  - [ ] `Patient_Mode`
  - [ ] `Patient_ID`
  - [ ] `Accept_Date`
  - [ ] `Accept_Time`
  - [ ] `Accept_Id`
  - [ ] `Department_Code`
  - [ ] `Physician_Code`
  - [ ] `Insurance_Combination_Number`
- [ ] `OrcaPushMedicalBody`
  - [ ] `Patient_Mode`
  - [ ] `Patient_ID`
  - [ ] `Information_Date`
  - [ ] `Information_Time`
  - [ ] `Perform_Date`
  - [ ] `Medical_Information[]`
- [ ] `OrcaPushMedicalInformation`
  - [ ] `Insurance_Combination_Number`
  - [ ] `Department_Code`
  - [ ] `Physician_Code`
  - [ ] `Invoice_Number`

### C. subscribe 内容を固定する

- [ ] 既定購読は以下のみ
  - [ ] `patient_accept`
  - [ ] `patient_account`
- [ ] `*` は送らない
- [ ] `patient_infomation` は扱わない
- [ ] 購読リストは code 定数で固定し、env から自由入力にしない

### D. message 処理を固定する

- [ ] `command=subscribed` は成功ログ + state 更新
- [ ] `command=event` は router へ
- [ ] `command=error` は state を DEGRADED にして error 内容を保存
- [ ] 不正 JSON / unknown command は audit warning のみ

### E. 再接続を固定する

- [ ] 初回 delay = `orca.push.reconnect.initial-delay-ms`
- [ ] 上限 = `orca.push.reconnect.max-delay-ms`
- [ ] 成功したら backoff をリセット
- [ ] 再接続後に必ず再 subscribe

## 3-5. 完了条件

- [ ] push enabled で startup 後に接続試行する
- [ ] 接続成功で subscribed ログが出る
- [ ] 接続切断で自動再接続する
- [ ] facility config 変更で再接続する
- [ ] duplicate event が DB PK conflict で落ちるのではなく、正常スキップされる

## 3-6. テスト

- [ ] fake socket factory を使った client 単体テスト
- [ ] subscribed / event / error / reconnect の各ケース
- [ ] duplicate event の seen-event test
- [ ] config change で reconnect する registry test

---

# Phase 4. 受付 Push (`patient_accept`) の本実装

担当:  
着手日:  
完了日:  
PR:  

## 4-1. 目標

- `patient_accept` を受ける
- 受信内容を **詳細 pull のトリガー**として扱う
- pull 成功時だけ既存 SSE に流す
- pull 失敗時は **replay-gap** で UI reload を促す

## 4-2. 既存資産の使い方

- [x] 受信後の UI 配信口は `ReceptionRealtimeSseSupport` を使う
- [x] 詳細 pull は **旧実装の `acceptlstv2` 直叩きではなく、現行 wrapper の `acceptmodv2 Request_Number=00` を優先**して使う
- [x] 理由は現行サーバーの parser / audit / response DTO を再利用できるため

## 4-3. 受付ハンドラの仕様を固定する

### A. event の前処理

- [ ] `facilityId + uuid` で seen-event insert
- [ ] duplicate なら即 return
- [ ] `event != patient_accept` なら return
- [ ] `Patient_Mode` は `add / modify / delete` のみ受け付け、それ以外は audit warning

### B. `Patient_Mode` と requestNumber の対応

- [ ] `add -> 01`
- [ ] `modify -> 03`
- [ ] `delete -> 02`

### C. add / modify の詳細 pull 手順

- [ ] `VisitMutationRequest` を新規生成する
- [ ] `requestNumber = "00"`
- [ ] `patientId = body.Patient_ID`
- [ ] `acceptanceDate = body.Accept_Date`
- [ ] `acceptanceId` があればそれを設定
- [ ] `acceptanceId` が無い場合のみ以下を補う
  - [ ] `acceptanceTime = body.Accept_Time`
  - [ ] `departmentCode = body.Department_Code`
  - [ ] `physicianCode = body.Physician_Code`
- [ ] `Insurance_Combination_Number` があれば 1 件だけ詰める
- [ ] `wrapperService.mutateVisit(queryRequest)` を呼ぶ
- [ ] API commit 直後 race を吸収するため、失敗時は **3 回だけ** retry する
  - [ ] 1回目待ち: 250ms
  - [ ] 2回目待ち: 500ms
  - [ ] 3回目待ち: 1000ms
- [ ] 3 回失敗したら replay-gap 発火

### D. delete の手順

- [ ] delete は pull 成功を必須にしない
- [ ] `patientId`, `acceptanceDate` が取れていれば、それで `reception.updated` を publish
- [ ] requestNumber は `02`
- [ ] `patientId` または date が取れない時のみ replay-gap

### E. SSE payload 方針

- [ ] 既存 `publishReceptionUpdate(facilityId, date, patientId, requestNumber, runId)` を使う
- [ ] payload schema は増やさない
- [ ] Push body をそのまま流さない
- [ ] pull で確定した内容のみ流す

## 4-4. `ReceptionRealtimeSseSupport` の追加修正

- [ ] public メソッドを 1 つ追加する

```java
public void publishReplayGap(String facilityId)
```

- [ ] 実装は既存 private `sendReplayGapEvent(...)` を全 client 向けに使う形で良い
- [ ] payload は既存 `{"requiredAction":"reload"}` のままで良い

## 4-5. `OrcaVisitResource` の重複通知を止める

現状の `OrcaVisitResource` は `/orca/visits/mutation` 成功時にローカル SSE を直接流す。  
Push live 化後は **二重通知**になるので止める。

### 実装

- [ ] `OrcaVisitResource.publishReceptionRealtimeUpdateIfNeeded(...)` の先頭で判定を入れる
- [ ] 条件:
  - [ ] `orca.push.enabled == true`
  - [ ] `orca.push.shadow-mode == false`
  - [ ] `orca.push.reception.enabled == true`
- [ ] 上記を満たす場合は **ここでの SSE publish を skip**
- [ ] 受付 live 後は `Acceptance_Push=Yes` + `patient_accept` 経由に一本化する

## 4-6. 完了条件

- [ ] `patient_accept add` で SSE `reception.updated` が飛ぶ
- [ ] `patient_accept modify` で SSE `reception.updated` が飛ぶ
- [ ] `patient_accept delete` で SSE `reception.updated` か `reception.replay-gap` が飛ぶ
- [ ] same uuid 再受信で二重配信しない
- [ ] `/orca/visits/mutation` 直後に二重 SSE にならない

## 4-7. テスト

- [ ] `ReceptionRealtimeSseSupportTest` に `publishReplayGap()` を追加
- [ ] `OrcaVisitResourceRealtimeTest` に push live 時 direct SSE skip のケースを追加
- [ ] `src/test/java/open/dolphin/orca/push/ReceptionPushHandlerTest.java` を作成
- [ ] add / modify / delete / duplicate / replay-gap / bounded retry をテスト

---

# Phase 5. 診療行為 Push (`patient_account`) の本実装

担当:  
着手日:  
完了日:  
PR:  

## 5-1. 目標

- `patient_account` を受ける
- `medicalgetv2 class=02` で詳細を引く
- まずは **監査・状態記録・内部正規化**までを本実装とし、UI へ無理に流さない

## 5-2. 方針

- [x] 現行には診療行為 Push を消費する UI/SSE 契約が無い
- [x] なので first release は **server-side consumption only**
- [x] event ごとの invoice 単位で処理する
- [x] 1 invoice 失敗で event 全体を fail にしない

## 5-3. ハンドラ仕様

### A. 前処理

- [ ] `facilityId + uuid` で duplicate 判定
- [ ] `Patient_Mode` は logging のみで保持
- [ ] `Medical_Information[]` が空なら warning audit

### B. 各 `Medical_Information` ごとの pull

- [ ] `OrcaEndpoint.MEDICAL_GET` を使う
- [ ] query は `class=02`
- [ ] request XML は以下で組む
  - [ ] `InOut = "O"`
  - [ ] `Patient_ID = body.Patient_ID`
  - [ ] `Perform_Date = body.Perform_Date`
  - [ ] `Medical_Information/Department_Code = item.Department_Code`
  - [ ] `Medical_Information/Insurance_Combination_Number = item.Insurance_Combination_Number`
  - [ ] `Invoice_Number` があれば設定
  - [ ] `Invoice_Number` が無ければ `Sequential_Number = "1"` を最小 fallback として設定
- [ ] `Invoice_Number` ありを優先
- [ ] `Invoice_Number` なし fallback は warning ログを残す
- [ ] response は内部 DTO に正規化する
- [ ] 正規化結果は audit detail と metrics に残す
- [ ] event 単位 summary を state に残す

### C. retry 方針

- [ ] 診療行為 Push 側では app-level busy retry をしない
- [ ] transport retry に任せる
- [ ] invoice ごとの失敗は個別エラー計上
- [ ] event 全体は `partial_success` を許可する

### D. recovery 方針

- [ ] cloud + `recoveryUsePusheventget=true` の時は `pusheventgetv2` から `patient_account` も拾う
- [ ] on-prem で missed event を完全再構成できない場合は **DEGRADED** 状態にして終わる
- [ ] 存在しないイベントの synthetic replay はしない

## 5-4. 完了条件

- [ ] `patient_account` 受信時に `medicalgetv2 class=02` が呼ばれる
- [ ] 1 イベント内の複数 invoice を独立処理できる
- [ ] partial failure を記録できる
- [ ] duplicate uuid を再処理しない

## 5-5. テスト

- [ ] `MedicalPushHandlerTest` を作成
- [ ] invoice あり / なし
- [ ] 複数 invoice
- [ ] partial failure
- [ ] duplicate
- [ ] on-prem degraded recovery をテスト

---

# Phase 6. 送信系 API の是正 (`acceptmodv2` / `medicalmodv2`)

担当:  
着手日:  
完了日:  
PR:  

## 6-1. 目標

- `acceptmodv2` と `medicalmodv2` を **現行 ORCA 仕様に揃える**
- Push live と整合する送信側にする
- `Medical_Uid` と `Claim_Send_Info` を運用に使える形で返す

---

## 6-2. `acceptmodv2` の修正

### A. `OrcaWrapperServiceMutationSupport.normalizeAcceptRequestNumber()` を修正

- [ ] 許可値を `00/01/02/03/04` に拡張
- [ ] operation keyword を使っているなら `04` 相当も追加
- [ ] error message を `00/01/02/03/04` に更新

### B. `VisitMutationRequest` 側に `claimSendInfo` を追加する

- [ ] DTO source がソースツリーに無い場合は、DTO 定義元を探して追加する
- [ ] フィールド名は `claimSendInfo` で統一する
- [ ] 許可値は `00/01/02/03` のみ

### C. `buildVisitMutationPayload()` を修正する

- [ ] `requestNumber=04` の時は `<Claim_Send_Info>` を出す
- [ ] `requestNumber=04` の時の必須条件を以下に変更
  - [ ] `patientId` 必須
  - [ ] `acceptanceDate` は未設定時システム日付扱いなので REST では空許可
  - [ ] `acceptanceId` が無い場合は `acceptanceTime` + `departmentCode` を要求
  - [ ] `claimSendInfo` 必須
- [ ] `Acceptance_Push` は push enabled かつ request で未指定なら `Yes` を自動補完する
- [ ] push disabled 時は現状どおり未指定で良い

### D. `OrcaVisitResource` の入力検証を requestNumber ごとに分ける

現在の  
`!isQueryRequest(requestNumber) && acceptanceDate/time blanket required`  
は不正。以下に置き換える。

- [ ] `00`:
  - [ ] `patientId` 必須
  - [ ] `acceptanceId` があるなら date/time は空許可
  - [ ] `acceptanceId` が無い場合は `acceptanceDate` 必須
  - [ ] `acceptanceTime` はあれば優先キー、無くても query は許可
- [ ] `01`:
  - [ ] `patientId` または新規患者用氏名のどちらか、ただし現行 DTO が patient-only なら `patientId` 必須のままでも可
  - [ ] `acceptanceDate`, `acceptanceTime` 必須
- [ ] `02`:
  - [ ] `patientId` 必須
  - [ ] `acceptanceId` があればそれを優先
  - [ ] 無い場合は `acceptanceDate`, `acceptanceTime` 必須
- [ ] `03`:
  - [ ] `patientId`, `acceptanceDate`, `acceptanceTime`, `departmentCode`, `physicianCode` を要求
- [ ] `04`:
  - [ ] `patientId`, `claimSendInfo` 必須
  - [ ] `acceptanceId` が無いなら `acceptanceDate`, `acceptanceTime`, `departmentCode` を要求

### E. `OrcaXmlMapper.toVisitMutation()` を修正する

- [ ] response DTO に `claimSendInfo` を追加
- [ ] `Claim_Send_Info` を response に詰める

## 6-3. `medicalmodv2` の修正

### A. DTO を拡張する

- [ ] `ChartSupportMedicalModV2Request` に以下を追加
  - [ ] `classCode`
  - [ ] `medicalPush`
  - [ ] `medicalUid`（既にあるならそのまま使う）
- [ ] `ChartSupportMedicalModResponse` に `medicalUid` を追加

### B. `OrcaChartSupportResource.medicalModV2()` を修正する

- [ ] `payload.classCode` を必須にする
- [ ] 許可値は `01/02/03/04`
- [ ] `OrcaTransportRequest.post(requestXml).withQuery("class=" + payload.getClassCode())` に変更
- [ ] `class=01` 固定を削除
- [ ] push medical enabled かつ `medicalPush` 未指定時は `Yes` を自動補完

### C. `OrcaChartSupportSupport.buildMedicalModV2RequestXml()` を修正する

- [ ] `<Medical_Push>` を出力できるようにする
- [ ] `Medical_Uid` を request に出せるようにする（既に出ているなら維持）
- [ ] class 02 / 03 用に `Medical_Uid` を必須扱いできる validation を上位で入れる

### D. `parseMedicalModResponse()` を修正する

- [ ] `Medical_Uid` を読む
- [ ] `ok = transportOk && apiOk` に修正する
- [ ] `apiOk` はそのまま残す
- [ ] `transportOk=false` でも `Api_Result_Message` があれば error に反映
- [ ] `transportOk=true && apiOk=false` も **失敗** 扱いにする

### E. class ごとの運用ルールを固定する

- [ ] `class=01`: 登録、response `Medical_Uid` を必ず呼び出し元に返す
- [ ] `class=02`: 削除、既存 `Medical_Uid` 必須
- [ ] `class=03`: 変更、既存 `Medical_Uid` 必須、response の新 `Medical_Uid` で置換
- [ ] `class=04`: 外来追加、扱えるようにする

### F. old busy retry を復活させない

- [ ] `Api_Result=90` だからといって 25 分ループは入れない
- [ ] 送信エラーは呼び出し元に返す
- [ ] 必要なら将来 queue/retry 基盤を別途作る

## 6-4. 完了条件

- [ ] `acceptmodv2 Request_Number=04` が送れる
- [ ] `Claim_Send_Info` が request/response で扱える
- [ ] `medicalmodv2 class=01/02/03/04` が送れる
- [ ] `Medical_Push` を出せる
- [ ] `Medical_Uid` を request/response で扱える
- [ ] ORCA API エラーを HTTP 200 success 扱いしない

## 6-5. テスト

- [ ] `OrcaChartSupportResourceTest` を更新
- [ ] `OrcaChartSupportSupportTest` を更新
- [ ] `OrcaVisitResourceTest` 相当の validation test を追加/更新
- [ ] `Claim_Send_Info` / `Medical_Push` / `Medical_Uid` / `class=04` を個別にテスト

---

# Phase 7. readiness / metrics / 運用面の整備

担当:  
着手日:  
完了日:  
PR:  

## 7-1. 目標

- Push の死活を readiness で見えるようにする
- event 件数、duplicate 件数、失敗件数、recovery 件数を見えるようにする
- 障害時に「何が起きているか」がログ・管理 API で追えるようにする

## 7-2. readiness の追加

### A. `OperationsReadinessEvaluator` を修正

- [ ] check 名を `orcaPush` で追加
- [ ] 判定ルールを以下で固定
  - [ ] push disabled: `DISABLED`（overall healthy）
  - [ ] push enabled + connected: `UP`
  - [ ] push enabled + disconnected: `DOWN`
  - [ ] push enabled + DEGRADED: `DOWN`
- [ ] details に以下を入れる
  - [ ] `connected`
  - [ ] `facilityCount`
  - [ ] `lastConnectedAt`
  - [ ] `lastEventAt`
  - [ ] `lastError`
  - [ ] `recoveryEnabled`

## 7-3. metrics を追加

### A. `OrcaPushMetricsRegistrar` を作る

- [ ] Gauge / Counter は既存 Micrometer に乗せる
- [ ] 以下のメトリクスを追加
  - [ ] `opendolphin_orca_push_connected`
  - [ ] `opendolphin_orca_push_events_received_total`
  - [ ] `opendolphin_orca_push_events_duplicate_total`
  - [ ] `opendolphin_orca_push_events_failed_total`
  - [ ] `opendolphin_orca_push_reconnect_total`
  - [ ] `opendolphin_orca_push_recovery_total`

### B. タグ

- [ ] `facilityId`
- [ ] `eventName`
- [ ] `outcome`（success / duplicate / failed）
- [ ] 必要なら `mode`（shadow / live）

## 7-4. audit / log を追加

- [ ] 接続成功
- [ ] subscribed 成功
- [ ] 切断
- [ ] reconnect 開始
- [ ] reconnect 成功
- [ ] duplicate event
- [ ] replay-gap 発火
- [ ] recovery 成功 / 失敗
- [ ] medical partial failure
- [ ] admin config change による reconnect

## 7-5. 完了条件

- [ ] readiness に `orcaPush` が出る
- [ ] metrics が出る
- [ ] disconnect / duplicate / recovery がログから追える

## 7-6. テスト

- [ ] `OperationsReadinessResourceTest` を更新
- [ ] `OperationsHealthResourceTest` を更新
- [ ] readiness detail の expected JSON を更新

---

# Phase 8. legacy 廃止と名称整理

担当:  
着手日:  
完了日:  
PR:  

## 8-1. 目標

- 誤解を生む API 名を無くす
- 旧 file cache 系を消す
- 旧 websocket 依存を消す

## 8-2. 実装手順

### A. `OrcaMedicalModV2Resource` を rename する

現状 `/orca/medicalmodv2/outpatient` は「ORCA の `/api21/medicalmodv2` を叩く API」に見えるが、実際はローカル外来情報返却 API。危険なので rename する。

- [ ] class 名を `OrcaLocalMedicalOutpatientResource` に変更する
- [ ] path を `/orca/local-medical/outpatient` に変更する
- [ ] audit action / resource 名も変更する
- [ ] 関連テスト / import を更新する
- [ ] **互換 path は残さない**

### B. `PushEventDeduplicator` を削除する

- [ ] クラス削除
- [ ] テスト削除
- [ ] config key 削除
- [ ] resolver / validator / env sample の参照削除

### C. `pom.xml` の websocket 依存を削除する

- [ ] `jakarta.websocket-api`
- [ ] `jakarta.websocket-client-api`
- [ ] maven-dependency-plugin の ignored unused も消す

## 8-3. 完了条件

- [ ] 誤解しやすい `medicalmodv2/outpatient` path が無くなる
- [ ] file cache 系のコードが残らない
- [ ] 未使用 websocket 依存が残らない

---

# Phase 9. テスト整備

担当:  
着手日:  
完了日:  
PR:  

## 9-1. 最低限必要なテスト一覧

### A. config / migration

- [ ] resolver test
- [ ] validator test
- [ ] flyway consistency
- [ ] fresh schema baseline

### B. admin config

- [ ] `pushUrl` 保存
- [ ] `pushTenantId` 保存
- [ ] invalid `ws/wss` reject

### C. push client

- [ ] subscribed
- [ ] reconnect
- [ ] duplicate
- [ ] bad json
- [ ] config hot reload reconnect

### D. reception push

- [ ] add
- [ ] modify
- [ ] delete
- [ ] duplicate
- [ ] pull retry success
- [ ] pull retry exhausted -> replay-gap
- [ ] live mode で direct SSE 抑止

### E. medical push

- [ ] invoice あり
- [ ] invoice なし fallback
- [ ] multiple invoice
- [ ] partial failure
- [ ] duplicate
- [ ] degraded recovery

### F. outbound API fix

- [ ] `acceptmodv2` requestNumber=04
- [ ] `Claim_Send_Info` request/response
- [ ] `Acceptance_Push` default injection
- [ ] `medicalmodv2 class=01/02/03/04`
- [ ] `Medical_Push`
- [ ] `Medical_Uid`
- [ ] `ok = transportOk && apiOk`

### G. readiness / metrics

- [ ] push disabled
- [ ] push connected
- [ ] push disconnected
- [ ] push degraded

## 9-2. 実行チェック

- [ ] `mvn -q -DskipTests=false test` が通る
- [ ] 既存テストを壊していない
- [ ] rename 後の path を使うテストへ全更新済み

---

# Phase 10. 段階リリース手順

担当:  
着手日:  
完了日:  
PR:  

## 10-1. リリース前チェック

- [ ] admin 画面に `pushUrl` を設定済み
- [ ] クラウドなら client cert / CA cert が正しい
- [ ] on-prem で tenantId 必要時のみ設定済み
- [ ] readiness `orcaPush` が見える
- [ ] metrics scrape できる
- [ ] DB migration 済み

## 10-2. Phase A: 受付 shadow mode

設定:

```env
ORCA_PUSH_ENABLED=true
ORCA_PUSH_SHADOW_MODE=true
ORCA_PUSH_RECEPTION_ENABLED=true
ORCA_PUSH_MEDICAL_ENABLED=false
```

### 実施内容

- [ ] 接続成功確認
- [ ] `patient_accept` 受信確認
- [ ] 詳細 pull 成功確認
- [ ] ただし本番 UI 反映の主経路は既存のまま
- [ ] duplicate / replay-gap / recovery ログを確認

### 合格条件

- [ ] 1 日運用して reconnect / duplicate / gap の挙動が把握できた
- [ ] 異常時のログと readiness が追える
- [ ] 実データで pull 精度に問題がない

## 10-3. Phase B: 受付 live

設定:

```env
ORCA_PUSH_ENABLED=true
ORCA_PUSH_SHADOW_MODE=false
ORCA_PUSH_RECEPTION_ENABLED=true
ORCA_PUSH_MEDICAL_ENABLED=false
```

### 実施内容

- [ ] `OrcaVisitResource` の direct SSE 抑止が効いている
- [ ] `Acceptance_Push=Yes` → `patient_accept` → SSE の一系統になっている
- [ ] 二重配信が無い
- [ ] delete 時の replay-gap で UI が安全に reload できる

### 合格条件

- [ ] 受付リアルタイム配信が Push 経由に切り替わった
- [ ] 二重更新が無い
- [ ] 運用者が gap を検知できる

## 10-4. Phase C: 診療行為 live

設定:

```env
ORCA_PUSH_ENABLED=true
ORCA_PUSH_SHADOW_MODE=false
ORCA_PUSH_RECEPTION_ENABLED=true
ORCA_PUSH_MEDICAL_ENABLED=true
```

### 実施内容

- [ ] `Medical_Push=Yes` 付き送信確認
- [ ] `patient_account` 受信確認
- [ ] `medicalgetv2 class=02` pull 確認
- [ ] partial failure 時の監査確認
- [ ] on-prem recovery limitation を運用へ周知

### 合格条件

- [ ] 診療行為 Push が監査・状態管理込みで安定運用できる
- [ ] recovery limitation を理解した上で運用できる

---

## 補助メモ（担当者が悩まないための固定ルール）

### 6-1. 受付詳細 pull はどの API を使うか

- [x] **第一選択は `acceptmodv2 Request_Number=00`**
- [ ] 旧 `PvtBuilder` の `acceptlstv2` + `patientgetv2` ルートは「参考」に留める
- [ ] どうしても `Request_Number=00` で拾えない特殊例が出たときだけ補助 fallback として再検討する
- [ ] 今回の初回実装では fallback を増やしすぎない

### 6-2. 診療行為詳細 pull はどの API を使うか

- [x] `medicalgetv2 class=02`
- [ ] `Invoice_Number` がある時は invoice 優先
- [ ] 無い時だけ `Sequential_Number=1` fallback

### 6-3. 冪等化キーは何か

- [x] `facilityId + uuid`
- [ ] `id` は使わない
- [ ] `Event_Id` 系キーは使わない

### 6-4. replay-gap をいつ出すか

- [ ] 受付 Push add/modify で詳細 pull が 3 回とも失敗した時
- [ ] recovery 不能な gap を検知した時
- [ ] facility の state が DEGRADED になり、UI 側 reload が必要な時

### 6-5. 送信時に Push をどう有効化するか

- [ ] 受付 live 中は `Acceptance_Push` 未指定なら `Yes`
- [ ] 診療行為 live 中は `Medical_Push` 未指定なら `Yes`
- [ ] shadow mode では送っても良いが、ローカル direct SSE は止めない
- [ ] live mode では direct SSE を止める

---

## 進捗記入欄（運用用）

### Phase 1
- [ ] 実装完了
- [ ] 単体テスト完了
- [ ] レビュー完了
- [ ] develop マージ完了

### Phase 2
- [ ] 実装完了
- [ ] 単体テスト完了
- [ ] レビュー完了
- [ ] develop マージ完了

### Phase 3
- [ ] 実装完了
- [ ] 単体テスト完了
- [ ] レビュー完了
- [ ] develop マージ完了

### Phase 4
- [ ] 実装完了
- [ ] 単体テスト完了
- [ ] shadow 動作確認完了
- [ ] live 切替完了

### Phase 5
- [ ] 実装完了
- [ ] 単体テスト完了
- [ ] shadow 動作確認完了
- [ ] live 切替完了

### Phase 6
- [ ] 実装完了
- [ ] 単体テスト完了
- [ ] 結合確認完了

### Phase 7
- [ ] 実装完了
- [ ] readiness/metrics 確認完了

### Phase 8
- [ ] rename / 削除完了
- [ ] grep で旧名称残骸ゼロ確認完了

### Phase 9
- [ ] 全テスト green
- [ ] CI green

### Phase 10
- [ ] 受付 shadow
- [ ] 受付 live
- [ ] 診療行為 live
- [ ] 本番監視引継ぎ完了

---

## 仕様参照 URL（実装者用）

### ORCA 公式
- Push API 仕様 PDF  
  https://ftp.orca.med.or.jp/pub/data/receipt/tec/push-api/push-api-spec.pdf
- Push API 仕様ページ  
  https://www.orca.med.or.jp/receipt/tec/pushapi/
- API 受付（acceptmodv2）  
  https://www.orca.med.or.jp/receipt/tec/api/acceptmod.html
- API 診療行為送信（medicalmodv2）  
  https://www.orca.med.or.jp/receipt/tec/api/medicalmod.html
- API 診療情報返却（medicalgetv2）  
  https://www.orca.med.or.jp/receipt/tec/api/medicalinfo.html
- API Push Event Get（pusheventgetv2）  
  https://www.orca.med.or.jp/receipt/tec/api/pusheventget.html

### 参照実装
- 松村先生コードを含む公開 README  
  https://github.com/MasudaNaika/OpenDolphin-ORCA-OQS

---

## 最終確認用チェックリスト（全体）

- [ ] 旧コードを「移植」していない
- [ ] Push URL をハードコードしていない
- [ ] tenant-id をハードコードしていない
- [ ] `*` 購読をしていない
- [ ] `uuid` 冪等化になっている
- [ ] file cache を本番経路から排除した
- [ ] `patient_accept` が動く
- [ ] `patient_account` が動く
- [ ] `acceptmodv2 Request_Number=04` が動く
- [ ] `medicalmodv2 class=01/02/03/04` が動く
- [ ] `Medical_Push` / `Medical_Uid` が扱える
- [ ] readiness / metrics / audit が入っている
- [ ] rename / cleanup が済んでいる
- [ ] shadow → live の段階切替手順が準備できている

---

この文書に書いていない追加要件は、原則として実装中に勝手に広げないこと。  
まずはこのチェックリストを上から順に潰し、各 Phase を PR 単位で完了させること。
