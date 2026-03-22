# モダナイズ版サーバーのオブザーバビリティ設計

更新日: 2025-11-02（担当: Codex）

WildFly 33 では MicroProfile Metrics 拡張が廃止され、Micrometer サブシステムが標準の計測基盤となる。モダナイズ版サーバー（`server-modernized/`）は Micrometer + Prometheus を前提に計測・監査フローを整備した。

## 1. Micrometer ベースで収集するメトリクス

### 1.1 REST API メトリクス

`open.dolphin.metrics.RequestMetricsFilter` が `io.micrometer.core.instrument.MeterRegistry` を介して以下のメトリクスを発行する。JAX-RS リソースに付与された `@Path` をテンプレート化し、`X-Trace-Id`（`LogFilter` が MDC に保存）と組み合わせて監査ログと突合できる。

| メトリクス名 | 種別 | タグ | 説明 |
| --- | --- | --- | --- |
| `opendolphin_api_request_total` | Counter | `method`, `path` | REST 呼び出し総数。4xx/5xx も含む。 |
| `opendolphin_api_request_duration` | Timer | `method`, `path` | リクエストの処理時間（ナノ秒記録、Prometheus 側で秒換算）。 |
| `opendolphin_api_error_total` | Counter | `method`, `path`, `status` | 4xx／5xx 応答をカウント。ステータスをラベル化。 |

カウンタ／タイマーは Micrometer が自動的に `*_count`, `*_sum` を付与するため、Grafana 上では P95 などのレイテンシ統計を簡易に算出できる。

### 1.2 JDBC コネクションプール

`open.dolphin.metrics.DatasourceMetricsRegistrar` が WildFly の Agroal メトリクス API からプール状態を取得し、Micrometer Gauge として公開する。弱参照による解放を防ぐために Supplier を強参照で保持しつつ、再デプロイ時は既存メトリクスを削除して重複登録を避けている。

| メトリクス名 | 種別 | 説明 |
| --- | --- | --- |
| `opendolphin_db_active_connections` | Gauge | 現在アクティブな JDBC 接続数。 |
| `opendolphin_db_available_connections` | Gauge | プール内で即利用可能な接続数。 |
| `opendolphin_db_max_used_connections` | Gauge | 起動後に観測された同時接続数の最大値。 |

### 1.3 監査ログとの突合

`open.dolphin.rest.LogFilter` は `X-Trace-Id` をリクエストごとに生成し MDC（キー `traceId`）へ格納、`AuditTrailService` と `ExternalServiceAuditLogger` は同じトレース ID を監査イベントへ記録する。`opendolphin_api_error_total` の増加を検知した際は、以下のフローで監査データと照合する。

1. Grafana で該当期間のエラー件数と API パスを把握する。
2. Loki（または `open.dolphin` ログ）から同一 `traceId` のログを抽出し、ユーザー ID／IP／操作を確認する。
3. `AuditEvent` テーブルのチェーンハッシュと照合し、改ざんがないことを保証する。

### 1.4 Chart Event SSE メトリクスとアラート

`ChartEventSseSupport` は来院イベント SSE の履歴状態を Micrometer で公開しており、Prometheus では `chartEvent_history_retained`（Gauge）と `chartEvent_history_gapDetected`（Counter）として取得できる。前者は最新 ID と履歴先頭 ID の差分を計測し、後者は履歴ギャップ検知時にインクリメントされる。

- 履歴ギャップが起きたクライアントには `event: chart-events.replay-gap` / `data: {"requiredAction":"reload"}` の SSE を即時送出し、Touch/Web クライアントへフルリロードを促す。
- Alertmanager 用のしきい値案は `ops/monitoring/chart-event-alerts.yml` に保存した。`chartEvent_history_retained >= 90` を 5 分継続した場合に Warning を通知し、`increase(chartEvent_history_gapDetected[5m]) > 0` で Critical を発報する。Runbook (`docs/server-modernization/phase2/operations/EXTERNAL_INTERFACE_COMPATIBILITY_RUNBOOK.md` 手順 8) とセットで導入する。

### 1.5 JavaTime 出力監視（d_audit_event / ORCA・Touch）

JavaTimeModule 適用後は監査ログ（`d_audit_event.payload`）と ORCA 連携レスポンスの時刻表現が ISO8601（例: `2026-06-18T09:15:30+09:00`）で統一される。実環境で形式が崩れた場合は ORCA 側の署名や医療記録の監査証跡に影響するため、以下の手順で定期的にサンプルを採取し、Loki/Elastic/Grafana から差分を検出する。

#### サンプル採取手順

- 監査ログ採取（Stage / Prod 共通）  
  ```bash
  docker compose exec modernized-db psql -U dolphin -d opendolphin <<'SQL'
  SELECT id,
         event_time,
         action,
         payload::jsonb ->> 'issuedAt'          AS issued_at_iso,
         payload::jsonb #>> '{request,createdAt}' AS payload_created_at
    FROM d_audit_event
   WHERE action IN ('ORCA_INTERACTION','TOUCH_SENDPACKAGE','TOUCH_SENDPACKAGE2')
     AND payload IS NOT NULL
   ORDER BY event_time DESC
   LIMIT 20;
  SQL
  ```
  `issued_at_iso` が `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$` に一致しない場合は Runbook §4.3 の手順で再取得し、エスカレーションする。

- ORCA 連携 CLI（`PUT /orca/interaction`）  
  ```bash
  BASE_URL="https://stage.backend/opendolphin/api"
  curl -sS -X PUT "$BASE_URL/orca/interaction" \
    -H 'Content-Type: application/json' \
    -H 'X-Trace-Id: java-time-'"$(date +%s)" \
    -H 'Authorization: Bearer <token>' \
    -d '{"codes1":["620001601"],"codes2":["610007155"],"issuedAt":"'"$(date --iso-8601=seconds)"'"}' \
    | jq '.issuedAt,.result[].timestamp'
  ```
  レスポンス内 `issuedAt` / `result[].timestamp` が ISO8601 であること、`X-Trace-Id` で `d_audit_event` と突合できることを確認する。

- Touch `sendPackage` CLI（`POST /touch/sendPackage*`）  
  `ops/tools/send_parallel_request.sh` に `PARITY_BODY_FILE` で JSON を渡すと Legacy/Modern 双方のレスポンスを同時取得できる。例:
  ```bash
  export BASE_URL_LEGACY=http://legacy.local:8080/opendolphin/api
  export BASE_URL_MODERN=https://stage.backend/opendolphin/api
  export PARITY_HEADER_FILE=ops/tests/api-smoke-test/headers/touch-stage.txt
  export PARITY_BODY_FILE=tmp/sendPackage-probe.json
  cat >"$PARITY_BODY_FILE" <<'JSON'
  {
    "issuedAt": "2026-06-18T09:30:00+09:00",
    "patientId": "000001",
    "department": "01",
    "bundleList": []
  }
  JSON
  ./ops/tools/send_parallel_request.sh POST /touch/sendPackage JAVATIME_TOUCH_001
  ```
  保存された `artifacts/parity-manual/JAVATIME_TOUCH_001/*/response.json` を `jq -r '.issuedAt'` で抽出し、Legacy/Modern の形式が一致するか比較する。

#### 自動採取スクリプト / Cron

- `ops/monitoring/scripts/java-time-sample.sh` で上記 3 手順（`d_audit_event`、`PUT /orca/interaction`、`POST /touch/sendPackage`）を一括実行できる。`--dry-run` で外部アクセス無しのログを確認してから、本実行で `tmp/java-time/audit-YYYYMMDD.sql` や `tmp/java-time/orca-response-YYYYMMDD.json` を採取する。  
- 主要な環境変数は `JAVA_TIME_BASE_URL_MODERN`（Stage URL）、`JAVA_TIME_AUTH_HEADER` もしくは `JAVATIME_BEARER_TOKEN`（Bearer トークン）、`JAVA_TIME_PSQL_CMD`（`docker compose exec -T modernized-db psql ...` 等）。  
- サーバーに常駐させる Cron 設定例:
  ```cron
  # Stage JavaTime サンプル採取 (毎日 03:00 JST)
  0 3 * * * cd /opt/opendolphin && \
    JAVA_TIME_BASE_URL_MODERN=https://stage.backend/opendolphin/api \
    JAVA_TIME_AUTH_HEADER="Authorization: Bearer ${JAVATIME_STAGE_TOKEN}" \
    JAVA_TIME_OUTPUT_DIR=/var/lib/opendolphin/java-time/$(date +\%Y\%m\%d) \
    bash ops/monitoring/scripts/java-time-sample.sh >> /var/log/java-time-sample.log 2>&1
  ```
  Cron 実行ログには `tmp/java-time/` 配下の保存先が出力されるため、Runbook §4.3 の証跡リンクとして転記する。

#### ログローテーションと Evidence

- Stage Dry-Run（2025-11-07 10:26 UTC）の結果を `tmp/java-time/logs/java-time-sample-20251107-dry-run.log` に保存済み。`JAVA_TIME_AUTH_HEADER`（Stage Bearer）が未共有のため API 呼び出しは保留中だが、ディレクトリ `tmp/java-time/20240620/` を本番採取用に先行作成した。Stage トークン取得後は同ディレクトリ内に `audit-YYYYMMDD.sql` / `orca-response-YYYYMMDD.json` / `touch-response-YYYYMMDD.json` を格納し、Evidence へコピーする。  
- `/var/log/java-time-sample.log` はローテーションしないと 1 週間で 10MB 超に膨れ上がる。Ops ホストでは下記 `logrotate` スニペットを `/etc/logrotate.d/java-time-sample` に配置し、圧縮 8 世代を維持する。
  ```conf
  /var/log/java-time-sample.log {
    daily
    rotate 8
    compress
    missingok
    notifempty
    create 0640 ops ops
    sharedscripts
    postrotate
      systemctl reload rsyslog >/dev/null 2>&1 || true
    endscript
  }
  ```
- `tmp/java-time/<YYYYMMDD>/` 直下の SQL/JSON は 30 日保持ルール。31 日目に自動削除する場合は `find /var/lib/opendolphin/java-time -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +` を Cron へ追加する。削除前に Evidence（SharePoint/Evidence S3）へ同期すること。  
- Evidence へのリンク例:  
  - SQL: `tmp/java-time/20240620/audit-20251107.sql`（Stage Token 取得後に本実行で上書き予定）  
  - Dry-Run ログ: `tmp/java-time/logs/java-time-sample-20251107-dry-run.log`

#### GitHub Actions 週次 Dry-Run

- `.github/workflows/java-time-sample.yml`（および運用ドキュメント向けの `ci/java-time-sample.yml`）で毎週月曜 00:30 JST に Dry-Run を実行する。`JAVA_TIME_OUTPUT_DIR=tmp/java-time/github-actions-${{ github.run_id }}` を指定し、`ops/monitoring/scripts/java-time-sample.sh --dry-run` のログをアーティファクトへ保存する。  
- Dry-Run では Stage API へアクセスしないため Secrets を必要としないが、ジョブ失敗時は Slack/PagerDuty へ通知せず GitHub 通知で把握する方針。Stage トークンが揃い次第、`secrets.JAVATIME_STAGE_TOKEN` を注入して本番 API を叩くモードへ昇格する。

#### Loki / Elastic / Grafana クエリ例

- **Loki (LogQL)**  
  ```
  {app="modernized-backend",logger="open.dolphin.audit"} 
  |= "d_audit_event" 
  | json
  | action=~"ORCA_INTERACTION|TOUCH_SENDPACKAGE.*"
  | line_format "{{.event_time}} {{.payload.issuedAt}}"
  ```
  ISO8601 以外を検出したい場合は `| payload_issued_at = payload.issuedAt | payload_issued_at !~ "^\\d{4}-\\d{2}-\\d{2}T.*[+-]\\d{2}:\\d{2}$"` を追加し、ヒットしたログを Slack/#server-modernized-alerts へ共有する。

- **Elastic / Kibana (KQL)**  
  ```
  action : ("ORCA_INTERACTION" or "TOUCH_SENDPACKAGE" or "TOUCH_SENDPACKAGE2")
  and payload.issuedAt.keyword : *
  ```
  絞り込み後に `payload.issuedAt.keyword` フィールドへ Scripted Field `Instant.parse(params._value)` を適用するとエラー行だけが抽出される。未登録（null/空文字）の場合は `payload.issuedAt.keyword : ""` で監視できる。

- **Grafana (PostgreSQL データソース)**  
  ```
  SELECT
    event_time AS "time",
    payload::jsonb ->> 'issuedAt' AS issued_at_iso,
    payload::jsonb #>> '{bundleList,0,startedAt}' AS bundle_started_at,
    request_id
  FROM d_audit_event
  WHERE $__timeFilter(event_time)
    AND action IN ('ORCA_INTERACTION','TOUCH_SENDPACKAGE','TOUCH_SENDPACKAGE2');
  ```
  パネルの Transform で `Add field from calculation` → `to_unix_timestamp(issued_at_iso)` を設定すると、時刻形式が崩れた行は `NaN` になり即座に検知できる。ステージ環境で日次スポットチェック、プロダクションで 15 分毎アラート（`WHEN count(isnan(issued_at_epoch)) > 0`）を設定し、Runbook §4.3 の手順で追跡する。

### 1.6 ORCA-05/06/08 マスターAPI アラート（RUN_ID=`20251124T133000Z`）

- 目的: ORCA マスター系 REST（ORCA-05/06/08）の SLA 監視を Prometheus/Alertmanager で即時検知し、release-plan §3–5 のロールバック判定に使う。
- ルール配置: `docs/server-modernization/phase2/operations/assets/observability/orca-master-alerts.yaml` を envsubst 後に Prometheus ルール / Alertmanager ルートへ適用（手順は同ディレクトリ README 参照）。
- しきい値（ORCA_CONNECTIVITY_VALIDATION.md §7 と整合）  
  - 5xx rate > 2% を 5 分継続 → Critical（PagerDuty）  
  - P99 > 3s を 10 分継続 → Critical（PagerDuty）  
  - missingMaster > 0.5% を 5 分継続 → Warning（メール）  
  - cacheHit < 80% を 15 分継続 → Warning（メール）  
  - audit_missing > 0.1% を 5 分継続 → Warning（メール / 要監査抑止判定）  
- メトリクス前提: `opendolphin_api_request_total` / `opendolphin_api_error_total` / `opendolphin_api_request_duration_seconds_bucket`（path ラベルに `/orca/(master|tensu)`）、`missing_master` / `cache_hit` ラベル化、`opendolphin_api_audit_missing_total`（ログ派生可）。
- 通知経路: Critical → PagerDuty `orca-master` サービス、Warning → `ORCA_ALERT_EMAILS`（ops/dev）。Slack 連携は PD 側でハンドル。
- 運用: ステージで 24h burn-in 後に本番適用。発報時は `docs/server-modernization/phase2/operations/logs/20251123T135709Z-webclient-master-bridge.md` の RUN セクションへ証跡を追加し、release-plan §5 の手順でロールバック可否を判断する。

## 2. WildFly Micrometer サブシステム設定

`ops/legacy-server/docker/configure-wildfly.cli` に Micrometer 用の設定ブロックを追加した。既存環境へ適用する場合は Management CLI で本スクリプトを再実行するか、Docker イメージを再ビルドする。サブシステム設定の要点は以下の通り。 citeturn1search0turn1search6

```bash
# Micrometer 設定抜粋
if (outcome != success) of /extension=org.wildfly.extension.micrometer:read-resource()
    /extension=org.wildfly.extension.micrometer:add
end-if

if (outcome == success) of /subsystem=micrometer:read-resource()
    /subsystem=micrometer:write-attribute(name=endpoint, value="${env.MICROMETER_OTLP_ENDPOINT:http://otel-collector:4318/v1/metrics}")
    /subsystem=micrometer:write-attribute(name=step, value=${env.MICROMETER_STEP_SECONDS:60})
else
    /subsystem=micrometer:add(endpoint="${env.MICROMETER_OTLP_ENDPOINT:http://otel-collector:4318/v1/metrics}", step=${env.MICROMETER_STEP_SECONDS:60}, exposed-subsystems=["*"])
end-if

if (outcome == success) of /subsystem=micrometer/registry=prometheus:read-resource()
    /subsystem=micrometer/registry=prometheus:write-attribute(name=context, value="${env.MICROMETER_PROMETHEUS_CONTEXT:/metrics/application}")
    /subsystem=micrometer/registry=prometheus:write-attribute(name=security-enabled, value=${env.MICROMETER_PROMETHEUS_AUTH:true})
else
    /subsystem=micrometer/registry=prometheus:add(context="${env.MICROMETER_PROMETHEUS_CONTEXT:/metrics/application}", security-enabled=${env.MICROMETER_PROMETHEUS_AUTH:true})
end-if

/subsystem=undertow:write-attribute(name=statistics-enabled, value=true)
/subsystem=undertow/server=default-server/http-listener=default:write-attribute(name=record-request-start-time, value=true)
```

- `MICROMETER_OTLP_ENDPOINT`: OTLP HTTP collector への送信先。ローカル検証では `http://otel-collector:4318/v1/metrics` を利用する。
- `MICROMETER_STEP_SECONDS`: バッチング間隔（秒）。Prometheus スクレイプ間隔と同程度（15〜60 秒）に合わせる。
- `MICROMETER_PROMETHEUS_CONTEXT`: 管理用 HTTP ポートに公開するパス。既定で `/metrics/application` とし、Micrometer が Prometheus 形式で応答する。 citeturn1search1
- `MICROMETER_PROMETHEUS_AUTH`: `true` の場合は WildFly 管理セキュリティ（ベーシック認証）を要求する。

Micrometer は Undertow / Datasource など各サブシステムの統計情報を利用するため、`statistics-enabled` と `record-request-start-time` を有効化しておく。 citeturn1search0

### 2.1 Micrometer レジストリの JNDI 名を切り替える

`server-modernized` では `open.dolphin.metrics.MeterRegistryProducer` が Micrometer の `MeterRegistry` を JNDI から取得する。WildFly 以外のアプリケーションサーバーを利用する場合は、以下の runtime config で参照先を切り替える。

| 設定種別 | キー | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| Runtime config | `metrics.registry.jndi` | `java:jboss/micrometer/registry` | `ServerConfigurationResolver` が唯一の取得境界。環境変数では `METRICS_REGISTRY_JNDI=java:global/metrics/registry` のように指定する。 |

- いずれも未設定の場合は `java:jboss/micrometer/registry` を利用する。
- 指定した JNDI に `MeterRegistry` が存在しない場合は WARNING ログを出力し、Micrometer のグローバルレジストリへフォールバックする。
- WildFly でデフォルト値のまま運用する場合は追加設定は不要。別製品（例: Payara, OpenLiberty）ではサーバー側で公開する JNDI 名と一致させること。

## 3. Prometheus / Grafana ダッシュボード整備

1. WildFly 管理ユーザーを作成し、Prometheus から Basic 認証でアクセスできるようにする。 (`add-user.sh` を使用)
2. Prometheus のスクレイプ設定例:
   ```yaml
   scrape_configs:
     - job_name: 'opendolphin-modernized'
       metrics_path: /metrics/application
       scheme: http
       basic_auth:
         username: ${WILDFLY_USER}
         password: ${WILDFLY_PASS}
       static_configs:
         - targets: ['server-modernized:9990']
   ```
3. Grafana では `opendolphin_api_request_duration_sum`／`_count` から P95/エラーレートを計算し、`opendolphin_db_*` でプール枯渇兆候を監視する。

## 4. 運用チェックリスト

- API ごとのレイテンシーしきい値を決め、`opendolphin_api_request_duration` の P95 を毎朝確認する。
- `opendolphin_api_error_total` の増加時は `LogFilter` の `traceId` と監査イベントを必ず照合する。
- 夜間メンテナンス後は Prometheus スクレイプの疎通確認 (`curl -u ... http://<host>:9990/metrics/application`) を行う。
- Micrometer の `step` と Prometheus の `scrape_interval` の不整合がないか四半期ごとに棚卸しする。

## 5. 注意事項

- MicroProfile Metrics と Micrometer を同時に有効化すると二重登録による不整合が生じるため、モダナイズ版では Micrometer のみに統一する。 citeturn1search0
- `security-enabled=true` のまま公開する場合は管理ポートを社内ネットワークで保護し、Basic 認証情報を Vault または Kubernetes Secret で管理する。 citeturn1search1
- OTLP Collector を利用しない環境では `MICROMETER_OTLP_ENDPOINT` を無効化し、Prometheus Pull のみで運用することも可能。

## 6. PDF署名ライブラリのライセンス告知

- **OpenPDF 1.3.41（LGPL 2.1 / MPL 1.1 デュアルライセンス）**: WAR 配布時は `docs/server-modernization/reporting/LICENSE_COMPATIBILITY.md` と GitHub 上のソース入手先を同梱・案内する。派生改変を行った場合は変更点を含むソース一式を 3 年間保管し、請求があれば提供できる体制を維持する。
- **BouncyCastle 1.82（Bouncy Castle License）**: `LICENSE` に加えて Bouncy Castle License 文面を同梱し、暗号ポリシーの変更や FIPS 対応の判断は `docs/server-modernization/security/CRYPTO_POLICY_NOTES.md` に記録する。
- 上記ライブラリの更新を行った際は `docs/server-modernization/phase2/foundation/DEPENDENCY_UPDATE_PLAN.md` と `docs/server-modernization/phase2/domains/EXTERNAL_INTEGRATION_JAKARTA_STATUS.md` を同期し、`PHASE2_PROGRESS.md` に反映日時を追記する。
