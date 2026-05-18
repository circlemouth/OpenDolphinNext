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
- 本番 source は公式 ORCA マスタ配布ファイル、公式 API 由来 export、または施設内の外部 ETL が ORCA DB コンテナから生成した OpenDolphin canonical artifact に限定する。Trial / WebORCA API の自由語検索を全件 source とみなさない。クラウド OpenDolphin runtime / scheduler は ORCA DB へ直接接続しない。
- WebORCA Trial はリリース前の本番相当 official ORCA 接続先として使用できる。許可範囲は official API の read-only 代表照会、ORCA 側拒否・警告・UNKNOWN 境界の確認、canonical artifact import 後の API/UI/scheduler 動作確認に限定する。Trial の自由語検索、候補検索、画面検索、個別 lookup の網羅試行を全件 master source または production artifact source にしてはならない。
- 本番 OpenDolphin canonical artifact は versioned ZIP とし、`manifest.json` と `local-orca-master-cache.csv` を含める。CSV は UTF-8 BOM なし、schema は `opendolphin.local-orca-master-cache.v1`。dev/trial fixture と manual fallback だけ CSV / GZIP を許可する。
- canonical artifact は `drug`, `etensu`, `generic-price`, `generic-class`, `comment`, `bodypart`, `youhou`, `material`, `kensa-sort`, `hokenja`, `address`, `order-inputsets`, `order-interactions`, `disease-candidate` をすべて含める。必須 header 欠落、必須 master type 欠落、空 artifact、JSON 不正、入力セット不整合、部分 import 失敗、manifest/hash/件数不一致は fail closed とする。
- production artifact builder は公式配布ファイル、公式 API 由来 export、または tool-only の ORCA DB コンテナ ETL が生成した正規化済み source から versioned ZIP を生成する。ORCA DB コンテナは施設内 ETL / dev / staging のみで使い、本番 runtime / scheduler / importer の直接接続先にしない。
- `POST /api/admin/master-updates/datasets/local_orca_master_cache/upload/preview` は multipart ZIP を検証し、DB 更新なしで `uploadedSha256`、manifest metadata、`masterVersion`、`masterTypeCounts`、`warnings`、`importable` を返す。確定 upload は任意 header `X-Master-Artifact-Preview-Hash` を受け、payload hash が一致しない場合は 409 `upload_preview_hash_mismatch` とする。
- `GET /api/admin/master-updates/datasets*` の dataset / version response は `masterTypeCounts` を返す。管理画面の差分判断は総件数の増減推定ではなく、保存済み `masterTypeCounts` と総件数変化を表示する。既存 `addedCount` / `removedCount` / `changedCount` は互換表示用であり、新しい安全判断には使わない。
- `POST /api/admin/master-updates/datasets/local_orca_master_cache/rollback` は対象 version の `artifactPath` を再 import し、候補 API が読む `opendolphin.local_orca_master_*` 実体を rollback 先 artifact に戻す。管理 metadata の pointer だけを切り替えない。artifact 欠落、stored hash 欠落、hash 不一致、必須 master type 不足、manifest/hash/件数不一致、import 失敗は fail closed とし、`currentVersionId` / `currentRecordCount` / status / successful timestamp を更新しない。
- rollback 成功時だけ `currentVersionId`、`currentRecordCount`、`currentMasterTypeCounts`、`status`、`lastSuccessfulAt`、`latestRunId`、`latestJobMessage` を更新し、response の `localMasterCacheImport` に `affectedMasterTypes`、`masterTypeCounts`、`importedRows` を含める。
- runtime の外部 artifact 取得は HTTPS、credential/query/fragment なし、`MASTER_UPDATE_SOURCE_ALLOWED_HOSTS` の許可 host のみに限定する。`MASTER_UPDATE_LOCAL_ORCA_MASTER_CACHE_SOURCE_URL` は sanitized source metadata としてだけ残し、credential-bearing URL を受け入れない。
- 手動 upload または scheduler 実行で import が失敗した場合、dataset update は failed とし、既存 cache を 0 件成功扱いにしない。API 応答には内部 SQL、DB URL、credential-bearing URL、raw ORCA body、患者情報を含めない。
- `MASTER_UPDATE_SCHEDULER_ENABLED=true` の環境では `MasterUpdateScheduler` が auto-enabled dataset を定期実行する。本番では `MASTER_UPDATE_LOCAL_ORCA_MASTER_CACHE_SOURCE_URL` と `MASTER_UPDATE_SOURCE_ALLOWED_HOSTS` を設定し、classpath fixture ではなく公式 ORCA source 由来 artifact を運用する。

## UI candidate visibility contract
- `GET /api/admin/master-updates/visibility` と `PUT /api/admin/master-updates/visibility` は、業務 UI に表示する ORCA master 候補カテゴリの表示/非表示と、施設単位の処方薬剤検索既定値（`prescriptionDrugSearchMethodDefault: "prefix" | "partial"`）だけを管理する admin-management API です。`/api/orca/master/*` の挙動、local master cache、ORCA 正本、処方/会計/病名送信判定、`/api/orca/master/order/interactions/check` は変更しません。
- 固定カテゴリは `prescription`、`injection`、`procedure`、`test`、`disease`、`patientSupport` です。既定は全カテゴリ `visible=true`、処方薬剤検索は `prefix` です。server は allowlist でカテゴリと検索既定値を検証し、未知カテゴリ、boolean 以外の visible 値、`prefix` / `partial` 以外の検索既定値は 400 で拒否します。
- `PUT` は admin 権限と `admin:mutation` step-up を必須とし、監査ログに actor、runId、changedCategories を残します。設定は `RuntimeStateRepository` の `master_visibility/default` に保存します。
- Web client はこの設定を URL、患者文脈、browser storage へ保存しません。非表示時は候補取得、候補リスト、datalist、候補選択パネルだけを止め、手入力、既存入力値、保存済みデータ表示、ORCA 送信前の通常検証は維持します。
- 非表示表示は「管理画面の設定で候補表示だけを停止中」として扱い、マスタ未取得、ORCA 側利用不可、安全確認済み、会計反映済みとは表示しません。

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
- ETag seed は `masterVersion` だけでなく cache `importedAt` も含める。同一 `masterVersion` の再 import 後に旧 304 を返してはならない。

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
- `drug`、`generic-class`、`generic-price`、`hokenja`、`address`、`comment`、`bodypart`、`youhou`、`material`、`kensa-sort`、`etensu`、`disease-candidate`、`order-inputsets`、`order-interactions` は UI からの `effective` / `asOf` を server で `yyyyMMdd` に正規化して local cache repository へ渡す。effective 未指定時は既存 default を使うが、期限切れ項目を候補成功や安全確認済みとして扱わない。
- `/api/orca/master/order/interactions/check` は local interaction master cache を使う。request body の任意 `effective` は `yyyyMMdd` に正規化して有効日 filter に使う。未インポートまたは backend unavailable は 503 `interaction_unavailable` とし、処方安全上「相互作用なし」扱いにしない。
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
