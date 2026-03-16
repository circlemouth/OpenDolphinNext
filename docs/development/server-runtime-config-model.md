# server-modernized 設定モデル

更新日: 2026-03-16  
対象: `server-modernized`

## 目的

`server-modernized` の起動設定を MicroProfile Config 前提の typed contract へ寄せ、`custom.properties` や個別 `System.getenv()` 直読から本番コードを段階的に切り離す。

## 正規 namespace

- `opendolphin.environment`
- `opendolphin.timezone`
- `opendolphin.facility-id`
- `opendolphin.cloud.zero`
- `opendolphin.pvt.*`
- `db.*`
- `orca.db.*`
- `factor2.aes-key-b64`
- `fido2.rp.*`
- `fido2.allowed.origins`
- `plivo.*`

環境変数で投入する場合は MicroProfile Config の標準変換に従い、大文字 + `_` 区切りを使用する。例:

- `opendolphin.environment` -> `OPENDOLPHIN_ENVIRONMENT`
- `orca.db.host` -> `ORCA_DB_HOST`
- `factor2.aes-key-b64` -> `FACTOR2_AES_KEY_B64`

## 起動時必須

以下は fail-fast 対象とする。

- `opendolphin.environment`
- `db.*` または `orca.db.*` の `host/name/user/password`
- `factor2.aes-key-b64`
- `fido2.rp.id`
- `fido2.rp.name`
- `fido2.allowed.origins`

## 段階移行

- `CFG-01/02` で typed config の集約点と起動時 validation を導入済み。
- `CFG-03/04` で `RuntimeConfigurationSupport` を bootstrap helper に縮退し、`ORCAConnection` を typed datasource config + CDI 管理へ移行済み。
- 2026-03-16 時点の残タスクは `SmsGatewayConfig` など一部コンポーネントの直読除去と sample / README の追随である。
