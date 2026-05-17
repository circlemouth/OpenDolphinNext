# ORCA Master API 契約

## 目的
current repo の server 実装が提供する ORCA master read API の contract を固定し、未実装 placeholder やサポート外 parameter を残さない。

## 方針
- 後方互換は保持しない。
- 実装されていない `scope` は削除する。
- 「今は効かないが将来使う」 parameter を残さない。
- 候補検索・入力補助用 master は OpenDolphin local master cache / projection を使い、production / normal dev runtime で `ORCADS`、`ORCA_DB_*`、ORCA PostgreSQL 直結、`jma-receipt-docker-db-1` に依存しない。
- local master cache は candidate / cache / projection であり、ORCA 会計・ORCA送信結果・患者/病名/会計の正本ではない。
- table / column は OpenDolphin local master cache schema evidence で確認できた範囲だけを使い、ORCA 内部 DB table 名を production master search の前提にしない。
- 503 は backend unavailable のときだけ返す。
- cache / ETag / audit は既存 master API と同じ規約に揃える。

## local master cache metadata
list response と各 entry の `meta` は、少なくとも次を返す。API 応答・監査ログに credential、DB URL、raw ORCA body、患者情報を含めない。

- `sourceSystem`
- `sourceKind`
- `sourceApi` または `sourceFile`
- `masterType`
- `masterVersion`
- `effectiveFrom`
- `effectiveTo`
- `importedAt`
- `stale`
- `unavailableReason`
- `cacheStatus`

`cacheStatus=NOT_IMPORTED|UNAVAILABLE` は 503 とし、0 件検索結果と混同しない。`cacheStatus=STALE` は候補を返してよいが UI/API は stale を明示する。local cache に存在するコードでも ORCA 送信時に ORCA 側で拒否・警告・UNKNOWN になる可能性を扱う。

## import / update contract
- master update dataset `local_orca_master_cache` は OpenDolphin server 側の import job で `opendolphin.local_orca_master_*` を更新する。通常の master search runtime はこの local cache を読むだけで、ORCA DB (`ORCADS` / `ORCA_DB_*`) へ接続しない。
- dev/trial の初期試運転 source は `classpath:open/orca/master/local-orca-master-cache-fixture.csv`。これは import 経路確認用 fixture であり、本番 master の根拠ではない。
- 手動 upload または scheduler 実行で import が失敗した場合、dataset update は failed とし、既存 cache を 0 件成功扱いにしない。API 応答には内部 SQL、DB URL、credential-bearing URL、raw ORCA body、患者情報を含めない。
- `MASTER_UPDATE_SCHEDULER_ENABLED=true` の環境では `MasterUpdateScheduler` が auto-enabled dataset を定期実行する。本番では classpath fixture ではなく公式 ORCA マスタ配布ファイル、または公式 API 由来 artifact を source として運用する。

## `/api/orca/master/generic-price` 契約
### 受け付ける query parameter
- `srycd`
- `effective`

### 挙動
- `srycd` は 9 桁必須。不正時は 422 `SRYCD_VALIDATION_ERROR`。
- exact code lookup とする。
- 0 件は 404 `MASTER_GENERIC_PRICE_NOT_FOUND`。
- backend unavailable は 503 `MASTER_GENERIC_PRICE_UNAVAILABLE`。
- 成功時は単一の generic price entry を返し、ETag / Cache-Control を付与する。

## `/api/orca/master/hokenja` 契約
### 受け付ける query parameter
- `pref`
- `keyword`
- `effective`
- `page`
- `size`
- `includeTotalCount`

### 挙動
- `pref` は指定時 2 桁都道府県コード。不正時は 422 `PREF_VALIDATION_ERROR`。
- search endpoint とする。
- 0 件は 200 で空 list を返す。
- backend unavailable は 503 `MASTER_HOKENJA_UNAVAILABLE`。
- 成功時は list response として返し、ETag / Cache-Control を付与する。

## `/api/orca/master/address` 契約
### 受け付ける query parameter
- `zip`
- `effective`

### 挙動
- `zip` は 7 桁必須。不正時は 422 `ZIP_VALIDATION_ERROR`。
- zip exact lookup とする。
- 0 件は 404 `MASTER_ADDRESS_NOT_FOUND`。
- backend unavailable は 503 `MASTER_ADDRESS_UNAVAILABLE`。
- 成功時は単一の address entry を返し、ETag / Cache-Control を付与する。

## `/api/orca/master/drug` 契約
### 受け付ける query parameter
- `keyword`
- `effective`
- `method`
- `page`
- `size`
- `includeTotalCount`

### 受け付けない query parameter
- `scope`

### `scope` を受け取った場合の挙動
- 400 `unsupported_parameter`
- メッセージ: `scope query parameter is not supported`
- silent ignore を禁止する。

## order helper / master-like API
- `/api/orca/master/order/inputsets` と `/api/orca/master/order/inputsets/{setCode}` は OpenDolphin local master cache / OpenDolphin 管理マスタ由来の候補であり、ORCA 内部入力セット DB 直結を前提にしない。未インポートまたは backend unavailable は 503 `inputset_unavailable` とし、空結果にしない。
- `/api/orca/master/order/interactions/check` は local interaction master cache を使う。未インポートまたは backend unavailable は 503 `interaction_unavailable` とし、処方安全上「相互作用なし」扱いにしない。
- `/api/orca/official/disease-master/name/{param}/` は互換 route 名を維持するが、自由語候補は local disease candidate cache 由来の candidate/readOnly/candidateOnly 応答であり、ORCA 病名正本や `diseaseget/diseasev3` の成功根拠ではない。cache unavailable は明示 503 とする。

## 実装タスク
- [x] `OrcaMasterResource` から `scope` の解決・criteria 反映を削除する。
- [x] `OrcaMasterDao` の `appendDrugScopeFilter()` を削除する。
- [x] API 契約テストを追加し、`scope` 指定時 400 を検証する。
- [x] 将来 `scope` を導入する場合は、列マッピング・fixture・DB fixture・利用画面を含む別チケットで再設計する。
- [x] `generic-price` / `hokenja` / `address` を placeholder 503 ではなく live query contract に差し替える。
- [x] schema validator と table metadata に `generic-price` / `hokenja` / `address` の supported contract を追加する。
- [x] `OrcaMasterResourceTest` で success / validation / not found / cache / backend unavailable を検証する。

## 受け入れ条件
- [x] `scope` が API 仕様・コード・テスト・文書のいずれにも残らない。
- [x] 利用者が unsupported parameter を使った際に明示的な 400 を受け取る。
- [x] `generic-price` / `hokenja` / `address` が placeholder stub ではなく実データ contract を返す。
- [x] 503 は backend unavailable 時に限定される。
