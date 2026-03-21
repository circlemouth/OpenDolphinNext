# Runtime Config 契約

## 目的
`server-modernized` が起動・運用時に参照する設定を、単一の契約で管理する。設定取得は `ServerConfigurationResolver` を唯一の境界とし、その他のクラスは型付き設定を受け取るだけにする。

## 非機能方針
- 後方互換は保持しない。
- 旧 property / 旧 env / 補完用 fallback は削除する。
- typed config を正本とし、契約はこの文書・`ServerConfigurationResolver`・`config/server-modernized.env.sample` の 3 点で一致させる。
- 取得失敗時は default で誤魔化さず、起動時 validation で fail-fast する。

## 正本
- コード正本: `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- 起動用サンプル: `config/server-modernized.env.sample`
- 契約文書: 本ファイル

## 実装ルール
- [ ] `System.getenv` / `System.getProperty` / `ConfigProvider.getConfig()` は `ServerConfigurationResolver` 以外で使用しない。
- [ ] `ServerConfigurationResolver` は文字列取得だけでなく、型変換・列挙値検証・URI/Path/Duration 検証を行う。
- [ ] `RuntimeConfigurationSupport` は I/O を持たない pure utility のみ残し、設定解決責務は持たせない。
- [ ] 新しい設定キーを追加した場合、同 PR で本ファイルと sample env を更新する。

## 名前付けルール
- dot notation を内部契約とする。
- 環境変数は dot と hyphen を underscore に変換した大文字とする。
- 例: `opendolphin.facility-id` -> `OPENDOLPHIN_FACILITY_ID`

## 必須ドメイン

### 1. Runtime
- `opendolphin.environment` / `OPENDOLPHIN_ENVIRONMENT` 必須
- `opendolphin.timezone` / `OPENDOLPHIN_TIMEZONE` 必須
- `jboss.server.data.dir` / `JBOSS_SERVER_DATA_DIR` 必須

### 2. ORCA Runtime
- `opendolphin.facility-id` / `OPENDOLPHIN_FACILITY_ID` 必須
- `opendolphin.cloud.zero` / `OPENDOLPHIN_CLOUD_ZERO` 必須
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
- `orca.api.mode` は `weborca|onprem` のいずれか。
- 接続先は次のどちらか一方のみ許可する。
  - `orca.api.base-url`
  - `orca.api.host` + `orca.api.port` + `orca.api.scheme`
- `orca.api.user` / `orca.api.password` は必須。
- `orca.api.path-prefix` は空か `/` 始まり。
- `orca.api.retry.max` は 0 以上。
- `orca.api.retry.backoff-ms` は 0 以上。

### 5. Attachment Storage
- `attachment.storage.mode` は `database|s3` のいずれかで必須。
- `database` 時は `attachment.storage.database.lob-table` 必須。
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

### 6. Patient Images
- `patient-images.enabled` が `true` の場合、以下を必須。
  - `patient-images.max-bytes`
  - `patient-images.max-width`
  - `patient-images.max-height`
- `patient-images.max-bytes` は 1 MiB 以上 20 MiB 以下。
- `patient-images.max-width` / `max-height` は 1 以上 8192 以下。

### 7. Second Factor
- `factor2.aes-key-b64` 必須。
- Base64 デコード後 32 bytes 以上。

### 8. FIDO2
- `fido2.rp.id` 必須。
- `fido2.rp.name` 必須。
- `fido2.allowed.origins` は 1 件以上の `http|https` URI を必須。

### 9. Document Integrity
- `document.integrity.mode` は `off|permissive|enforce`。
- `mode != off` の場合、`document.integrity.keyring-path` 必須。

### 10. Secret Protector 分離
- `factor2.aes-key-b64` は 2FA 専用。
- `orca.credentials.aes-key-b64` は ORCA 接続情報専用。
- 同一キーの使い回しを禁止する。

## 起動時 validation 要件
- [ ] 必須キー欠落を 1 件でも検出したら起動失敗にする。
- [ ] 列挙値不正・URI 不正・Base64 不正・Path 不正も起動失敗にする。
- [ ] PVT 無効時のみ PVT 詳細設定の欠落を許可する。
- [ ] S3 無効時のみ S3 詳細設定の欠落を許可する。
- [ ] `config/server-modernized.env.sample` と resolver のキー集合が一致することを CI で検証する。

## 実装タスク
- [ ] `ServerRuntimeConfiguration` に attachment storage / patient images / document integrity / ORCA API / secret protector の型を追加する。
- [ ] `ServerConfigurationResolver` へ上記ドメインの解決ロジックを追加する。
- [ ] `ServerConfigurationValidator` で全ドメインを検証する。
- [ ] `RuntimeConfigurationSupport` から設定解決責務を除去する。
- [ ] `config/server-modernized.env.sample` を resolver と一致させる。
- [ ] CI に `tools/ci/check-config-contract.py` を追加する。
- [ ] CI に `tools/ci/check-no-direct-runtime-lookup.py` を追加する。

## 受け入れ条件
- [ ] `rg 'System\\.get(env|Property)|ConfigProvider\\.getConfig\\(' src/main/java` の結果が許可クラスのみに限定される。
- [ ] `config/server-modernized.env.sample` に resolver の全キーが掲載される。
- [ ] 起動時 validation が attachment storage / patient images / document integrity / ORCA API / PVT を含めて失敗することをテストで確認する。
