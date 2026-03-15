# P11-01 旧設定読み込み経路の棚卸し

- 日付: 2026-03-15
- RUN_ID: 20260315T000038Z
- タスク: P11-01（`codex_automation_workplan_revised.md` 基準）

## 要約
- `custom.properties` の直接読込は、ORCA 旧経路・PVT 日次更新・SMS 設定に残っている。
- `jboss.home.dir` / WildFly 固有パスへの依存は、設定ファイル探索、テンプレート探索、license 保存先で残っている。
- ローカルファイル state は `license.properties` と ORCA push dedupe cache に残っており、DB 化済みの runtime state と並立している。

## 1. `custom.properties` の直接依存

| 区分 | 実装 | 現在の用途 | 現在の参照元 | 扱い |
|---|---|---|---|---|
| ORCA DB/JMARI 旧設定 | `server-modernized/src/main/java/open/orca/rest/ORCAConnection.java` | ORCA 関連 legacy property の読込、`dolphin.facilityId` の供給 | `jboss.home.dir/custom.properties` を直接読込 | 削除候補。ORCA DB 接続自体は JNDI へ移行済みで、facilityId 等の残存 consumer 切替が必要 |
| ORCA 旧 REST 補助 | `server-modernized/src/main/java/open/orca/rest/OrcaResource.java` | JMARI / 医療機関コード / `orca.orcaapi.*` 読込 | `jboss.home.dir/custom.properties` を直接読込 | 削除候補。`OrcaConnectionConfigStore` / 管理設定へ寄せるべき |
| PVT 日次更新フラグ | `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java` | `pvtlist.clear` の読込 | `jboss.home.dir/custom.properties` を直接読込 | 削除候補。admin config か env/system property へ移管対象 |
| SMS 外部送信設定 | `server-modernized/src/main/java/open/dolphin/msg/gateway/SmsGatewayConfig.java` | Plivo 設定の fallback | 環境変数未設定時のみ `custom.properties` | 据え置き候補だが縮小対象。env を正本にして fallback を将来除去 |

## 2. `custom.properties` の間接依存

| 区分 | 実装 | 現在の用途 | 依存元 | 扱い |
|---|---|---|---|---|
| facilityId fallback | `server-modernized/src/main/java/open/dolphin/mbean/PvtService.java` | PVT 受信 worker の facilityId 解決 | `ORCAConnection.getProperties()` | 削除候補。`dolphin.facilityId` の system/env/DB 正本へ寄せる |
| facilityId fallback | `server-modernized/src/main/java/open/dolphin/session/SessionMessageHandler.java` | JMS 受信時の facilityId 解決 | `ORCAConnection.getProperties()` | 削除候補 |
| facilityId fallback | `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java` | 同期対象 facilityId 解決 | system property 優先、その後 `ORCAConnection.getProperties()` | 削除候補 |

## 3. JBoss / WildFly 固有パス依存

| 区分 | 実装 | 現在の用途 | 現在の探索順 | 扱い |
|---|---|---|---|---|
| 設定探索ハブ | `server-modernized/src/main/java/open/dolphin/runtime/RuntimeConfigurationSupport.java` | config dir / legacy properties path 解決 | `opendolphin.config.dir` → `jboss.server.config.dir` → `jboss.home.dir/standalone/configuration` → `jboss.server.data.dir/config` → `./config` | 据え置き候補。次段で fallback 削減の基準点として使う |
| legacy properties path | 同上 | `custom.properties` の標準位置解決 | `opendolphin.custom.properties.path` → `jboss.home.dir/custom.properties` → `resolveConfigPath("custom.properties")` | 削除候補。legacy fallback を縮退させる対象 |
| テンプレート探索 | `server-modernized/src/main/java/open/dolphin/msg/VelocityHelper.java` | 帳票テンプレート探索 | `open.dolphin.templates.dir` → `jboss.home.dir/templates` → repo `server-modernized/reporting/templates` → `./templates` | 一時据え置き候補。reporting 据え置き方針に従い P11 では inventory のみ |
| 添付設定既定パス | `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java` | `attachment-storage.yaml` 読込 | `ATTACHMENT_STORAGE_CONFIG_PATH` 未設定時 `/opt/jboss/config/attachment-storage.yaml` | 削除候補。WildFly 固定パスを config dir abstraction へ寄せる余地あり |
| license 保存先 | `server-modernized/src/main/java/open/dolphin/system/license/FileLicenseRepository.java` | `license.properties` 読込/保存 | `jboss.home.dir/license.properties` | 強い削除候補。ローカル state の代表残骸 |

## 4. ローカルファイル state / キャッシュ

| 区分 | 実装 | 現在の保存先 | 現在の目的 | 扱い |
|---|---|---|---|---|
| license state | `server-modernized/src/main/java/open/dolphin/system/license/FileLicenseRepository.java` | `jboss.home.dir/license.properties` | 利用 UID / 上限の記録 | DB か secret-backed state へ移管候補 |
| ORCA push dedupe cache | `server-modernized/src/main/java/open/dolphin/orca/support/PushEventDeduplicator.java` | `ORCA_PUSH_EVENT_CACHE_PATH` 指定、なければ `jboss.server.data.dir/orca/pushevent-cache.json`、さらに無ければ相対 `runtime-state/orca/pushevent-cache.json` | ORCA push event の重複抑止 | DB/runtime_state_store へ寄せる候補 |
| attachment config | `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageConfigLoader.java` | YAML ファイル | 添付保存モードと S3 認証情報 | file 正本を維持するなら config dir abstraction 配下へ統一、理想は secret/env 主体 |

## 5. 既に DB 側へ移行済みの設定 / state

| 区分 | 実装 | 保存先 | 備考 |
|---|---|---|---|
| ORCA 接続設定 | `server-modernized/src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java` | `runtime_state_store` | facility 別 record を DB へ保持。legacy `custom.properties` と並立中 |
| 管理設定 | `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java` | `runtime_state_store` | 初期値は env 由来、更新後は DB 正本 |
| ORCA 患者同期 cursor | `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncStateStore.java` | `d_orca_patient_sync_state` | 既に DB 化済み |

## 6. 切り落とし候補の整理

### 優先して切る候補
- `ORCAConnection` 経由の `custom.properties` 読込と、それに依存する `dolphin.facilityId` fallback
- `OrcaResource` の `custom.properties` 直接読込
- `ChartEventServiceBean` の `pvtlist.clear`
- `FileLicenseRepository`
- `PushEventDeduplicator` の相対 `runtime-state/` fallback

### 一時据え置き候補
- `RuntimeConfigurationSupport` 自体の config dir abstraction
- `VelocityHelper` の `jboss.home.dir/templates` fallback
- `SmsGatewayConfig` の env 未設定時 `custom.properties` fallback
- `AttachmentStorageConfigLoader` の YAML 読込自体

## 7. 次段 (`P11-02`) への入力
- ORCA は「DB 正本 + env/bootstrap + legacy fallback」が並立しているため、優先順位の整理が最優先。
- attachment は「env + YAML」が主で DB が未登場。WildFly 固定パスをどう扱うかの整理が必要。
- license / runtime state は DB 化済み系とファイル系が混在しているため、正本の統一方針が必要。
