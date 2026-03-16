# 3.6 外部サービス連携モダナイズ報告

最終更新: 2026-06-03（担当: Codex）

本ドキュメントはサーバーモダナイズ計画 3.6 フェーズ（外部サービス連携）の完了内容をまとめる。Plivo SMS 連携の最新 SDK 化・TLS 強化、ORCA レセプト電文の監査ログ整備、将来の API ゲートウェイ統合方針、Sandbox/本番切替手順をここに集約する。

## 1. Plivo SMS API モダナイズ

### 1.1 SDK アップデートと TLS 要件
- `com.plivo:plivo-java` を **5.46.3** に更新し、Jakarta EE 17 ランタイム上でサポートされる最新 SDK を採用。WildFly 26 でもサポートされる TLS 1.2/1.3 のみを許可する `OkHttp` 設定へ刷新した。コードは `open.dolphin.adm20.PlivoSender` を参照。
- Plivo 旧 SDK (`RestAPI`) は削除し、新 SDK の `Message.creator(...).client(PlivoClient)` を利用。TLS 強制・接続タイムアウト（10s/30s）設定によりネットワーク遅延時のハングアップを防ぐ。
- 監査ログはメッセージ UUID と宛先件数のみ記録し、本文は既定で記録しない（`PLIVO_LOG_MESSAGE_CONTENT=false`）。必要時のみ true を指定する。

### 1.2 設定の Secrets 化
- 認証情報・エンドポイント・HTTP タイムアウトは typed config (`plivo.*` / `PLIVO_*`) のみを正規ルートとする。`custom.properties` フォールバックは廃止済み。
- 新規に利用可能な環境変数／プロパティは下表の通り。

| 環境変数 | `custom.properties` キー | 既定値 | 説明 |
| --- | --- | --- | --- |
| `PLIVO_AUTH_ID` | `plivo.auth.id` | なし（必須） | Plivo Auth ID |
| `PLIVO_AUTH_TOKEN` | `plivo.auth.token` | なし（必須） | Plivo Auth Token |
| `PLIVO_SOURCE_NUMBER` | `plivo.source.number` | なし（必須） | 送信元番号（E.164 形式） |
| `PLIVO_BASE_URL` | `plivo.base-url` | `https://api.plivo.com/v1/` | REST API ベース URL。HTTPS のみ許可 |
| `PLIVO_ENVIRONMENT` | `plivo.environment` | `production` | `production` / `sandbox` を指定。`sandbox` の場合は `https://api.sandbox.plivo.com/v1/` を既定利用 |
| `PLIVO_LOG_LEVEL` | `plivo.log.level` | `NONE` | Plivo SDK の HTTP ログレベル（`NONE/BASIC/BODY/HEADERS`） |
| `PLIVO_LOG_MESSAGE_CONTENT` | `plivo.log.message-content` | `false` | Plivo 側でメッセージ本文を保存するかどうか |
| `PLIVO_DEFAULT_COUNTRY` | `plivo.default-country` | `+81` | 国内番号を正規化する際の国番号 |
| `PLIVO_HTTP_CONNECT_TIMEOUT` | `plivo.http.connect-timeout` | `PT10S` | 接続タイムアウト |
| `PLIVO_HTTP_READ_TIMEOUT` | `plivo.http.read-timeout` | `PT30S` | 読み取りタイムアウト |
| `PLIVO_HTTP_WRITE_TIMEOUT` | `plivo.http.write-timeout` | `PT30S` | 書き込みタイムアウト |
| `PLIVO_HTTP_CALL_TIMEOUT` | `plivo.http.call-timeout` | `PT45S` | 呼び出し全体のタイムアウト |
| `PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE` | `plivo.http.retry-on-connection-failure` | `true` | 接続失敗時の再試行可否 |

- `docker-compose.yml` / `.env.sample` / `ops/shared/docker/custom.properties` にテンプレート値を追記済み。既存利用者は `.env` で Secrets を管理し、Git 管理下から削除された平文認証情報を移行すること。

### 1.3 送信フローと監査
- `PlivoSender#send` は送信先番号を E.164 に正規化し、重複排除後にまとめて送信。Plivo API への要求・成功・失敗を `open.dolphin.audit.external` ロガーへ INFO/WARN で出力する。
- 監査ログ例:
  - `event=SMS_REQUEST timestamp=... sms.recipients=1 sms.destinations=[+8190...] plivo.environment=production ...`
  - `event=SMS_SUCCESS ... sms.messageUuid=["xxxxx"]`
- `AdmissionResource` は CDI で `PlivoSender` を注入するよう変更。これによりリクエストトレース ID（`SessionTraceManager`）と紐付けた監査ログが自動で出力される。

### 1.4 既存環境の移行手順
1. 旧バージョンで `PlivoSender` のソースコードに埋め込まれていた認証情報を削除（今回の更新でリポジトリから除去済み）。
2. `.env.sample` を参考に、運用環境では `.env` またはデプロイ先の Secrets 管理（例: GitHub Actions secrets, Docker Secrets）へ以下を設定。
   ```env
   PLIVO_AUTH_ID=live_xxxxxxxxxxxxx
   PLIVO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
   PLIVO_SOURCE_NUMBER=+8180xxxxxxx
   PLIVO_ENVIRONMENT=production
   ```
3. Sandbox を利用する場合は `PLIVO_ENVIRONMENT=sandbox` とし、必要なら `PLIVO_BASE_URL` を `https://api.sandbox.plivo.com/v1/` へ明示設定。
4. `docker compose build` を再実行し、WildFly 再起動後に `open.dolphin.audit.external` ログと Plivo ダッシュボード双方で配送結果を確認する。

## 2. ORCA／レセプト電文送信の監査ログ要件

- `open.dolphin.msg.gateway.MessagingGateway` に監査ログフックを追加し、CLAIM/DIAGNOSIS 送信開始・成功・失敗を `open.dolphin.audit.external` ロガーへ出力。内容は患者 ID、ドキュメント ID、送信件数、送信先ホスト/ポートなど最小限のメタデータのみ。
- ログ書式例:
  - `event=CLAIM_REQUEST timestamp=... document.docId=xxx document.patientId=xxx orca.host=10.0.0.5 orca.port=8000`
  - `event=CLAIM_FAILURE ...`（失敗時は WARN とスタックトレースが付与）
- トレーサビリティ確保のため、`SessionTraceManager` が生成する traceId をログに付加。API ゲートウェイ導入後も同じ traceId を HTTP ヘッダで中継し、外部監査システムとの突合を可能にする。
- 監査ログ保管は既存の集中ログ基盤（例: Loki, CloudWatch）で `open.dolphin.audit.external` チャンネルを収集対象へ追加すること。

## 3. API ゲートウェイ統合方針（Kong / Apigee 等）

1. **ルーティング**: Plivo・ORCA など外部サービスへの通信は、将来 Kong などの API Gateway を経由させる。`PLIVO_BASE_URL` をゲートウェイのエンドポイントに切り替えることで透過的にリクエストを転送可能。ORCA TCP 連携については、ゲートウェイ側で TCP→HTTP プロキシ（Ex: Kong TCP Stream plugin）を利用し、送信ホスト/ポートをゲートウェイへ変更する計画。
2. **認証統合**: Plivo 認証は現状 API キー方式のため、ゲートウェイで Secrets を保管し、アプリ側はゲートウェイ向けの mTLS もしくは JWT 認証を採用する。`PLIVO_AUTH_ID/TOKEN` を将来的に廃止する場合は、ゲートウェイが署名付きヘッダへ変換する。
3. **監査・レート制御**: `open.dolphin.audit.external` ログをベースに、ゲートウェイ側で同じ traceId をヘッダ `X-OpenDolphin-TraceId` として受け取り、外部システム（APM, SIEM）へ転送。Kong/AWS API Gateway ではカスタムヘッダで受け取り、Access Log / Analytics に埋め込む。
4. **段階的移行**: まず Plivo をゲートウェイ経由に切り替え、成功後に ORCA TCP 接続をゲートウェイでカプセル化する。フェーズ切替時は `.env` と `custom.properties` の `*.host` / `plivo.baseUrl` をゲートウェイの DNS へ更新するだけで完了するよう設計してある。

## 4. Sandbox / 本番切替運用

- `.env` もしくはデプロイ先の環境変数で `PLIVO_ENVIRONMENT` を `sandbox` に変更すると、自動的に `https://api.sandbox.plivo.com/v1/` へ切り替わる。必要に応じて `PLIVO_BASE_URL` を個別指定する。
- Sandbox と本番で送信元番号が異なる場合は、`PLIVO_SOURCE_NUMBER` の値を環境ごとに分ける。`PLIVO_DEFAULT_COUNTRY` により国内番号正規化も環境ごとに切替可能。
- 切替手順は運用ドキュメント `docs/web-client/operations/LOCAL_BACKEND_DOCKER.md` の該当節に追記済み。CI/CD での自動切替は、デプロイ先環境変数をワークフローファイルでセットする。

## 5. 既存利用者への影響とアクション

- **認証情報の退避**: 旧コードにハードコードされていた Auth ID / Token / 送信元番号は削除されたため、運用環境で `.env` または Secrets を必ず設定すること。設定が無い場合は `SMSException("Plivo SMS の認証情報が未設定です")` がスローされ、SMS 送信 API が 500 応答となる。
- **ログ収集の更新**: `open.dolphin.audit.external` ロガーを収集対象に追加する。Logback/JUL 設定で INFO/WARN を永続化し、失敗ログを監視する。
- **監査要件**: SMS 送信メッセージ本文はデフォルトで Plivo へ保存されない（`PLIVO_LOG_MESSAGE_CONTENT=false`）。監査で本文保存が必要な場合は true に変更するが、個人情報保護委員会のガイドラインに沿った保管基盤を別途用意すること。
- **API ゲートウェイ準備**: 監査ログへ traceId が付与されるようになったため、ゲートウェイ導入時はこの ID を転送するだけで追跡可能。追加開発は不要。

## 6. 参考実装ファイル
- `server-modernized/src/main/java/open/dolphin/adm20/PlivoSender.java`
- `server-modernized/src/main/java/open/dolphin/msg/gateway/SmsGatewayConfig.java`
- `server-modernized/src/main/java/open/dolphin/msg/gateway/MessagingGateway.java`
- `server-modernized/src/main/java/open/dolphin/msg/gateway/ExternalServiceAuditLogger.java`

以上で 3.6 外部サービス連携タスクは完了した。
