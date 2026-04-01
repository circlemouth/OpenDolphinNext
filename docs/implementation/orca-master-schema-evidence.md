# ORCA Master Schema Evidence

- RUN_ID: `20260401T121039Z`
- 方針: table 名と列名は current repo の現物から確定する。推測では埋めない。
- live ORCA DB access: unavailable in this worktree at確認時点
  - `ORCA_DB_*` / `PG*` 環境変数: 未設定
  - 稼働中コンテナ: `jma-receipt-docker-db-1` 不在

## Evidence Sources

- `artifacts/api-stability/20251124T130000Z/seed/templates/seed-orca05.sql`
- `artifacts/api-stability/20251124T130000Z/seed/templates/seed-orca06.sql`
- `artifacts/api-stability/20251124T161500Z/schema-drift/templates/check_orca05_columns.sql`
- `artifacts/api-stability/20251124T161500Z/schema-drift/templates/check_orca06_columns.sql`
- `artifacts/api-stability/20251123T130134Z/schemas/orca-master-generic-price.json`
- `artifacts/api-stability/20251123T130134Z/schemas/orca-master-hokenja.json`
- `artifacts/api-stability/20251123T130134Z/schemas/orca-master-address.json`

## Confirmed Contracts

### generic-price

- table: `TBL_GENERIC_PRICE`
- repo evidence:
  - seed template inserts into `TBL_GENERIC_PRICE (srycd, name, unit, price, youhoucode, start_date, end_date)`
  - schema drift template expects:
    - `srycd`
    - `price`
    - `yukostymd`
    - `yukoedymd`
    - `upymd`
    - `gecode`
    - `yakkakjncd`

### hokenja

- table: `TBL_HKNJAINF_MASTER`
- repo evidence:
  - schema drift template targets `tbl_hknjainf_master`
  - schema contract JSON maps:
    - `hknjanum` -> insurer number
    - `hknjaname` -> insurer name
  - schema drift template expects:
    - `hknjanum`
    - `hknjaname`
    - `post`
    - `adrs`
    - `banti`
    - `tel`
    - `upymd`

## address

- table: `TBL_ADRS`
- repo evidence:
  - seed template inserts into `TBL_ADRS`
  - schema drift template targets `tbl_adrs`
  - schema contract JSON states zip lookup on `TBL_ADRS`
  - schema drift template expects:
    - `post`
    - `prefname`
    - `cityname`
    - `townname`
    - `prefkana`
    - `citykana`
    - `townkana`
    - `editadrs_name`

## Notes

- `seed-orca06.sql` uses `TBL_HKNJAINF`, but the stronger schema evidence in `check_orca06_columns.sql` points at `TBL_HKNJAINF_MASTER`. 実装は drift template の current contract を優先し、必要に応じて DAO 側で fallback を持たず単一 contract に固定する。
- address contract in old schema JSON mentions empty-body fallback on missing zip, but current task requires `404`. 実装は current task contract を優先する。
- generic-price old schema JSON mentions `price=null` on missing price, but current task requires exact code lookup and `0 件は 404`。実装は current task contract を優先する。
