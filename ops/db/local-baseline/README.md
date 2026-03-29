# Local Synthetic Baseline

`local_synthetic_seed.sql` は公式 Postgres dump が無い環境でも Legacy / Modernized 双方の DB を最小構成で初期化するための SQL 断片です。

## 使い方
1. `docker compose` で `db` もしくは `db-modernized` を起動する。
2. Hibernate (`hibernate.hbm2ddl.auto=update`) によりテーブルが生成されていることを `psql \dt` で確認する。初回のみ `./scripts/start_legacy_modernized.sh start --build` を流してテーブル作成を促す。
3. `docker exec -i <container> psql -U <user> -d <db> -f /workspace/ops/db/local-baseline/local_synthetic_seed.sql` を実行する（パスはリポジトリをマウントした場所に合わせて調整）。
4. `SELECT userId, commonName FROM d_users WHERE userId='LOCAL.FACILITY.0001:dolphin';` でレコードが入ったことを確認する。

## 生成される内容
- `facility_num` シーケンス（START 200）。
- `d_facility` へのローカル施設レコード（`LOCAL.FACILITY.0001`）。
- `d_users` へのテストユーザー（`LOCAL.FACILITY.0001:dolphin`）。
- 上記ユーザーに `d_roles` の `system-administrator` 権限を付与。
- `d_patient`/`d_karte` に最低限の患者 + Karte を登録（各 facility に patientId `00001`）。

> **注意**: 医療機関や患者の実データは含まれていません。必要に応じて `ops/tests/api-smoke-test` の CLI と `docs/runbooks/release-validation.md` の確認手順を併用してください。

## E2E 再現 seed（受付/診療/会計/帳票）
`e2e_repro_seed.sql` は E2E の再現性を高めるためのシナリオ seed を追加します。`local_synthetic_seed.sql` を先に適用したうえで実行してください。

```bash
RUN_ID=20260126T115023Z scripts/seed-e2e-repro.sh
```

適用後は `d_patient_visit` と `d_document` にシナリオ用レコードが追加され、当日分の受付一覧・診療/会計/帳票の UI シナリオが再現可能になります。

### E2E 前提条件（再現性の担保）
- ORCA 実データは不要（本 seed はローカル DB のみを対象）。
- ORCA 実環境/Trial を使う検証は `src/orca_preprod_issue_catalog_resolution_20260123/09_test_data_validation/02_ORCAデータ準備手順.md` に従う。
- Web クライアントの接続先は `setup-modernized-env.sh` で起動した Modernized サーバーに向けること。
- 対象コンテナ: `opendolphin-postgres-modernized-<worktree>`
- 対象 DB: `opendolphin_modern` / ユーザー `opendolphin`
- 影響範囲: patientId `10010-10013` の **当日分のみ**（`d_patient_visit` と seed 文書の当日分を削除→再投入）

## Stamp Tree OID キャスト再適用

`stamp_tree_oid_cast.sql` は `d_stamp_tree.treebytes` 列が `oid` 型になっている環境で、`bytea` 経由の ORM 永続化を許可するための関数＆暗黙キャストを再登録するスクリプトです。Legacy / Modernized いずれの Postgres でも同じ内容を実行します。

```bash
docker exec -i -e PGPASSWORD=opendolphin opendolphin-postgres \
  psql -U opendolphin -d opendolphin \
  -f /workspace/ops/db/local-baseline/stamp_tree_oid_cast.sql

docker exec -i -e PGPASSWORD=opendolphin opendolphin-postgres-modernized \
  psql -U opendolphin -d opendolphin_modern \
  -f /workspace/ops/db/local-baseline/stamp_tree_oid_cast.sql
```
