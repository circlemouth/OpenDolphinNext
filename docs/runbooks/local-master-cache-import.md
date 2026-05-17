# Local Master Cache Import Runbook

## 目的

OpenDolphin local master cache / projection は、薬剤・診療行為・コメント・部位・用法・材料・検査・保険者・住所・入力セット・相互作用・病名候補の入力補助専用 read model である。ORCA 正本、ORCA 送信成功、会計反映、患者/病名/会計の正本ではない。

診療録確定、処方確定、ORCA 送信、会計送信、UNKNOWN 解消を local master cache の import 成功と混同してはならない。local cache に存在するコードでも ORCA official 送信で拒否・警告・UNKNOWN になる可能性を扱う。

## 本番 source

本番 source は公式 ORCA マスタ配布ファイル、公式 API 由来 artifact、または施設内の外部 ETL が ORCA DB コンテナから生成した OpenDolphin canonical artifact に固定する。WebORCA Trial の自由語検索を全件 source とみなしてはならない。クラウド上の OpenDolphin runtime / scheduler が `jma-receipt-docker-db-1`、`ORCADS`、`ORCA_DB_*`、ORCA PostgreSQL を直読みしてはならない。

## WebORCA Trial 本番相当検証の許可範囲

リリース前検証では WebORCA Trial を本番相当の official ORCA 接続先として使ってよい。ただし、緩和されるのは接続先と検証対象環境だけであり、正本境界と master source の条件は緩和しない。

許可する検証:

- official ORCA API の read-only 代表コード照会、最終更新照会、拒否・警告・UNKNOWN になり得ることの確認。
- 公式配布ファイルまたは公式 API 由来 canonical artifact を staging / validation DB に import し、WebORCA Trial への official 送信・照会と境界を照合すること。
- WebORCA Trial の応答を、local cache に存在する候補コードでも ORCA 側で拒否され得ることの証跡として使うこと。
- 管理者 step-up、scheduler、manual upload、rollback、dataset disable、全 scheduler disable の運用フローを Trial 接続設定で検証すること。

禁止する検証:

- WebORCA Trial の自由語検索、候補検索、画面検索、個別 lookup の網羅試行を全件 master source とみなすこと。
- Trial 応答から推測した欠落を「マスタに存在しない」「相互作用なし」「安全確認済み」と扱うこと。
- Trial 由来の不完全な候補集合を production canonical artifact として公開すること。
- Trial の raw ORCA body、Basic 認証値、credential-bearing URL、患者情報を evidence / log / API 応答 / docs に残すこと。

Trial 証跡は sanitized summary だけを残す。必須項目は RUN_ID、接続先分類 (`weborca-trial`)、実行種別 (`read-only` / `admin-import` / `scheduler`)、masterVersion、cacheStatus、件数、代表コードの結果分類、失敗時の sanitized reason とする。raw request/response、credential、患者詳細、内部 SQL、stack trace は残さない。

公式 source の取得は、OpenDolphin server runtime の外で実施する。取得側は ORCA の利用条件に従い、署名検証・展開・文字コード変換・正規化を行い、OpenDolphin server には次の canonical artifact だけを渡す。

- 形式: 本番は versioned ZIP。ZIP 内に `manifest.json` と `local-orca-master-cache.csv` を置く。dev/trial fixture と manual fallback だけ UTF-8 BOM なし CSV / GZIP を許可する。
- 文字コード: OpenDolphin canonical artifact は UTF-8 BOM なし。公式配布ファイルが EUC-JP / 固定長 / p7m / tar.gz の場合は、事前の正規化 pipeline で変換する。
- 必須 master type: `drug`, `etensu`, `generic-price`, `generic-class`, `comment`, `bodypart`, `youhou`, `material`, `kensa-sort`, `hokenja`, `address`, `order-inputsets`, `order-interactions`, `disease-candidate`。
- 必須 header: `recordType,masterType,code,name,kana,category,unit,price,validFrom,validTo,masterVersion,note,searchText,payloadJson,setCode,entity,kind,classCode,className,itemCount,seq,quantity,memo,rowRole,rowSubtype,code2,interactionCode,interactionName,message`。
- `payloadJson` は JSON object だけを許可する。
- `manifest.json` は `schemaVersion=opendolphin.local-orca-master-cache.v1`、`sourceKind`、sanitized `sourceId`、`masterVersion`、`generatedAt`、`artifactSha256`、`masterTypeCounts`、CSV file hash/bytes/rowCount を含める。
- 空 artifact、必須 header 欠落、必須 master type 欠落、入力セット header/item 不整合、相互作用行不備、JSON 不正、manifest/hash/件数不一致は fail closed とする。
- artifact / sidecar / evidence に ORCA 認証情報、Basic 認証値、DB 認証情報、患者情報、credential-bearing URL、raw ORCA body を含めない。

## ORCA DB コンテナ由来 artifact 生成

施設内またはローカルで ORCA DB コンテナを動かし、外部 ETL で canonical artifact を作る運用は許可する。ただし、DB 接続は OpenDolphin server runtime ではなく tool-only の施設内処理に限定する。クラウド上の OpenDolphin は artifact ZIP だけを受け取る。

```bash
ORCA_DB_CONTAINER_NAME=jma-receipt-docker-db-1 \
ORCA_DB_USER=<read-only-user> \
ORCA_DB_PASSWORD=<read-only-password> \
server-modernized/tools/local-master-cache/build-from-orca-db-container.sh \
  --master-version <orca-master-version> \
  --supplemental-dir <canonical-supplemental-dir> \
  --output <artifact-dir>/opendolphin-local-orca-master-cache.zip
```

`--supplemental-dir` は `order-inputsets.csv`、`order-interactions.csv`、`disease-candidate.csv` を必須とする。DB テーブル対応が施設側で確認されるまで、この 3 master type は補助 canonical CSV なしで公開してはならない。ETL は `sourceKind=orca-db-container-artifact`、`sourceId=orca-db-container:<sanitized-id>` の manifest を生成し、必須 master type 欠落、0 件、必須列欠落、JSON 不正、hash 不一致を fail closed にする。

artifact 生成後、成功時だけ HTTPS 配置先へ `latest.zip` と immutable `<masterVersion>-<sha>.zip` を publish する。配置先 URL は credential、query、fragment を含めない。

公式 source の例:

- ORCA ユーザーサイトのマスタ更新履歴、薬剤情報マスタ、相互作用/保険者/住所/点数等の公式配布情報を正本とする。入口は `https://www.orca.med.or.jp/receipt/`。
- 点数系の検証用配布物は ORCA のマスタ更新チェック資料が示す p7m 配布物を署名検証後に canonical CSV へ正規化する。資料例は `https://ftp.orca.med.or.jp/pub/data/qualified/pre-release/master-check-tool-2020-04-01.pdf`。
- 相互作用・保険者など、医療機関 ID / access key / license を要する setup artifact は、資格情報を OpenDolphin repo / log / evidence に残さず、取得専用環境で canonical artifact へ変換する。

更新頻度は 1 日 1 回を標準とし、ORCA のマスタ更新通知が出た日は manual run で即時反映する。公式 source 不達または変換失敗時は既存 cache を 0 件成功扱いにせず、dataset を failed / stale / unavailable として運用判断に回す。

## canonical artifact 生成

公式配布ファイルまたは公式 API 由来 export は、OpenDolphin server runtime の外側で正規化する。正規化済み source directory には `local-orca-master-cache.csv`、または `masters/<masterType>.csv` を置く。どちらも上記 canonical header を使う。

versioned ZIP の生成:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests \
  org.codehaus.mojo:exec-maven-plugin:3.5.0:java \
  -Dexec.mainClass=open.orca.master.LocalOrcaMasterCacheArtifactBuilder \
  -Dexec.args="--source-dir <normalized-source-dir> --output <artifact-dir>/opendolphin-local-orca-master-cache.zip --source-kind official-file --source-id https://<official-source-or-internal-artifact-id> --master-version <orca-master-version>"
```

`source-id` は HTTPS、`orca:`、または tool-only ETL が付与する `orca-db-container:` の sanitized ID に限定し、userinfo / query / fragment / token / password を含めない。builder は UTF-8 BOM、必須 header、必須 master type、JSON object、空 artifact を検査し、versioned ZIP と manifest hash を生成する。

## DB コンテナ parity 検証

`jma-receipt-docker-db-1` / ORCA PostgreSQL は、クラウド OpenDolphin runtime / scheduler の接続先ではない。DB コンテナは dev/staging の parity oracle、または施設内で動く tool-only 外部 ETL の入力元に限定する。OpenDolphin へ渡すのは検証済み canonical artifact ZIP だけであり、DB 接続情報、SQL、raw ORCA body、患者情報は artifact / API / log / docs に残さない。

DB コンテナ側からは秘密情報を含まない sanitized snapshot だけを作る。snapshot の header は次に固定する。

```csv
masterType,rowCount,sampleCode,sampleName,sampleValidFrom,sampleValidTo
```

検証:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests \
  org.codehaus.mojo:exec-maven-plugin:3.5.0:java \
  -Dexec.mainClass=open.orca.master.LocalOrcaMasterCacheParityVerifier \
  -Dexec.args="--artifact <artifact-dir>/opendolphin-local-orca-master-cache.zip --parity-snapshot <sanitized-db-container-parity.csv>"
```

件数、代表コード、名称、有効開始/終了のいずれかが一致しない場合は artifact を公開しない。snapshot、ログ、evidence には DB 接続情報、ORCA 認証情報、患者情報、raw ORCA body を残さない。

## 本番設定

本番で自動取得を使う場合は、サーバー起動時に次を設定する。

```bash
MASTER_UPDATE_LOCAL_ORCA_MASTER_CACHE_SOURCE_URL=https://<allowed-host>/opendolphin-local-orca-master-cache.zip
MASTER_UPDATE_SOURCE_ALLOWED_HOSTS=<allowed-host>
MASTER_UPDATE_SCHEDULER_ENABLED=true
```

`MASTER_UPDATE_LOCAL_ORCA_MASTER_CACHE_SOURCE_URL` は HTTPS のみ、userinfo / query / fragment なし、`MASTER_UPDATE_SOURCE_ALLOWED_HOSTS` に一致する host のみ許可される。credential-bearing URL や signed query URL は使用しない。必要な認証は artifact 配置側で private network / reverse proxy / mTLS などに寄せ、OpenDolphin API 応答や master-update metadata に credential を含めない。

classpath fixture は dev/trial 試運転用であり、本番 source ではない。

## 初回 import

管理 API は管理者 step-up を要求する。認証済み管理者セッションで次を実行する。

```bash
curl -fsS -X POST \
  "https://<server>/api/admin/master-updates/datasets/local_orca_master_cache/run" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: <run-id>" \
  --data '{"force":true}'
```

manual upload を使う場合:

```bash
curl -fsS -X POST \
  "https://<server>/api/admin/master-updates/datasets/local_orca_master_cache/upload/preview" \
  -H "X-Request-ID: <run-id>" \
  -F "file=@opendolphin-local-orca-master-cache.zip"

curl -fsS -X POST \
  "https://<server>/api/admin/master-updates/datasets/local_orca_master_cache/upload" \
  -H "X-Request-ID: <run-id>" \
  -H "X-Master-Artifact-Preview-Hash: <uploadedSha256-from-preview>" \
  -F "file=@opendolphin-local-orca-master-cache.zip"
```

preview は DB を更新せず、manifest、uploadedSha256、masterVersion、sourceKind、master type 別件数、取り込み可否を返す。確定 upload では preview 済み hash を `X-Master-Artifact-Preview-Hash` で渡す。hash 不一致時は拒否する。

import 後、OpenDolphin DB で次を確認する。証跡には件数、status、sanitized source、hash、runId だけを残し、artifact 本文や資格情報を残さない。

```sql
SELECT master_type, cache_status, stale, imported_at, source_kind, master_version
FROM opendolphin.local_orca_master_dataset
ORDER BY master_type;

SELECT master_type, count(*)
FROM opendolphin.local_orca_master_entry
GROUP BY master_type
ORDER BY master_type;

SELECT count(*) FROM opendolphin.local_orca_master_inputset;
SELECT count(*) FROM opendolphin.local_orca_master_inputset_item;
SELECT count(*) FROM opendolphin.local_orca_master_interaction;
```

全 master type の `cache_status` は `CURRENT`、`imported_at` は今回 run の時刻、件数は canonical artifact sidecar と一致している必要がある。

## 定期実行

`MasterUpdateScheduler` は 1 分周期で due dataset を判定し、期限到来時に `runDataset(..., triggerType=AUTO, requestedBy=system:scheduler)` を実行する。`local_orca_master_cache` は catalog 上 `autoEnabled=true`、既定間隔 24 時間である。

本番相当 staging では以下を確認する。

- 初回 due dataset として `local_orca_master_cache` が自動実行される。
- 成功時: dataset status は `normal`、local master dataset は `CURRENT`、version は sanitized source URL と hash を保持する。
- 差分なし: artifact hash が同じで `force=false` の場合、既存 version を維持し `latestJobMessage=差分なし（現行版を維持）` になる。
- artifact 取得失敗: dataset status は `failed`、last failure reason は sanitized message だけ、既存 local cache を 0 件成功扱いにしない。
- import 失敗: 必須列/必須 master type/JSON 不正/空 artifact は `failed` とし、内部 SQL、stack trace、credential-bearing URL、raw ORCA body を応答・監査ログへ出さない。
- 再実行: 取得元復旧後の manual run または次回 scheduler run で `CURRENT` に戻る。
- manual upload 後: version trigger は `UPLOAD`、source は既存 sanitized source を維持し、scheduler は次回 due で configured source から再取得する。

## rollback / disable

rollback は master-update metadata の current version を戻す運用 API であり、ORCA 正本や会計を巻き戻すものではない。

```bash
curl -fsS -X POST \
  "https://<server>/api/admin/master-updates/datasets/local_orca_master_cache/rollback" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: <run-id>" \
  --data '{"versionId":"<previous-version-id>"}'
```

scheduler を止める場合:

```bash
MASTER_UPDATE_SCHEDULER_ENABLED=false
```

緊急時は `/api/admin/master-updates/schedule` の `datasetAutoEnabledOverrides.local_orca_master_cache=false` で dataset 単位に止める。停止後も API は既存 local cache の `CURRENT|STALE|UNAVAILABLE|NOT_IMPORTED` をそのまま返し、未取得を 0 件に変換しない。

## 試運転

ローカルで DB 接続なしに parser / artifact / import job の試運転だけ確認する場合は、focused test を使う。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am \
  -Dtest=LocalOrcaMasterCacheImportServiceTest,MasterUpdateServiceTest#runDatasetImportsLocalMasterCacheFixtureAndRecordsVersion test
```

この試運転は OpenDolphin server DB の local cache table だけを import 対象にする。ORCA DB (`ORCADS` / `ORCA_DB_*` / `jma-receipt-docker-db-1`) へ接続してはならない。

## 失敗時の扱い

- `NOT_IMPORTED` / `UNAVAILABLE` は 0 件ではなく取得不能として UI/API に表示する。
- `STALE` は候補表示と同時に stale warning を表示する。
- 相互作用 master が取得不能な場合は「相互作用なし」や「安全確認済み」にしない。
- local cache に存在するコードでも ORCA official 送信で拒否・警告・UNKNOWN になる可能性を扱う。
- import 失敗は診療録・処方指示・ORCA 送信・会計送信の成功/失敗を変更しない。idempotency key、二重送信防止、監査ログ append-only chain には触れない。
