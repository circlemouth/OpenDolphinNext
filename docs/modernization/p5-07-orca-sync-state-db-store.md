# P5-07 ORCA 同期状態の DB 永続化

- 実施日: 2026-03-12
- RUN_ID: 20260311T150117Z
- 対象: `OrcaPatientSyncStateStore` / Flyway migration

## 実施内容
- `OrcaPatientSyncStateStore` をローカル JSON ファイル保存から DB 永続化へ置換。
  - 参照: `SELECT ... FROM d_orca_patient_sync_state WHERE facility_id = ?`
  - 成功記録: `INSERT ... ON CONFLICT ...` で `last_sync_date` / `last_synced_at` / `last_run_id` / `last_error=NULL` を更新
  - 失敗記録: `INSERT ... ON CONFLICT ...` で `last_synced_at` / `last_run_id` / `last_error` を更新
- 初期化時に `d_orca_patient_sync_state` テーブルの存在を自己確認（`CREATE TABLE IF NOT EXISTS`）。
- Flyway migration を追加（canonical/mirror 同期）。
  - `server-modernized/tools/flyway/sql/V0301__orca_patient_sync_state_store.sql`
  - runtime classpath へは build で生成コピー
- baseline テストを migration 0301 に追従。
  - `FreshSchemaBaselineTest` の適用バージョン期待値を `0301` へ更新
  - 新テーブル存在確認を追加

## 変更ファイル
- `server-modernized/src/main/java/open/dolphin/orca/sync/OrcaPatientSyncStateStore.java`
- `server-modernized/tools/flyway/sql/V0301__orca_patient_sync_state_store.sql`
- `server-modernized/pom.xml`
- `server-modernized/src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`

## 検証
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=FreshSchemaBaselineTest,FlywayMigrationConsistencyTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - FAIL（sandbox 制約: `~/.m2` 追記不可）
