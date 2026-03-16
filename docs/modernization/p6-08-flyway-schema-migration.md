# P6-08 新 schema 向け Flyway migration 作成

- 実施日: 2026-03-12
- RUN_ID: 20260311T210122Z
- 対象WBS: `P6-08`

## 目的
- `P6-04` で先行実装した module versioned envelope を DB schema 側へ反映する。
- 新規環境（baseline→増分）と既存環境（既存データ保持）の双方で適用可能な migration を用意する。

## 追加 migration
- `server-modernized/tools/flyway/sql/V0302__module_payload_table.sql`
- runtime classpath へは build で生成コピー

## 変更内容
- 新規テーブル `opendolphin.d_module_payload` を追加。
  - `module_id`（PK, `d_module.id` への FK）
  - `schema_version`
  - `module_type`
  - `payload_json`
  - `payload_hash`
  - `created_at`, `updated_at`
- 補助 index を追加。
  - `d_module_payload_type_idx`
  - `d_module_payload_hash_idx`
- `d_module.bean_json` に versioned envelope が入っている行を backfill。
  - `schemaVersion` / `moduleType` / `payloadJson` / `payloadHash` を抽出して upsert。

## テスト更新
- `server-modernized/src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`
  - 適用バージョン期待値を `0302` へ更新。
  - `d_module_payload` テーブル・主要カラム存在確認を追加。

## 検証
- PASS: `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -o -f pom.server-modernized.xml -pl server-modernized -am -DskipTests test-compile`
- PASS: `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -o -f pom.server-modernized.xml -pl server-modernized -am -DargLine=-javaagent:/Users/Hayato/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.12/byte-buddy-agent-1.14.12.jar -Dtest=FlywayMigrationConsistencyTest,AdminAccessResourceTest,AdminOrcaUserResourceTest -Dsurefire.failIfNoSpecifiedTests=false test`（14 tests）
- FAIL(環境制約): `FreshSchemaBaselineTest` は embedded postgres 起動時に `java.net.SocketException: Operation not permitted`（sandbox のソケット bind 制約）

## 次段（P6-09）
- 既存データ移行スクリプトでは `d_module_payload` の件数照合（`d_module` と `d_module_payload`）を標準チェックに含める。
