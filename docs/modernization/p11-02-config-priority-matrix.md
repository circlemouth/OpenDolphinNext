# P11-02 ファイル依存設定の優先順位整理

- 日付: 2026-03-15
- RUN_ID: 20260315T000038Z
- タスク: P11-02（`codex_automation_workplan_revised.md` 基準）

## 目的
- ORCA
- attachment storage
- license / runtime state

について、現行コードの優先順位と、次段で寄せるべき優先順位を整理する。

## 結論

| 領域 | 現行の実効優先順位 | 次段で固定したい優先順位 | 補足 |
|---|---|---|---|
| ORCA 接続設定 | 1. DB (`OrcaConnectionConfigStore`) 2. env/system property bootstrap 3. legacy `custom.properties` 断片依存 | 1. DB 2. env/system property bootstrap 3. fallback なし | `RestOrcaTransport` は DB 正本で十分。legacy `custom.properties` は段階的に除去する |
| attachment storage | 1. env/MicroProfile Config 2. `attachment-storage.yaml` 3. WildFly 固定既定値 | 1. env/secret 2. config dir 配下 YAML 3. fallback なし | 認証情報は env/secret 正本、YAML は非秘匿の構造定義に限定したい |
| license / runtime state | 現在は混在。DB (`runtime_state_store` / 専用 table) と `license.properties` / `pushevent-cache.json` が並立 | 1. DB 2. 明示 env/bootstrap 3. fallback なし | ファイル state を削る方針で統一する |

## 1. ORCA 設定

### 現行
- `OrcaConnectionConfigStore` は `runtime_state_store` を正本にし、初期化時のみ env/system property から default record を起こす。
- `RestOrcaTransport` はまず `OrcaConnectionConfigStore.resolve(facilityId)` を使い、DB 設定が取れない場合だけ `OrcaTransportSettings.load()` に fallback する。
- 一方で legacy 系の `ORCAConnection` / `OrcaResource` は別系統で `jboss.home.dir/custom.properties` を直接読んでいる。

### 推奨
1. ORCA 接続先、資格情報、TLS 資材は `OrcaConnectionConfigStore` を唯一の正本にする。
2. env/system property は DB 初期化用 bootstrap のみ許容する。
3. `custom.properties` 依存は read-only 互換モードも含めて撤去対象にする。

### 次アクション
- `ORCAConnection` 依存の `dolphin.facilityId` fallback を DB or 明示 env/system property へ切替。
- `OrcaResource` の `jamri.code` / `healthcarefacility.code` / `orca.orcaapi.*` を admin/DB 設定へ統合。

## 2. Attachment Storage 設定

### 現行
- `AttachmentStorageConfigLoader` は `ATTACHMENT_STORAGE_CONFIG_PATH` を最優先し、未指定なら `/opt/jboss/config/attachment-storage.yaml` を読む。
- `MODERNIZED_STORAGE_MODE` と各 `ATTACHMENT_S3_*` は YAML より優先される。
- つまり実効優先順位は `env/MicroProfile Config > YAML > code default`。

### 推奨
1. mode と secret は env/secret store を正本にする。
2. YAML は bucket 以外の非秘匿な構造情報、またはローカル開発用 override のみに縮小する。
3. WildFly 固定の `/opt/jboss/config` 既定値は `RuntimeConfigurationSupport.resolveConfigDirectory()` へ寄せ、コンテナ依存を薄くする。

### 次アクション
- `AttachmentStorageConfigLoader` の既定パスを config dir abstraction 配下へ統一する案を次段で実装検討。
- YAML に残す項目と env/secret 必須項目を分離した設定表を作る。

## 3. License / Runtime State

### 現行
- `AdminConfigStore` と `OrcaConnectionConfigStore` は DB (`runtime_state_store`) を使用。
- `OrcaPatientSyncStateStore` も DB table を使用。
- しかし `FileLicenseRepository` は `jboss.home.dir/license.properties` を read/write し、`PushEventDeduplicator` は JSON ファイルへ永続化する。

### 推奨
1. runtime state は DB を第一正本に統一する。
2. env は bootstrap / 明示 override のみ許容する。
3. `license.properties` / `pushevent-cache.json` のようなローカル state は撤去する。

### 次アクション
- license state の DB 化または secret-backed state への移行案を作る。
- ORCA push dedupe cache は `runtime_state_store` か専用 table への移行を前提に、相対 `runtime-state/` fallback を削る。

## 4. 今回の判断

### 据え置き
- `RuntimeConfigurationSupport` の config dir abstraction
- `VelocityHelper` のテンプレート探索 fallback
- `SmsGatewayConfig` の env 未設定時 `custom.properties` fallback

### 次段で切る前提
- `ORCAConnection` / `OrcaResource` / `ChartEventServiceBean` の `custom.properties` 直読
- `FileLicenseRepository`
- `PushEventDeduplicator` のファイル永続化 fallback

## 5. P12 への引き継ぎメモ
- `P12-01` はリポジトリ運用対象の整理なので、今回の設定棚卸し結果とは独立して着手可能。
- ただし `attachment-storage.yaml` や `custom.properties` sample の扱いは、正本/サンプルの区別を崩さないように注意する。
