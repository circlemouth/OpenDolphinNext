# Server-Modernization ドキュメントハブ（現行）

- 更新日: 2026-03-21
- RUN_ID: 20260320T205337Z

> 本ファイルが **現行の入口**。Phase2 文書は Legacy/Archive として参照専用です。
> 全体の優先順位は `docs/DEVELOPMENT_STATUS.md` を最上位とします。

## 次の開発ドキュメント一式
- `docs/development/phase2_current_coding_tasks_checklist_v1.md`
- `docs/development/README.md`
- `docs/server-modernization/planning/server-modernized-plan/README.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/README.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/development/README.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/development/orca-server-recovery-implementation-playbook.md`
- 用途: `server-modernized` の改修計画、契約文書、運用手順の入口。まず `docs/development/phase2_current_coding_tasks_checklist_v1.md`、次に `docs/development/README.md` と `docs/README.md` を読む。

## Legacy 計画書
- 現行判断は `docs/DEVELOPMENT_STATUS.md`、`AGENTS.md`、最新のユーザー/マネージャー指示を優先する。
- `docs/server-modernization/planning/codex_automation_workplan_revised.md`
- Legacy/Archive 扱い。server modernization automation の進捗判定ルールと実施記録を確認するときだけ参照する。
- `docs/server-modernization/planning/server_modernization_wbs_detailed.md`
- Legacy/Archive 扱い。当時の WBS、背景、依存関係、切替後運用タスクの履歴確認用途に限定して参照する。
- `docs/server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-execution-checklist.md`
- Legacy/Archive 扱い。2026-03-24 以前の「現行計画」であり、現行の進捗判定には使用しない。
- `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remediation-master-checklist.md`
- `docs/server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remaining-closure-checklist-20260322.md`
- Legacy/Archive 扱い。完遂済みのため、現行の進捗判定には使用しない。

## 現行 Codex automation（サブエージェント順次実行）
- `docs/server-modernization/planning/codex_automation_orchestration/README.md`
- `docs/server-modernization/planning/codex_automation_orchestration/codex_automation_orchestration_plan.md`
- `docs/server-modernization/planning/codex_automation_orchestration/codex_automation_master_prompt.txt`
- 用途: `common` 廃止・公開面整理・品質ゲート強制までの cleanup track を、メインエージェントが未完了先頭 task に対応するサブエージェントを 1 体ずつ召喚して進めるための現行導線。
- 注意: 進捗判定は上記 orchestration plan を正本とし、旧 `codex_automation_workplan_revised.md` 系は履歴確認用途に限定する。
- 最新実績: RUN_ID `20260320T205337Z` で `A10`「packaging / CI / 品質ゲート強制」を完了。cleanup track の `A01`-`A10` は完了。

## 参照優先順位（Server-Modernization領域）
1. `docs/DEVELOPMENT_STATUS.md`
2. `AGENTS.md` / `GEMINI.md`
3. `docs/development/phase2_current_coding_tasks_checklist_v1.md`
4. 本ファイル
5. 目的別ドキュメント
6. Legacy/Archive 文書

## 目的別ドキュメント（現行）
### API / 仕様
- `docs/modernization/architecture-principles.md`（刷新方針の固定版）
- `docs/modernization/deferred-scope.md`（一時据え置き領域と後続候補）
- `docs/modernization/business-critical-flows.md`（最重要業務フロー定義）
- `docs/modernization/acceptance-criteria.md`（受け入れ条件定義）
- `docs/modernization/p1-03-baseline-fixture-setup.md`（P1-03 基準データ・fixture 初期化手順）
- `docs/server-modernization/server-api-inventory.md`
- `docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md`
- `docs/modernization/p2-01-public-endpoint-inventory.md`（P2-01: 現行公開入口台帳）
- `docs/modernization/remove-matrix.md`（P2-02: 旧入口の削除/置換/統合マトリクス）
- `docs/modernization/api-v1-design.md`（P2-03: /api/v1 名前空間設計）
- `docs/modernization/p2-04-touch-asp-removal.md`（P2-04: Touch/ASP 入口削除）
- `docs/modernization/p2-05-legacytouch-removal.md`（P2-05: LegacyTouch 抽象層削除）
- `docs/modernization/p2-06-xml-endpoint-blocker.md`（P2-06: XML 専用入口削除の依存ブロッカー整理）
- `docs/modernization/p2-06-xml-endpoint-removal.md`（P2-06: XML 専用入口削除の実施記録）
- `docs/modernization/p2-07-common-converter-removal.md`（P2-07: common/converter 群削除の実施記録）
- `docs/modernization/p2-08-legacy-wildfly10-naming-bridge-removal.md`（P2-08: legacy-wildfly10 と naming ブリッジ削除）
- `docs/modernization/p2-09-descriptor-minimization.md`（P2-09: descriptor 最小化）
- `docs/modernization/api-map.md`（P2-10: 新旧 API 差分と移行後契約）
- `docs/modernization/module-boundaries.md`（P3-01: モジュール境界設計）
- `docs/modernization/p3-02-module-skeleton.md`（P3-02: 新 module 雛形）
- `docs/modernization/p3-03-entity-separation.md`（P3-03: JPA entity の common 分離）
- `docs/modernization/p3-04-dto-separation.md`（P3-04: API DTO の entity 分離）
- `docs/modernization/p3-05-resource-entity-exposure-removal.md`（P3-05: REST 層 entity 直返し/直受けの解消）
- `docs/modernization/p3-06-common-scope.md`（P3-06: audit/util/common の最小責務定義）
- `docs/modernization/p3-07-dead-helper-removal.md`（P3-07: ダミー参照・死蔵補助コード整理）
- `docs/modernization/p3-08-build-structure.md`（P3-08: モジュール再編後ビルド構成）
- `docs/modernization/p4-01-karte-resource-split.md`（P4-01: KarteResource の read/write 責務分割）
- `docs/modernization/p4-02-karte-service-usecase-split.md`（P4-02: KarteServiceBean の use case 分割）
- `docs/modernization/p4-03-resource-splitting.md`（P4-03: 患者更新・管理系 Resource 分割）
- `docs/modernization/p4-04-cross-cutting-authorization-audit.md`（P4-04: 認可/監査の横断部品化）
- `docs/modernization/p4-05-error-response-request-id-unification.md`（P4-05: エラー応答形式と request id 統一）
- `docs/modernization/p4-06-transaction-boundaries.md`（P4-06: トランザクション境界見直し・worktree手順）
- `docs/modernization/p4-07-cdi-first-service-split.md`（P4-07: EJB前提削減とCDI優先化）
- `docs/modernization/p4-08-api-doc-test-sync.md`（P4-08: API文書とテスト同期）
- `docs/modernization/p5-01-orca-boundary-design.md`（P5-01: ORCA境界責務とadapter interface）
- `docs/modernization/p5-02-orca-external-config.md`（P5-02: ORCA接続設定/認証情報の外部設定化）
- `docs/modernization/p5-03-static-cache-removal.md`（P5-03: mutable staticと無期限キャッシュ前提の整理）
- `docs/modernization/p5-04-orca-http-retry-policy.md`（P5-04: ORCA HTTP/再試行ポリシー再設計）
- `docs/modernization/p5-05-orca-master-gateway-encapsulation.md`（P5-05: ORCA専用DAOのgateway内包化）
- `docs/modernization/p5-06-orca-resource-splitting.md`（P5-06: ORCA Resource の機能別分割）
- `docs/modernization/p5-07-orca-sync-state-db-store.md`（P5-07: ORCA 同期状態の DB 永続化）
- `docs/modernization/p5-08-orca-adapter-stub-integration-tests.md`（P5-08: ORCA adapter の stub 統合試験整備）
- `docs/modernization/p5-09-orca-resilience-performance-tests.md`（P5-09: ORCA 連携の性能・障害試験）
- `docs/modernization/p6-01-entity-domain-api-responsibility-split.md`（P6-01: entity/domain/api の責務分担設計）
- `docs/modernization/p6-02-date-to-java-time-migration.md`（P6-02: java.util.Date から java.time への移行）
- `docs/modernization/p6-03-module-storage-replacement-design.md`（P6-03: ModuleModel bean_json 置換設計）
- `docs/modernization/p6-04-module-storage-versioned-json-implementation.md`（P6-04: module 保存形式の versioned JSON 先行実装）
- `docs/modernization/p6-05-persistence-query-layer-unification.md`（P6-05: 永続化アクセスの repository/query 層統一）
- `docs/modernization/p6-06-native-query-jdbc-inventory-and-rewrite.md`（P6-06: native query/raw JDBC の棚卸しと query service 集約）
- `docs/modernization/p6-07-persistence-class-list-minimization.md`（P6-07: persistence.xml の手書き class list 最小化）
- `docs/modernization/p6-08-flyway-schema-migration.md`（P6-08: module payload 向け Flyway migration）
- `docs/modernization/p6-09-existing-data-migration-tooling.md`（P6-09: d_module_payload one-shot 移行ツール）
- `docs/modernization/p6-10-index-fetch-plan-n-plus1-review.md`（P6-10: index・fetch plan・N+1 見直し）
- `docs/modernization/p7-01-pvt-socket-worker-separation.md`（P7-01: PvtService 生ソケット受信のワーカー分離）
- `docs/modernization/p7-02-message-sender-jms-responsibility-split.md`（P7-02: MessageSender JMS 消費責務の整理）
- `docs/modernization/p7-03-pvt-input-retry-idempotency.md`（P7-03: PVT入力パイプラインの再試行・重複防止・毒メッセージ退避）
- `docs/modernization/p7-04-remove-local-file-output-dependency.md`（P7-04: PVT登録時のローカルファイル出力依存除去）
- `docs/modernization/p7-05-pvt-replay-tool.md`（P7-05: PVT受信メッセージ再生ツール）
- `docs/modernization/p7-06-worker-observability-health.md`（P7-06: ワーカー監視項目とヘルスチェック）
- `docs/modernization/p8-01-attachment-storage-streaming.md`（P8-01: AttachmentStorageManager の upload/download ストリーミング化）
- `docs/modernization/p8-02-s3-credential-provider-chain.md`（P8-02: S3 認証を固定資格情報から外し provider chain へ統一）
- `docs/modernization/p8-03-config-loading-unification.md`（P8-03: YAML/properties/JSON 設定読込ルールの統一）
- `docs/modernization/p8-05-remove-userhome-target-dependency.md`（P8-05: user.home と build 生成物依存の除去）
- `docs/modernization/p8-06-config-audit-validation.md`（P8-06: 設定変更の監査と入力検証）
- `docs/modernization/p9-01-log-format-unification.md`（P9-01: ログ形式の統一）
- `docs/modernization/p9-02-metrics-simplification.md`（P9-02: メトリクス生成の単純化）
- `docs/modernization/p9-03-auth-session-unification.md`（P9-03: 認証方式のセッション統一と権限判定整理）
- `docs/modernization/p9-03-revised-shared-list-structure-review.md`（revised workplan の P9-03: 共有リスト構造見直し。WBS の P9-03 とは番号対応が異なる）
- `docs/modernization/p9-04-junit5-unification.md`（P9-04: common/server-modernized の JUnit5 基盤統一）
- `docs/modernization/p9-05-static-analysis-gate.md`（P9-05: SpotBugs/Checkstyle/PMD のCI必須ゲート化）
- `docs/modernization/p9-06-deployment-simplification.md`（P9-06: WAR+WildFly 配備方式の一本化）
- `docs/modernization/p9-07-health-readiness-runbook.md`（P9-07: 運用用 health/readiness と手順書）
- `docs/modernization/p10-01-production-like-validation-environment.md`（P10-01: 本番近似の検証環境構築手順）
- `docs/modernization/p10-02-data-migration-rehearsal.md`（P10-02: データ移行の通し試験と再実行確認）
- `docs/modernization/p10-03-virtual-role-uat.md`（P10-03: 仮想ロールUATの実施記録と指摘一覧）
- `docs/modernization/p10-03-uat-blocker.md`（P10-03: UAT ブロッカー履歴）
- `docs/modernization/p10-04-load-fault-tests.md`（P10-04: 主要経路の負荷試験・障害試験）
- `docs/modernization/p10-05-cutover-checklist-modernized.md`（P10-05: モダナイズ版基準の本番切替チェックリスト）
- `docs/modernization/p10-06-cutover-execution-blocker.md`（P10-06: 本番切替実施のブロッカー記録）
- `docs/modernization/p10-07-post-cutover-monitoring-blocker.md`（P10-07: 切替後集中監視の blocker と次判断）
- `docs/modernization/p11-01-legacy-config-inventory.md`（P11-01: 旧設定読み込み経路の棚卸し）
- `docs/modernization/p11-02-config-priority-matrix.md`（P11-02: ORCA/attachment/license/runtime state の優先順位整理）
- `docs/modernization/p12-02-next-modernization-themes.md`（P12-02: 次段 modernization テーマ整理）
- `docs/server-modernization/orca-additional-api-implementation-notes.md`
- `docs/server-modernization/ORCA-order-system-rule.md`（ORCAオーダー仕様・実装要件）
- `docs/server-modernization/orca-api-contract-unification-20260218.md`
- `docs/server-modernization/reception-realtime-sync-20260219.md`
- `docs/server-modernization/orca-master-reference-update-platform-design-20260212.md`
- `docs/server-modernization/api-architecture-consolidation-plan.md`
- `docs/server-modernization/rest-api-modernization.md`
- `docs/server-modernization/p8-04-runtime-state-store-db-migration.md`

### module 永続化方針
- 新規 module 書込は `beanJson` のみを正規経路とする。
- `beanBytes` は旧データ読込 fallback 専用とし、新規の JSON+XML 二重保存は行わない。
- 互換を将来整理する場合も PostgreSQL `oid` への回帰は採らず、JSON 系へ統一する。
- 判断に迷う場合は `docs/DEVELOPMENT_STATUS.md` の最新方針を優先する。

### DB migration 運用
- versioned migration の正本は `tools/flyway/sql` とする。
- source tree に手動保守する `src/main/resources/db/migration` ミラーは置かない。
- build 時に canonical source から `target/classes/db/migration` へ生成コピーし、runtime / test / verify はこの classpath 供給物を利用する。
- `P1_03__minimal_baseline_seed.sql` は characterization 用の手動 seed であり、versioned migration 正本には含めない。

### 運用 / 接続
- `docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md`
- `docs/server-modernization/operations/ORCA_FIRECRAWL_INDEX.md`
- `docs/server-modernization/operations/OBSERVABILITY_AND_METRICS.md`
- `docs/server-modernization/operations/CODEX_ENV_SETUP.md`
- `docs/server-modernization/operations/API_PARITY_RESPONSE_CHECK.md`
- `docs/server-modernization/api-smoke-test.md`
- [docs/README.md](../README.md)（server-modernized 契約文書・runbook・PR チェックリストの正本索引）

### ORCA POST 系の現行運用
- 2026-03-26 時点の public route contract freeze:
  - `GET /api/health`
  - `GET /api/health/readiness`
  - `GET /api/health/worker/pvt`
  - `GET /api/schedules/{scheduleKey}`
  - `GET /api/encounters/{encounterKey}`
  - `POST /api/encounters/{encounterKey}/transitions`
- intentionally unavailable:
  - `POST /api/admin/access/users/{userPk}/password-reset`
  - `GET /api/operations/readiness`
  - `/api/orca/queue`
  - `/api/orca/pusheventgetv2`
- Reception/Charts handoff の key feed は未実装のため、client は `appointmentId` / `receptionId` / `visitDate` を権威 route とみなさない。次タスクでは `scheduleKey` / `encounterKey` ベースの public contract を実装入口とする。
- subjectives（`/api/orca/chart/subjectives`）を含む current ORCA POST 連携は、stub/real 切替なしの実運用モードで固定する。
- 検証時は feature flag や system property で stub へ逃がさず、`docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md` の接続設定を正しく投入して疎通確認する。
- 施設別 ORCA 接続設定は `facilities` + `defaultFacilityId` を正本とし、`PUT /api/admin/orca/connection` は設定更新専用、`PUT /api/admin/orca/connection/default-facility` は default 切替専用とする。
- `/api/orca/master/drug` は `scope` query parameter を受け付けず、指定時は 400 `unsupported_parameter` を返す。
- 詳細契約:
  - `docs/contracts/orca-connection.md`
  - `docs/contracts/orca-master-api.md`

### P10-06 env 運用（サンプルから作成）
- `server-modernized.production.env` はリポジトリへ直接コミットせず、毎回サンプルから作成する。
- 作成手順:
  - `cp ops/modernized-server/config/server-modernized.production.env.sample ops/modernized-server/config/server-modernized.production.env`
  - 必要に応じて `MODERNIZED_CUSTOM_PROPERTIES_FILE` で `custom.properties` の参照先を切り替える。
- ORCA Trial の公開情報は sample に既定値として反映済み:
  - `ORCA_BASE_URL=https://weborca-trial.orca.med.or.jp/`
  - `ORCA_API_USER=trial`
  - `ORCA_API_PASSWORD=weborcatrial`

### テスト実行方針（server-modernized / Mockito inline）
- 既定実行は **JDK25（Homebrew OpenJDK）** を使用する。
- 2026-03-16 時点では、`server-modernized/` 直下での `mvn -q -DskipITs test` / `mvn -q verify` は `api-contract` 側 DTO classpath 不備（`OperationsHealthResponse` / `OperationsReadinessCheck` / `OrcaReportRequest`）により失敗する。現行の安定検証は root からの reactor 実行を正とする。
- 検証対象（管理設定/認証まわり）は以下を基準テストとする。
  - `AdminAccessResourceTest`
  - `AdminOrcaConnectionResourceTest`
  - `SessionAuthResourceTest`
  - `LogoutResourceTest`
- 実行コマンド（既定）:
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=AdminAccessResourceTest,AdminOrcaConnectionResourceTest,SessionAuthResourceTest,LogoutResourceTest -Dsurefire.failIfNoSpecifiedTests=false test`
- 既定環境で Mockito inline の attach が不安定な場合のみ、fallback として **JDK21 + byte-buddy-agent** を用いる。
  - `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -f pom.server-modernized.xml -pl server-modernized -am -DargLine=-javaagent:/Users/Hayato/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.12/byte-buddy-agent-1.14.12.jar -Dtest=AdminAccessResourceTest,AdminOrcaConnectionResourceTest,SessionAuthResourceTest,LogoutResourceTest -Dsurefire.failIfNoSpecifiedTests=false test`

### CI 常時実行（P1-10）
- Workflow: `.github/workflows/server-modernized-characterization.yml`
- 目的: 性格確認テストを `PR軽量` と `夜間拡張` に分けて常時実行し、回帰を早期検知する。
- トリガ:
  - PR (`server-modernized/**`, `common/**`, `pom.server-modernized.xml`, workflow 自身)
  - nightly schedule（毎日 UTC 18:00）
  - `workflow_dispatch`
- 実行環境:
  - 一次実行: `JDK25 (Temurin)`
  - fallback: 一次実行失敗時のみ `JDK21 + -DargLine=-javaagent:${HOME}/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.12/byte-buddy-agent-1.14.12.jar`
- 実行セット:
  - PR軽量（患者・カルテ・ORCA）:
    - `PatientServiceBeanAddPatientTest`
    - `PatientModV2OutpatientResourceIdempotencyTest`
    - `KarteServiceBeanDocPkTest`
    - `KarteRevisionServiceBeanAttachmentCloneTest`
    - `OrcaPatientApiResourceRunIdTest`
    - `OrcaPatientResourceIdempotencyTest`
    - `WebXmlEndpointExposureTest`
  - 夜間拡張（P1-04〜P1-09 の固定テスト群）:
    - 患者、カルテ、ORCA、PVT、添付、管理設定/認証の代表26クラス（実行テスト数の目安: 113）
- 失敗時対応:
  - Actions Artifacts の surefire report（`**/target/surefire-reports/*.xml` / `*.txt`）を確認する。
  - failing class を同じ `-Dtest=` 指定でローカル再現する。
  - 修正後は同クラス群で再実行し、WBSと `docs/DEVELOPMENT_STATUS.md` を更新する。

### リポジトリ運用対象外の生成物（P12-01）
- `**/target/`、`**/__MACOSX/`、AppleDouble (`**/._*`) は生成物として Git 管理対象外にする。
- 受領 zip の実体はルートの `/common.zip` / `/server-modernized.zip` のみを一時参照対象とし、展開ゴミはレビュー差分へ混ぜない。
- surefire report や一時ログはローカル確認または Actions Artifacts で扱い、ソース差分には含めない。

### Web client 連携セキュリティ契約（2026-03）
- デプロイ順序は backend 先行 → frontend 後続（逆順禁止）。
- `index.html` は `__CSRF_TOKEN__` を実トークンへ置換して配信し、`Cache-Control: private, no-store` を適用する。
- unsafe method（`POST/PUT/PATCH/DELETE`）の CSRF 検証は `fetch` と `XMLHttpRequest`（upload）で同一に扱う。
- `POST /api/logout` は `credentials` + CSRF を前提に冪等で処理する。
- 画像ヘッダは `X-Client-Feature-Images` のみを使用し、旧 `X-Feature-Images` は廃止する。
- session cookie は `Secure` / `HttpOnly` / `SameSite=Lax` を前提に配信する。
- 本番相当環境は HTTPS 前提で運用し、TLS 終端プロキシ配下でも `Forwarded` / `X-Forwarded-*` を正しく渡す。
- `Authorization: Basic` の fallback 認証は廃止済みであり、session / container principal のみを認証根拠として扱う。
- ORCA credential は server 側設定からのみ供給し、未設定時は fail-closed で応答する。

### Typed Config 運用メモ
- 起動時設定の正本は `server-modernized/config/server-modernized.env.sample` と `docs/contracts/runtime-config.md` であり、補完用の旧設定ファイル運用は採らない。
- `document.integrity.keyring-path` は absolute path の keyring JSON を前提とし、単一 HMAC 鍵の直指定は許可しない。
- `patient-images.enabled=true` の場合は `max-bytes` / `max-width` / `max-height` を必須とし、upload は temp file 受信後に normalize する。
- FIDO2 typed config surface は削除済み。`SECURITY_TRUSTED_PROXIES` と `FACTOR2_AES_KEY_B64` は production-like startup の必須条件として fail-fast する。
- Plivo SMS は `PLIVO_*` キーのみで解決し、`PLIVO_LOG_LEVEL` / `PLIVO_LOG_MESSAGE_CONTENT` / `PLIVO_HTTP_*` / `PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE` を含めて環境ごとに明示投入する。
- `ChartEventHistoryPurgeScheduler` と `OrcaPatientSyncScheduler` は既定 OFF とし、必要な環境だけ enable する。

### セキュリティ設定（Trusted Proxy）
- 監査ログのクライアントIP解決で `X-Forwarded-For` / `X-Real-IP` を信用するには、trusted proxy を明示設定してください。
- 設定キー:
  - runtime key: `security.trusted-proxies`
  - sample env: `SECURITY_TRUSTED_PROXIES`
- 値はカンマ区切りで指定（単一IP または CIDR 例: `203.0.113.10,203.0.113.0/24`）。
- 未設定時は forwarded ヘッダを信用せず、`remoteAddr` を採用します（loopback は開発用途として許容）。

### CLAIM 廃止 / API-only
- `docs/server-modernization/ORCA_CLAIM_DEPRECATION.md`
- `docs/server-modernization/orca-claim-deprecation/`

### レビュー / 計画
- `docs/server-modernization/planning/codex_automation_orchestration/README.md`
- `docs/server-modernization/library-update-plan.md`
- `docs/server-modernization/server-modernized-code-review-20260117.md`

### Preprod 課題 / 検証
- `docs/preprod/implementation-issue-inventory/`

## Legacy / Archive（参照専用）
- `docs/server-modernization/planning/codex_automation_workplan_revised.md`
- `docs/server-modernization/planning/server_modernization_wbs_detailed.md`
- `docs/server-modernization/phase2/` 配下
- `docs/server-modernized/phase2/` 配下
- `docs/archive/2025Q4/server-modernization/` 配下
