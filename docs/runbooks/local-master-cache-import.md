# Local Master Cache Import Runbook

## 目的

OpenDolphin local master cache / projection は、薬剤・診療行為・コメント・部位・用法・材料・検査・保険者・住所・入力セット・相互作用・病名候補の入力補助専用 read model である。ORCA 正本、ORCA送信成功、会計反映、患者/病名/会計の正本ではない。

## 標準経路

- 公式 ORCA マスタ配布ファイル、または公式 API 由来の export/import 経路から更新する。
- import job は OpenDolphin server DB の `opendolphin.local_orca_master_*` へ書き込み、runtime API は read-only とする。
- import metadata は `sourceSystem`、`sourceKind`、`sourceApi` または `sourceFile`、`masterType`、`masterVersion`、`effectiveFrom`、`effectiveTo`、`importedAt`、`stale`、`unavailableReason`、`cacheStatus` を必ず更新する。

## 試運転

モダナイズ版サーバーには `local_orca_master_cache` dataset があり、非本番の試運転用 source として `classpath:open/orca/master/local-orca-master-cache-fixture.csv` を持つ。これは import 経路と unavailable/stale 表示の検証用 fixture であり、本番 ORCA 正本ではない。

管理 API から手動実行する場合は、認証済み管理者セッションで次を実行する。

```bash
curl -fsS -X POST \
  "https://<server>/api/admin/master-updates/datasets/local_orca_master_cache/run" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: <run-id>" \
  --data '{"force":true}'
```

ローカルで DB 接続なしに parser / artifact / import job の試運転だけ確認する場合は、次の focused test を使う。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am \
  -Dtest=MasterUpdateServiceTest#runDatasetImportsLocalMasterCacheFixtureAndRecordsVersion test
```

この試運転は OpenDolphin server DB の local cache table だけを import 対象にする。ORCA DB (`ORCADS` / `ORCA_DB_*` / `jma-receipt-docker-db-1`) へ接続してはならない。

## 定期実行

定期更新は既存の `MasterUpdateScheduler` で行う。通常は明示 opt-in とし、サーバー起動時に次を設定する。

```bash
MASTER_UPDATE_SCHEDULER_ENABLED=true
```

`local_orca_master_cache` は catalog 上 `autoEnabled=true`、既定間隔 24 時間で登録される。scheduler は 1 分周期で due dataset を判定し、期限到来時に `runDataset(..., triggerType=AUTO, requestedBy=system:scheduler)` を実行する。

本番で scheduler を有効化する前に、`local_orca_master_cache` の source は公式 ORCA マスタ配布ファイル、または公式 API 由来の import artifact に差し替える。classpath fixture のまま本番マスタ更新に使ってはならない。

## 非標準経路

`jma-receipt-docker-db-1` など ORCA PostgreSQL 直結からの読み込みは標準経路ではない。やむを得ず検証する場合は `ENABLE_LEGACY_ORCA_DB_BRIDGE=true` の非本番・read-only・明示 opt-in とし、production evidence や fixture に credential、DB URL、raw ORCA body、患者情報を残さない。

## 失敗時の扱い

- `NOT_IMPORTED` / `UNAVAILABLE` は 0 件ではなく取得不能として UI/API に表示する。
- `STALE` は候補表示と同時に stale warning を表示する。
- 相互作用 master が取得不能な場合は「相互作用なし」や「安全確認済み」にしない。
- local cache に存在するコードでも ORCA official 送信で拒否・警告・UNKNOWN になる可能性を扱う。
