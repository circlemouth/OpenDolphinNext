# Flyway 運用ガイド（server-modernized）

## 正本（Single Source of Truth）
- **正本**: `server-modernized/tools/flyway/sql`
- 実行設定: `server-modernized/tools/flyway/flyway.conf`（`flyway.locations=filesystem:server-modernized/tools/flyway/sql`）
- アプリ起動時 / test 時に使う `db/migration` は、Maven が `tools/flyway/sql` から `target/classes/db/migration` へ **生成コピー**する。source tree に手動ミラーは置かない。

### 生成物確認
```bash
mvn -q -f server-modernized/pom.xml -pl server-modernized -am process-resources
find server-modernized/target/classes/db/migration -maxdepth 1 -type f | sort
```

```bash
diff -u \
  <(cd server-modernized/tools/flyway/sql && ls V*.sql | sort) \
  <(cd server-modernized/target/classes/db/migration && ls V*.sql | sort)
```

## 実行
```bash
docker run --rm --network legacy-vs-modern_default \
  -v "$PWD":/workspace -w /workspace \
  flyway/flyway:10.17 \
  -configFiles=server-modernized/tools/flyway/flyway.conf \
  validate
```

```bash
docker run --rm --network legacy-vs-modern_default \
  -v "$PWD":/workspace -w /workspace \
  flyway/flyway:10.17 \
  -configFiles=server-modernized/tools/flyway/flyway.conf \
  migrate
```

## バージョン運用ルール
- 同一 `Vxxxx` の重複作成は禁止。
- 競合が発生した場合、後続側を次の空き番号へ繰り上げる（例: `V0240` 重複は片方を `V0244` へ移動）。
- 既に適用済みの migration ファイルは原則変更しない（checksum 破壊防止）。
- `P1_03__minimal_baseline_seed.sql` は手動 seed 用の非 versioned SQL であり、`flyway migrate` の対象には含めない。

## 患者複合キー（一意制約）
- 追加 migration: `V0244__patient_facility_patientid_unique.sql`
- 対象: `opendolphin.d_patient(facilityid, patientid)`

### 事前棚卸し SQL（重複確認）
```sql
SELECT facilityid,
       patientid,
       COUNT(*) AS duplicate_count,
       ARRAY_AGG(id ORDER BY id) AS duplicated_row_ids
  FROM opendolphin.d_patient
 WHERE facilityid IS NOT NULL
   AND patientid IS NOT NULL
 GROUP BY facilityid, patientid
HAVING COUNT(*) > 1
 ORDER BY duplicate_count DESC, facilityid, patientid;
```

### 重複がある場合の対応手順
1. 1組ごとに正として残す `id` を決める（通常は最新更新の1件）。
2. 関連テーブルの外部キーを残す `id` に寄せる。
3. 不要行を削除する。
4. 上記 SQL が 0 行になったことを確認後、`flyway migrate` を再実行する。

## NOT VALID FK の棚卸しと VALIDATE
- 追加 migration: `V0245__validate_not_valid_foreign_keys.sql`
- `opendolphin` スキーマの `NOT VALID` FK を走査し、孤児参照（親が存在しない子行）を削除してから `ALTER TABLE ... VALIDATE CONSTRAINT` を実行する。

### 棚卸し SQL
```sql
SELECT con.conname,
       con.conrelid::regclass AS source_table,
       pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
  JOIN pg_namespace ns
    ON ns.oid = con.connamespace
 WHERE con.contype = 'f'
   AND ns.nspname = 'opendolphin'
   AND con.convalidated = false
 ORDER BY source_table::text, con.conname;
```

- `V0245` 適用後は上記結果が 0 行であること。

## 直近の重要 migration
- `V0242__order_recommendation_indexes.sql`: recommendation 集計用インデックス。
- `V0244__patient_facility_patientid_unique.sql`: 患者複合キーの一意化。
- `V0245__validate_not_valid_foreign_keys.sql`: NOT VALID FK の VALIDATE。

## module 永続化 stopgap 契約
- `bean_json` が module payload の唯一の正本。
- `d_module_payload` は stopgap リリースでは使用しない。作成・移行・検証手順は削除済み。
- startup 時に `d_module_payload` テーブルが存在すると fail-fast で起動拒否される。
