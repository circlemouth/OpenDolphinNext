# Runtime Config 契約

## 目的
`server-modernized` が起動・運用時に参照する設定を、単一の契約で管理する。設定取得は `ServerConfigurationResolver` を唯一の境界とし、その他のクラスは型付き設定を受け取るだけにする。

## 非機能方針
- 後方互換は保持しない。
- 旧 property / 旧 env / 補完用 fallback は削除する。
- typed config を正本とし、契約はこの文書・`ServerConfigurationResolver`・`config/server-modernized.env.sample` の 3 点で一致させる。
- 取得失敗時は default で誤魔化さず、起動時 validation で fail-fast する。
- runtime-owned flag を `/api/admin/config` へ複製しない。admin UI は runtime setting の owner ではない。

## 正本
- コード正本: `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- 起動用サンプル: `config/server-modernized.env.sample`
- 契約文書: 本ファイル

## 実装ルール
- [x] `System.getenv` / `System.getProperty` / `ConfigProvider.getConfig()` は `ServerConfigurationResolver` 以外で使用しない。
- [x] `ServerConfigurationResolver` は文字列取得だけでなく、型変換・列挙値検証・URI/Path/Duration 検証を行う。
- [x] `ServerConfigurationResolver.raw()` / `optional()` は test override と `ConfigProvider.getConfig()` のみを参照し、raw Java property / env fallback を持たない。
- [x] `RuntimeConfigurationSupport` は I/O を持たない pure utility のみ残し、設定解決責務は持たせない。
- [x] 旧 `dolphin.facilityId` は production tree から除去し、`opendolphin.facility-id` 以外の facility fallback を許容しない。
- [x] 新しい設定キーを追加した場合、同 PR で本ファイルと sample env を更新する。
- [x] admin setting inventory では `orca.mode`、`orca.acceptmod.suppress-acceptance-push`、optional module visibility owner のような runtime-owned 項目を `unknown` または runtime-owned として扱い、toggle を client 側へ出さない。

## 名前付けルール
- dot notation を内部契約とする。
- 環境変数は dot と hyphen を underscore に変換した大文字とする。
- 例: `opendolphin.facility-id` -> `OPENDOLPHIN_FACILITY_ID`

## 必須ドメイン

### 1. Runtime
- `opendolphin.environment` / `OPENDOLPHIN_ENVIRONMENT` 必須
- `opendolphin.timezone` / `OPENDOLPHIN_TIMEZONE` 必須
- `jboss.server.data.dir` / `JBOSS_SERVER_DATA_DIR` 必須
- 暗黙 default timezone は使用しない。未設定は起動失敗。

### 2. ORCA Runtime
- `opendolphin.facility-id` / `OPENDOLPHIN_FACILITY_ID` 必須
- `opendolphin.single-facility-mode` / `OPENDOLPHIN_SINGLE_FACILITY_MODE` は任意。`true` の場合、ログイン時の施設ID入力を省略でき、サーバーは `OPENDOLPHIN_FACILITY_ID` を権威として使う。不一致の client-provided `facilityId` は拒否する。
- `opendolphin.cloud.zero` / `OPENDOLPHIN_CLOUD_ZERO` 必須
- `opendolphin.pvt.list-clear` / `OPENDOLPHIN_PVT_LIST_CLEAR` は `true|false`。受付一覧の 0 時リニューアルを有効化する場合のみ `true`。
- PVT を使う場合は以下も必須
  - `opendolphin.pvt.enabled`
  - `opendolphin.pvt.bind-ip`
  - `opendolphin.pvt.port`
  - `opendolphin.pvt.encoding`
  - `opendolphin.pvt.accept-timeout-millis`
  - `opendolphin.pvt.read-timeout-millis`
  - `opendolphin.pvt.max-threads`
  - `opendolphin.pvt.queue-capacity`
  - `opendolphin.pvt.retry.max`
  - `opendolphin.pvt.retry.backoff-millis`
  - `opendolphin.pvt.idempotency-window-millis`
  - `opendolphin.pvt.poison-queue-capacity`
- 任意の運用閾値
  - `opendolphin.pvt.worker-health.stale-success-seconds`
  - `opendolphin.pvt.worker-health.max-processing-millis`

### 3. DB / ORCA DB
- `db.*` または `orca.db.*` のどちらか一式を必須とする。
- ORCA 専用接続を使う場合は `orca.db.*` を完全指定し、中途半端な混在を禁止する。
- 必須項目
  - `*.host`
  - `*.port`
  - `*.name`
  - `*.user`
  - `*.password`
  - `*.sslmode`
  - `*.sslrootcert`

### 4. ORCA API
- `orca.mode` / `ORCA_MODE` は `weborca|onprem` のいずれか。
- 接続先は次のどちらか一方のみ許可する。
  - `orca.base-url` / `ORCA_BASE_URL`
  - `orca.api.host` + `orca.api.port` + `orca.api.scheme`
- `orca.api.user` / `ORCA_API_USER` と `orca.api.password` / `ORCA_API_PASSWORD` は必須。
- `orca.api.path-prefix` / `ORCA_API_PATH_PREFIX` は空か `/` 始まり。
- `orca.api.retry.max` / `ORCA_API_RETRY_MAX` は 0 以上。
- `orca.api.retry.backoff-ms` / `ORCA_API_RETRY_BACKOFF_MS` は 0 以上。
- ORCA HTTP transport の任意設定
  - `orca.api.retry.network.max` / `ORCA_API_RETRY_NETWORK_MAX` は 0 以上。
  - `orca.api.retry.transient.max` / `ORCA_API_RETRY_TRANSIENT_MAX` は 0 以上。
  - `orca.api.retry.network.backoff-ms` / `ORCA_API_RETRY_NETWORK_BACKOFF_MS` は 0 以上。
  - `orca.api.retry.transient.backoff-ms` / `ORCA_API_RETRY_TRANSIENT_BACKOFF_MS` は 0 以上。
  - `orca.api.connect-timeout-ms` / `ORCA_API_CONNECT_TIMEOUT_MS` は 1 以上のミリ秒。
  - `orca.api.read-timeout-ms` / `ORCA_API_READ_TIMEOUT_MS` は 1 以上のミリ秒。
  - `orca.api.total-timeout-ms` / `ORCA_API_TOTAL_TIMEOUT_MS` は 1 以上のミリ秒。
  - `orca.http.log-mode` / `ORCA_HTTP_LOG_MODE` は `quiet|summary|detail|debug`。
  - `opendolphin.orca.allow.insecure.http` / `OPENDOLPHIN_ORCA_ALLOW_INSECURE_HTTP` は production-like 環境では既定 `false`。`true` は localhost / loopback / RFC1918 private range 向け HTTP 接続の限定例外のみ。
  - `orca.transport.cache.ttl-ms` / `ORCA_TRANSPORT_CACHE_TTL_MS` は 0 以上。
- ORCA proxy 応答ヘッダ転送の任意設定
  - `orca.proxy.forward.x-orca-headers` / `ORCA_PROXY_FORWARD_X_ORCA_HEADERS` は `true|false`。未設定時は `false`。
  - `orca.proxy.forward.api-result-message-header` / `ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER` は `true|false`。未設定時は `false`。
  - `orca.acceptmod.suppress-acceptance-push` / `ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH` は `true|false`。未設定時は `false`。
    - WebORCA 環境固有の workaround が必要な場合のみ明示的に `true` を入れ、client 側で `Acceptance_Push` を補完・抑止しない。
- ORCA Push runtime 設定
  - `orca.push.enabled` / `ORCA_PUSH_ENABLED` は `true|false`。未設定時は `false`。
  - `orca.push.shadow-mode` / `ORCA_PUSH_SHADOW_MODE` は `true|false`。未設定時は `true`。
  - `orca.push.reception.enabled` / `ORCA_PUSH_RECEPTION_ENABLED` は `true|false`。未設定時は `true`。
  - `orca.push.medical.enabled` / `ORCA_PUSH_MEDICAL_ENABLED` は `true|false`。未設定時は `false`。
  - Push を有効化する場合、以下を必須とする。
    - `orca.push.connect-timeout-ms` / `ORCA_PUSH_CONNECT_TIMEOUT_MS`
    - `orca.push.ping-interval-seconds` / `ORCA_PUSH_PING_INTERVAL_SECONDS`
    - `orca.push.idle-timeout-seconds` / `ORCA_PUSH_IDLE_TIMEOUT_SECONDS`
    - `orca.push.reconnect.initial-delay-ms` / `ORCA_PUSH_RECONNECT_INITIAL_DELAY_MS`
    - `orca.push.reconnect.max-delay-ms` / `ORCA_PUSH_RECONNECT_MAX_DELAY_MS`
    - `orca.push.recovery.interval-minutes` / `ORCA_PUSH_RECOVERY_INTERVAL_MINUTES`
    - `orca.push.recovery.initial-lookback-minutes` / `ORCA_PUSH_RECOVERY_INITIAL_LOOKBACK_MINUTES`
    - `orca.push.recovery.overlap-minutes` / `ORCA_PUSH_RECOVERY_OVERLAP_MINUTES`
    - `orca.push.dedup.retention-days` / `ORCA_PUSH_DEDUP_RETENTION_DAYS`
  - `orca.push.recovery.use-pusheventget` / `ORCA_PUSH_RECOVERY_USE_PUSHEVENTGET` は cloud recovery 補助用途のみ。
- 旧 ORCA リソース補助設定は必要時のみ明示投入する。
  - `orca.facility.jmari-code` / `ORCA_FACILITY_JMARI_CODE` は 12 桁。
  - `orca.facility.healthcarefacility-code` / `ORCA_FACILITY_HEALTHCAREFACILITY_CODE` は 10 桁。
  - `orca.rp.default-inout` / `ORCA_RP_DEFAULT_INOUT` は `in|out`。

### 5. Metrics / Scheduler / SMTP
- `master-update.scheduler.enabled` / `MASTER_UPDATE_SCHEDULER_ENABLED` は `true|false`。未設定時は `false`。
- `chart-event.history.purge.enabled` / `CHART_EVENT_HISTORY_PURGE_ENABLED` は `true|false`。未設定時は `false`。
- `chart-event.history.purge.interval-minutes` / `CHART_EVENT_HISTORY_PURGE_INTERVAL_MINUTES` は 1 以上。purge を有効化した環境のみ指定する。
- `orca.patient-sync.enabled` / `ORCA_PATIENT_SYNC_ENABLED` は `true|false`。未設定時は `false`。
- `orca.patient-sync.interval-minutes` / `ORCA_PATIENT_SYNC_INTERVAL_MINUTES` は 1 以上。
- `orca.patient-sync.initial-lookback-days` / `ORCA_PATIENT_SYNC_INITIAL_LOOKBACK_DAYS` は 0 以上。
- `orca.patient-sync.include-test-patient` / `ORCA_PATIENT_SYNC_INCLUDE_TEST_PATIENT` は `true|false`。
- `orca.patient-sync.include-insurance` / `ORCA_PATIENT_SYNC_INCLUDE_INSURANCE` は `true|false`。
- patient sync の施設単位スケジュールは `orca_job_schedule` を正本とし、single-facility fallback は持たない。
- `metrics.registry.jndi` / `METRICS_REGISTRY_JNDI` は Micrometer `MeterRegistry` を引く JNDI 名。未設定時は `java:jboss/micrometer/registry`。
- `jboss.bind.address` / `JBOSS_BIND_ADDRESS` は運用上表示する bind address を固定したい場合のみ指定する。未設定時はホスト解決値を使う。
- `security.trusted-proxies` / `SECURITY_TRUSTED_PROXIES` は CSV の IP/CIDR。未設定時は forwarded ヘッダを信用しない。
- `opendolphin.templates.dir` / `OPENDOLPHIN_TEMPLATES_DIR` は帳票テンプレートの最優先探索パス。絶対パス推奨。
- `opendolphin.license.dir` / `OPENDOLPHIN_LICENSE_DIR` は `license.properties` の配置先。未設定時は `jboss.server.data.dir` を使う。
- SMTP 利用時は以下を指定する。
  - `smtp.host` / `SMTP_HOST`
  - `smtp.from` / `SMTP_FROM`
- 任意項目
  - `smtp.port` / `SMTP_PORT`
  - `smtp.auth` / `SMTP_AUTH`
  - `smtp.username` / `SMTP_USERNAME`
  - `smtp.password` / `SMTP_PASSWORD`
  - `smtp.bcc` / `SMTP_BCC`
  - `smtp.starttls` / `SMTP_STARTTLS`
  - `smtp.activity.to` / `SMTP_ACTIVITY_TO`
- `smtp.auth=true` のとき `smtp.username` / `smtp.password` は必須。旧 `cloud.zero.mail.*` / `opendolphin.smtp.*` fallback は廃止。

### 6. Attachment Storage
- `attachment.storage.mode` は `s3` または `disabled` で必須。
- `s3` は production-like / storage-enabled runtime の唯一の保存 mode。
- `disabled` は WebORCA Trial 検証用の object-storage-free dev/Trial profile 専用。production-like environment では `ServletStartup` guard が拒否する。
- `attachment.storage.mode=database` やその他の mode は起動失敗にする。
- local filesystem fallback は追加しない。
- database LOB fallback は復活させない。
- `disabled` 時は `attachment.storage.s3.*` を一切設定してはならない。bucket / region / endpoint / base-path / force-path-style / 暗号化 / multipart threshold / access-key / secret-key の混入は起動前 validation で拒否する。
- `disabled` 時は attachment upload/download、patient image upload/download、legacy image externalization は fail closed とし、object storage ready とは扱わない。
- `s3` は AWS 専用ではなく、S3 互換 object storage を意味する。
- `s3` 時は以下を必須。
  - `attachment.storage.s3.bucket`
  - `attachment.storage.s3.region`
  - `attachment.storage.s3.access-key`
  - `attachment.storage.s3.secret-key`
- 任意項目
  - `attachment.storage.s3.endpoint`
  - `attachment.storage.s3.base-path`
  - `attachment.storage.s3.force-path-style`
  - `attachment.storage.s3.server-side-encryption`
  - `attachment.storage.s3.kms-key-id`
  - `attachment.storage.s3.multipart-threshold-mb`
- `attachment.storage.s3.endpoint` と `attachment.storage.s3.force-path-style` で MinIO を含む S3 互換 endpoint へ接続できること。
- 保存メタ情報は server 側で生成し、object storage provider / bucket / key / version / ETag を DB へ保持する。
- attachment reference row は object metadata を共有しても asset owner ではない。reference remove で object delete を起こさないこと。

### 7. Patient Images
- `patient-images.enabled` = `true|false`
- `patient-images.enabled` が `true` の場合、以下を必須。
  - `patient-images.max-bytes`
  - `patient-images.max-width`
  - `patient-images.max-height`
- `patient-images.max-bytes` は 1 MiB 以上 20 MiB 以下。
- `patient-images.max-width` / `max-height` は 1 以上 8192 以下。

### 8. Second Factor
- `factor2.aes-key-b64` 必須。
- Base64 デコード後 32 bytes 以上。

### 9. Document Integrity
- `document.integrity.mode` は `enforce` 固定。
- `document.integrity.keyring-path` は絶対パスで、`algorithm=HMAC-SHA256` / active ちょうど 1 件 / `keyId` 重複不可 / `hmacKeyB64` 32 bytes 以上を満たす keyring JSON を指す。
- `setup-modernized-env.sh` の dev 起動は `DOCUMENT_INTEGRITY_KEYRING_PATH` 未設定時だけ ignored な local keyring を生成する。本番相当起動では `DOCUMENT_INTEGRITY_MODE=enforce` と明示 keyring を必須とする。

### 10. Dev Object Storage
- `setup-modernized-env.sh` の dev 起動で S3 attachment storage を使う場合、`MINIO_ROOT_PASSWORD` 未設定時だけプロセス内でランダム値を生成し、MinIO root / attachment S3 / PHR export S3 の secret として同一実行内に export する。
- 生成値は stdout / log / tracked file / sample config / QA summary に出さない。object-storage-free profile では引き続き `ATTACHMENT_STORAGE_S3_*` / `PHR_EXPORT_S3_*` / `MINIO_*` が設定済みなら fail closed する。

### 11. Secret Protector 分離
- `factor2.aes-key-b64` は 2FA 専用。
- `orca.credentials.aes-key-b64` / `ORCA_CREDENTIALS_AES_KEY_B64` は ORCA 接続情報専用。
- 同一キーの使い回しを禁止する。

### 12. Chart Event History
- `chartEvent.history.replayLimit` / `CHARTEVENT_HISTORY_REPLAYLIMIT` は 1 以上。未設定時は 200。
- `chartEvent.history.retentionCount` / `CHARTEVENT_HISTORY_RETENTIONCOUNT` は 0 以上。未設定時は 10000。
- `chartEvent.history.retentionHours` / `CHARTEVENT_HISTORY_RETENTIONHOURS` は 0 以上。未設定時は 24。

## 起動時 validation 要件
- [x] 必須キー欠落を 1 件でも検出したら起動失敗にする。
- [x] 列挙値不正・URI 不正・Base64 不正・Path 不正も起動失敗にする。
- [x] PVT 無効時のみ PVT 詳細設定の欠落を許可する。
- [x] PVT worker health 閾値は未設定時に利用側既定値（`staleSuccessSeconds=180`, `maxProcessingMillis=30000`）を使用できる。
- [x] `attachment.storage.mode=s3` を storage-enabled runtime として許可し、それ以外の保存 mode は起動失敗にする。
- [x] WebORCA Trial 用に `attachment.storage.mode=disabled` を明示 profile として許可する。ただし production-like では拒否し、S3/MinIO/PHR S3 設定の混入を拒否する。
- [x] runtime 必須値として `opendolphin.environment` / `opendolphin.timezone` / `jboss.server.data.dir` を検証する。
- [x] ORCA runtime 必須値として `opendolphin.facility-id` / `opendolphin.cloud.zero` と、PVT 有効時の listener 詳細を検証する。
- [x] datasource 必須値として `*.host` / `*.port` / `*.name` / `*.user` / `*.password` / `*.sslmode` / `*.sslrootcert` を検証する。
- [x] scheduler は `chart-event.history.purge.enabled=false` / `orca.patient-sync.enabled=false` を既定とし、明示 enable なしで動かさない。
- [x] `attachment.storage.mode=s3` のとき bucket / region / access-key / secret-key を必須とする。
- [x] `attachment.storage.s3.endpoint` / `attachment.storage.s3.force-path-style` を resolver で解決し、S3 互換 object storage 接続に使えることを検証する。
- [x] `patient-images.enabled=true` のとき max-bytes / max-width / max-height を必須とする。
- [x] `document.integrity.mode=enforce` と keyring-path を必須とする。
- [x] `orca.mode` / `orca.base-url` / `orca.api.*` / ORCA secret protector を検証する。
- [x] ORCA HTTP transport の retry / timeout / log mode / insecure HTTP / cache TTL を検証する。
- [x] ORCA legacy 補助設定 / trusted proxy / template path / license path / chart event history 閾値の型変換を resolver に集約する。
- [x] `config/server-modernized.env.sample` と resolver のキー集合が一致することを CI で検証する。

## 実装タスク
- [x] `ServerRuntimeConfiguration` に attachment storage / patient images / document integrity / ORCA API / secret protector の型を追加する。
- [x] `ServerRuntimeConfiguration` に ORCA HTTP transport 型を追加する。
- [x] `ServerRuntimeConfiguration` に ORCA legacy / trusted proxy / template path / license path / chart event history / bind address / PVT list clear 型を追加する。
- [x] `ServerConfigurationResolver` へ上記ドメインの解決ロジックを追加する。
- [x] `ServerConfigurationValidator` で全ドメインを検証する。
- [x] `RuntimeConfigurationSupport` から設定解決責務を除去する。
- [x] `config/server-modernized.env.sample` を resolver と一致させる。
- [x] CI に `server-modernized/tools/ci/check-config-contract.sh` を追加する。
- [x] CI に `server-modernized/tools/ci/check-no-direct-runtime-lookup.sh` を追加する。

## 受け入れ条件
- [x] `rg 'System\\.get(env|Property)|ConfigProvider\\.getConfig\\(' server-modernized/src/main/java -n` の結果が `ServerConfigurationResolver.java` の `ConfigProvider.getConfig()` のみに限定される。
- [x] `rg 'dolphin\\.facilityId' server-modernized -n` の結果が 0 件になる。
- [x] `bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"` が、`ServerConfigurationResolver.java` のみを allowlist とした状態で成功する。
- [x] `config/server-modernized.env.sample` に resolver の全キーが掲載される。
- [x] 起動時 validation が attachment storage / patient images / document integrity / ORCA API / PVT を含めて失敗することをテストで確認する。
