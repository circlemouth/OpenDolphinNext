# P1-03 基準データ・fixture 初期化手順

- 更新日: 2026-03-11
- RUN_ID: 20260310T210124Z
- 対象WBS: `P1-03`

## 1. 目的

`P1-04` 以降の性格確認テストで共通利用する最小データセットを固定する。

- 最小患者: 3件（`P1030001`〜`P1030003`）
- カルテパターン: 3件（単票SOAP / 改訂ペア / 添付連携）
- 画像パターン: 2件（PNG/JPEG）
- ORCA連携結果: XML fixture 1件（`patientlst1v2`）

## 2. 追加した資材

- 基準データ SQL（手動適用）
  - `server-modernized/tools/flyway/sql/P1_03__minimal_baseline_seed.sql`
- fixture
  - `server-modernized/src/test/resources/fixtures/p1-03/minimal-dataset.json`
  - `server-modernized/src/test/resources/fixtures/p1-03/orca-patientlst1v2-response.xml`

## 3. 適用手順（ローカルDB）

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f server-modernized/tools/flyway/sql/P1_03__minimal_baseline_seed.sql
```

Docker compose 環境で直接実行する場合:

```bash
docker exec -i opendolphin-postgres-modernized \
  psql -U dolphin -d dolphin -v ON_ERROR_STOP=1 \
  -f /work/server-modernized/tools/flyway/sql/P1_03__minimal_baseline_seed.sql
```

## 4. 検証クエリ

```sql
SET search_path = opendolphin, public;
SELECT patientid, fullname FROM d_patient WHERE facilityid = 'P1.03.FACILITY.0001' ORDER BY patientid;
SELECT docid, versionnumber, parentid FROM d_document WHERE id IN (9102001, 9102002, 9102003, 9102004) ORDER BY id;
SELECT title, uri FROM d_image WHERE id IN (9104001, 9104002) ORDER BY id;
```

## 5. 運用ルール

- 本 SQL は `V*` migration ではない。`flyway migrate` で自動適用しない。
- source tree の `src/main/resources/db/migration` には複製しない。必要な classpath migration は build で `target/classes/db/migration` へ生成する。
- fixture 更新時は `minimal-dataset.json` の `runId` を更新し、差分レビュー時に追跡可能にする。
- `P1-04` 以降のテストケースでこのデータセットを前提にする場合は、テスト側から `datasetId=p1-03-minimal-baseline` を明記する。
