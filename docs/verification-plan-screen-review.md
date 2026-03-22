# 確認作業計画（完成版）

> 章立ては確定、本文は必要最低限。
> 画面一覧/サーバー機能/トレーサビリティは暫定表（代表行）を記載済み。詳細差し込みは追記予定。

## 1. 基本情報

- 対象名称: OpenDolphin WebClient 画面確認作業計画
- 対象範囲: OpenDolphin WebClient（Login/Reception/Charts/Patients/Administration/Print）＋Debug導線はルート/ガード確認のみ
- 目的 / 背景: 画面別の確認観点を明文化し、現有戦力で実施可能な確認計画と証跡取得方針を確定する
- 期間 / マイルストーン: 2026-02-03〜2026-02-09（準備→実施→レビュー→完了）
- 参照資料: `web-client/src/AppRouter.tsx` / `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md` / `docs/web-client/architecture/web-client-api-mapping.md` / `docs/web-client/architecture/web-client-screen-review-template.md`
- 作成日: 2026-02-03
- 最終更新日: 2026-02-06
- 作成者: 足軽1（実務担当）
- 承認者: 家老

## cmd_20260206_10 残件（P0/P1/P2）

- 現状: P0 は material master の再現パスを追う部分確認、P1 は Api_Result matrix + queue live を含めて完了、P2 は chart-events SSE policy を安定確認済み（詳細は下の表）。
 

## modernized/ORCA 連携 未確認機能（P0/P1/P2）


| 優先度 | 対象機能 | 依存 API | 状態/未確認理由 | 完了条件 | RUN_ID | 証跡 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Procedure Usage で /orca/master/material を経由する材料検索／例外 UI | `/orca/master/material` → `/orca/order/bundles` | 状態: ORCADS の `ORCA_DB_*` 未設定 → `DB_*` フォールバック → app DB 誤接続で 503 `MASTER_MATERIAL_UNAVAILABLE` が発生。ORCADS 修正後は `/orca/master/material` が 200/[] + UI 空表示（RUN_ID=`20260206T142053Z-cmd_20260206_15_sub_14-material-200`, `20260206T183713Z-cmd_20260206_15_sub_16-material-master-reverify28`, `20260206T183833Z-cmd_20260206_15_sub_16-material-master-reverify29`）に戻り、ORCA DB `tbl_material_*` が 0 件（RUN_ID=`20260206T190155Z-cmd_20260206_15_sub_18-material-items-rootcause`）で items=[] が正しい挙動。DEV 最小 seed(1件) で items>0→材料選択→`POST /orca/order/bundles` ペイロード保存（RUN_ID=`20260206T192539Z-cmd_20260206_15_sub_18-material-items-seeded-verify1`, cleanup済）も実証済。503 root cause は `20260206T120731Z-procedure-usage-material-master1` / `20260206T131817Z-cmd_20260206_15_sub_12-material-master-1` / `20260206T131921Z-cmd_20260206_15_sub_12-material-master-2` / `20260206T132023Z-cmd_20260206_15_sub_12-material-master-3` / `20260206T134719Z-cmd_20260206_15_sub_13-material-master-503-curl3` (`standalone-full.orcads-snippet.xml`) で記録。 | まとめ: ORCADS の 503 根本・200/empty/items=0/seeded items>0 経路および payload 保存の全証跡を整理して P0 を完了（items=0/empty + items>0 payload capture 両系統）。 | `20260206T120731Z-procedure-usage-material-master1` / `20260206T131817Z-cmd_20260206_15_sub_12-material-master-1` / `20260206T131921Z-cmd_20260206_15_sub_12-material-master-2` / `20260206T132023Z-cmd_20260206_15_sub_12-material-master-3` / `20260206T134719Z-cmd_20260206_15_sub_13-material-master-503-curl3` / `20260206T142053Z-cmd_20260206_15_sub_14-material-200` / `20260206T183713Z-cmd_20260206_15_sub_16-material-master-reverify28` / `20260206T183833Z-cmd_20260206_15_sub_16-material-master-reverify29` / `20260206T190155Z-cmd_20260206_15_sub_18-material-items-rootcause` / `20260206T192539Z-cmd_20260206_15_sub_18-material-items-seeded-verify1` | `OpenDolphin_WebClient/artifacts/verification/20260206T134719Z-cmd_20260206_15_sub_13-material-master-503-curl3/standalone-full.orcads-snippet.xml` + `OpenDolphin_WebClient/artifacts/webclient/e2e/20260206T142053Z-cmd_20260206_15_sub_14-material-200/material-master/` + `OpenDolphin_WebClient/artifacts/webclient/e2e/20260206T183713Z-cmd_20260206_15_sub_16-material-master-reverify28/material-master/` + `OpenDolphin_WebClient/artifacts/webclient/e2e/20260206T183833Z-cmd_20260206_15_sub_16-material-master-reverify29/material-master/` + `OpenDolphin_WebClient/artifacts/verification/20260206T190155Z-cmd_20260206_15_sub_18-material-items-rootcause/material-master-items-rootcause/` + `OpenDolphin_WebClient/artifacts/verification/20260206T192539Z-cmd_20260206_15_sub_18-material-items-seeded-verify1/material-master-items-seeded/` + `order-bundles-posts.json` |
| P1 | Api_Result=14/24/16 の ORCA 応答 vs Api_Result=90 の扱い | `/orca/visits/mutation` / `acceptmodv2` | 状態: 完了（`20260206T124058Z-api-result-matrix-retest2` で direct/modernized/web-client の Api_Result 14/24/16 が一致し、業務エラー扱いで HTTP 200/Api_Result 表示を許容）。Api_Result=90 は ORCA 側排他のため再現性不定で、既存 RUN_ID=`20260205T070802Z` を基に仕様差を許容。 | 14/24/16 matrix を evidence として docs に記録し、Api_Result=90 は「ORCA 側排他/不定」扱いの方針を statement する。 | `20260206T124058Z-api-result-matrix-retest2` / `20260205T070802Z` | `OpenDolphin_WebClient/artifacts/verification/20260206T124058Z-api-result-matrix-retest2/` + `OpenDolphin_WebClient/artifacts/verification/20260205T070802Z/` |
| P2 | chart-events (SSE) 5xx response の console spam 抑止 | `/chart-events` | 状態: 完了（MSW on/off で `20260206T125233Z-cmd_20260206_15_sub_11-chart-events-msw` により 5xx → guard banner/停止で excessive log なしを確認済）。 | Playwright/Vitest + MSW on/off run で 5xx 発生時の console spam を抑止し、再接続を停止する behavior を再検証。 | `20260206T125233Z-cmd_20260206_15_sub_11-chart-events-msw` | `OpenDolphin_WebClient/artifacts/verification/20260206T125233Z-cmd_20260206_15_sub_11-chart-events-msw/` |

- `/api/orca/queue` live 200 + Admin queue UI リスト反映の実証：RUN_ID=`20260206T123144Z-orca-queue-live`（`OpenDolphin_WebClient/artifacts/webclient/e2e/20260206T123144Z-orca-queue-live/admin-orca-queue/`）

## 2. 役割と担当切り分け（RACI）

| 作業区分 | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| 計画作成 | 足軽1 | 家老 | 足軽2-4 | 将軍 |
| 実施準備 | 足軽1 | 家老 | 足軽2-4 | 将軍 |
| 実施 | 足軽1-4 | 家老 |  | 将軍 |
| レビュー | 家老 | 家老 | 足軽1-4 | 将軍 |
| 承認 / 完了 | 家老 | 家老 |  | 将軍 |

### 2.1 担当者一覧

- 主担当: 足軽1
- 副担当: 足軽2-4
- レビュー担当: 家老
- 承認担当: 家老
- 連絡先: 家老（窓口）

### 2.2 現有戦力の体制（家老＋足軽）

- 家老: 計画統括、レビューと承認、優先度判断
- 足軽: 実施（確認/記録/エビデンス作成）、課題の一次切り分け
- 体制前提: 家老1名＋足軽複数名を前提に、担当範囲を明確化する

## 3. 確認範囲と除外範囲

- 確認対象: Webクライアント主要画面（Login/Reception/Charts/Patients/Administration/Print）とルーティング/ガード
- 除外事項: Legacy/Archive 文書の更新、server/（legacy）改修、ORCA実環境の実測
- 前提条件 / 制約: 現有戦力（家老＋足軽1-4）で完遂、証跡はローカル保存、実API接続は不要

## 4. 画面一覧と確認観点

本節は、画面ごとの **ルート / 主要機能 / 主要API / データ整合 / エラー時挙動** を一覧化し、確認観点を最小の粒度で共有するためのものです。詳細は `docs/web-client/architecture/web-client-screen-review-template.md` を参照してください。
注: 本節は `WEB_CLIENT_IMPLEMENTATION_PLAN.md` の 1章直後または2章冒頭の差し込みテンプレとしても利用する。

### 4.1 画面一覧

| 画面ID | 画面名 | URL / 画面パス | 概要 | オーナー | 備考 |
| --- | --- | --- | --- | --- | --- |
| SCR-001 | Login | `/login`<br>`/f/:facilityId/login` | 認証/施設固定ログイン |  | LoginSwitchNotice 含む |
| SCR-002 | Reception | `/f/:facilityId/reception` | 受付一覧/検索/ORCA連携 |  | auto-refresh 90s |
| SCR-003 | Charts | `/f/:facilityId/charts` | カルテ/記録/送信/印刷 |  | SSE/送信ガード |
| SCR-004 | Patients | `/f/:facilityId/patients` | 患者管理/保険/メモ |  | returnTo 同期 |
| SCR-005 | Administration | `/f/:facilityId/administration` | 設定配信/ORCA queue/疎通 |  | system_admin 専用 |
| SCR-006 | Charts Print | `/f/:facilityId/charts/print/outpatient`<br>`/f/:facilityId/charts/print/document` | 印刷プレビュー |  | ナビ外 |
| SCR-007 | Debug Hub | `/f/:facilityId/debug` | デバッグ導線ハブ |  | ENV+role 条件 |
| SCR-008 | Debug Outpatient Mock | `/f/:facilityId/debug/outpatient-mock` | MSW/故障注入/telemetry |  | ENV+role 条件 |
| SCR-009 | Debug ORCA API | `/f/:facilityId/debug/orca-api` | ORCA API コンソール |  | ENV+role 条件 |
| SCR-010 | Debug Legacy REST | `/f/:facilityId/debug/legacy-rest` | Legacy REST コンソール |  | ENV+role 条件 |

#### 4.1.1 サンプル行（差し込み例）

| 画面 | ルート | 主要機能 | 主要API | データ整合 | エラー時挙動 |
| --- | --- | --- | --- | --- | --- |
| Login | `/login`<br>`/f/:facilityId/login` | 施設/ユーザー/パスワード/UUID入力、LoginSwitchNotice | `/api/user/{facilityId}:{userId}` | RUN_ID生成/保存、session/localStorage共有、facilityIdロック | 認証失敗の表示、セッション失効でログアウト + 監査 |
| Reception | `/f/:facilityId/reception` | ステータス別一覧、検索/フィルタ、保存ビュー、ORCA queue/再送 | `/orca/appointments/list`<br>`/orca/visits/*`<br>`/orca/claim/outpatient`<br>`/api/orca/queue` | Patientsとフィルタ同期、auto-refresh=90s/stale=180s、監査メタ反映 | ApiFailureBanner、missingMaster復旧ガイド、再取得導線 |
| Charts | `/f/:facilityId/charts` | 3カラム+ドロワー、DocumentTimeline、送信/印刷、SSE | `/karte/*`<br>`/odletter/*`<br>`/orca/*`<br>`/api21/medicalmodv2`<br>`/chart-events` | patientId/returnTo引継ぎ、送信ガード、SSE欠損時再同期 | ApiFailureBanner、missingMaster復旧ガイド、送信失敗トースト+バナー |

### 4.2 画面ごとの確認観点フォーマット

#### 4.2.1 画面: [画面ID] [画面名]

- 目的:
- 前提 / 権限:
- 主要導線:
- 入力/表示項目:
- 例外 / エラー:
- パフォーマンス / 体感:
- セキュリティ / 権限:
- 関連サーバー機能:
- 関連テストデータ:
- エビデンス:

各画面について上記項目を簡潔に記入し、4.1 の画面IDと紐付ける（詳細は別紙/設計書参照でも可）。

## 5. サーバー機能一覧

モダナイズ版サーバーで提供する REST API を、機能IDで管理する。一次の正本は `MODERNIZED_REST_API_INVENTORY.md` とし、本章では代表行を示す。最終版ではカテゴリ別に全行を展開する。

| 機能ID | 機能名 | API / バッチ | 役割概要 | 依存先 | 備考 |
| --- | --- | --- | --- | --- | --- |
| SVR-001 | ユーザー取得（本人） | `GET /user/{userId}` | ログインユーザー本人情報の取得。 | Auth | UserResource |
| SVR-002 | ユーザー一覧 | `GET /user` | 施設所属ユーザー一覧の取得。 | Auth | UserResource |
| SVR-003 | 月次活動ログ取得 | `GET /dolphin/activity/{yyyy,MM,count}` | 月次活動ログの取得。 | 監査 | SystemResource |
| SVR-004 | JMARIコード取得 | `GET /serverinfo/jamri` | JMARIコードを返却。 | 設定 | ServerInfoResource |
| SVR-005 | 患者取得（ID） | `GET /patient/id/{pid}` | 患者IDで単一患者を取得。 | DB | PatientResource |
| SVR-006 | 患者登録 | `POST /patient` | 患者の新規登録。 | DB | PatientResource |
| SVR-007 | 受付登録 | `POST /pvt` | 受付登録の実行。 | DB | PVTResource |
| SVR-008 | 予約/受付一覧 | `GET /schedule/pvt/{params}` | 予約/受付一覧の取得。 | DB | ScheduleResource |
| SVR-009 | カルテ保存 | `POST /karte/document` | 新規カルテ保存。 | DB | KarteResource |
| SVR-010 | SSE購読開始 | `GET /chart-events` | ChartEvent のSSE購読を開始。 | SSE | ChartEventStreamResource |

## 6. トレーサビリティ表（画面 x サーバー機能）

画面IDと機能IDの対応表。画面設計書の「API一覧」テーブルを正とし、本章ではサンプル行を示す。

| 画面ID | 画面名 | 機能ID | 機能名 | 依存区分 | 備考 |
| --- | --- | --- | --- | --- | --- |
| SCR-001 | Reception | SVR-007 | 受付登録 | 主要 | 受付登録/取消フローに利用 |
| SCR-001 | Reception | SVR-008 | 予約/受付一覧 | 主要 | 受付一覧の基礎データ |
| SCR-002 | Charts | SVR-009 | カルテ保存 | 主要 | 文書保存/添付管理の土台 |
| SCR-002 | Charts | SVR-010 | SSE購読開始 | 補助 | ChartEvent の更新通知 |
| SCR-003 | Patients | SVR-005 | 患者取得（ID） | 主要 | 患者参照・編集の起点 |
| SCR-003 | Patients | SVR-006 | 患者登録 | 主要 | 患者新規登録 |
| SCR-004 | Administration | SVR-001 | ユーザー取得（本人） | 補助 | 管理画面の権限/状態確認 |

## 7. 確認手順

### 7.1 準備

- 環境 / 権限の確認
- 必要資料の準備
- 事前リスク洗い出し
- 認証モーダル回避（LogFilter が未認証時に 401 + WWW-Authenticate を返す場合）:
`LOGFILTER_HEADER_AUTH_ENABLED=false`
`VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK=0`
`VITE_ENABLE_LEGACY_HEADER_AUTH=0`（任意、Basic のみ運用）
`VITE_ENABLE_FACILITY_HEADER=1`（Basic + Facility を維持）
- Vite proxy Authorization 上書き抑止:
既存の Authorization ヘッダがある場合は ORCA_BASIC_* を付与しない（vite.config.ts 対応済み）。
検証: DevTools の Request Headers で Authorization がクライアント側の値を維持し、未指定時のみ ORCA_BASIC_* が付与されることを確認。
- Reception 外来リスト 404 回避（/orca→/api/orca リライト抑止）:
`VITE_ORCA_API_PATH_PREFIX=off`（または `ORCA_API_PATH_PREFIX=off`）を指定し、`/orca/*` が `/api/orca/*` に書き換わらないことを Network で確認。
- setup-modernized-env.sh の暫定デフォルト:
`WEB_CLIENT_DEV_PROXY_TARGET` が `/openDolphin/resources` を含む場合は `VITE_ORCA_API_PATH_PREFIX=off` を既定で付与（/api 補完を抑止）。
戻す場合は `VITE_ORCA_API_PATH_PREFIX=/api` など明示指定で上書き。
- Charts 401 対策（Basic が MD5 になり 401 となる場合）:
`VITE_ENABLE_FACILITY_HEADER=1`
`VITE_ENABLE_LEGACY_HEADER_AUTH=1` + `LOGFILTER_HEADER_AUTH_ENABLED=true`（Legacy ヘッダ認証を許可する場合のみ）
`devPasswordPlain` を sessionStorage に保持するため再起動後は再ログイン
- X-Orca-Api-Result-Message ヘッダ抑止（暫定・既定はON）:
`ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER=false`
影響: `X-Orca-Api-Result-Message` が欠落し、ヘッダ参照の UI/ログで文言が表示されなくなる。必要なら XML body の `Api_Result_Message` を参照する。
- Vite dev-only ヘッダ drop（開発環境限定の回避策）:
`VITE_DEV_PROXY_DROP_ORCA_RESULT_MESSAGE=1`（または `VITE_PROXY_DROP_ORCA_RESULT_MESSAGE=1`）
影響: 開発プロキシが `X-Orca-Api-Result-Message` を削除するため、ヘッダ参照の UI/ログで文言が表示されない。
注意: dev server のみ有効。Preview/本番には反映されない。
- Vite dev-only X-Orca-* 全削除（最終手段）:
`VITE_DEV_PROXY_DROP_ORCA_HEADERS=1`（または `VITE_PROXY_DROP_ORCA_HEADERS=1`）
影響: `X-Orca-Api-Result` / `X-Orca-Api-Result-Success` / `X-Orca-Warnings` も欠落する。
- 運用メモ（反映には再起動が必要）:
  - docker compose 運用例:
    1) `docker-compose.override.dev.yml` の `server-modernized-dev.environment` に `ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER: "0"` を追加
    2) `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml up -d --force-recreate server-modernized-dev`
- X-Orca-* 全転送抑止（暫定・既定はON）:
`ORCA_PROXY_FORWARD_X_ORCA_HEADERS=false`
影響: `X-Orca-Api-Result` / `X-Orca-Api-Result-Success` / `X-Orca-Warnings` も欠落する。
- MSW 依存最小化 / 実 ORCA 経路の正常化手順（dev/proxy）:
  1) MSW 無効化: `VITE_DISABLE_MSW=1`（Service Worker を無効化して実経路へ）。
  2) Vite proxy を実サーバーへ: `VITE_DEV_PROXY_TARGET=http://<host>:<port>/openDolphin/resources` を設定し、
     `VITE_API_BASE_URL=/api` を維持（/api → /openDolphin/resources に中継）。
  3) ORCA 経路の前提:
     - server-modernized 側で ORCA 送信設定が必要（例: `ORCA_API_HOST/PORT/SCHEME/USER/PASSWORD`）。
     - WebORCA の場合は `ORCA_MODE=weborca`（必要なら `ORCA_API_PATH_PREFIX=/api` を明示）。
  4) LogFilter 認証モーダル回避: `LOGFILTER_HEADER_AUTH_ENABLED=false`（必要なら `VITE_ENABLE_LEGACY_HEADER_AUTH=0`）。
  5) 例外/回避フラグはオフ確認:
     - `VITE_USE_MOCK_ORCA_QUEUE=0`, `VITE_VERIFY_ADMIN_DELIVERY=0`
     - `VITE_DISABLE_CHART_EVENT_STREAM=0`, `VITE_DISABLE_ORCA_POLLING=0`
  6) /orca → /api/orca の自動付与が不要な場合は `VITE_ORCA_API_PATH_PREFIX=off`（既定化済み）。
  7) 期待確認: `/api/admin/config`（proxy 例外済み）・`/api/orca/queue`・`/orca/appointments/list` が 2xx で返ること。

  未解消課題（実経路）:
  - ORCA 側が非2xxを返す場合は `OrcaGatewayException` 経由で 502/503 になる（Api_Result のみで 500 にはならない）。
  - `/orca06/patientmemomodv2` は ORCA 側 405 の可能性があり、実運用前に ORCA 仕様/権限を確認。
- 仕様上の404の扱い（SSE/ORCA/サムネイル）:
`/api/chart-events` が 404 の場合は SSE 未提供として扱い、Console 記録のみで進行（提案: 404 でストリーム停止 or `VITE_DISABLE_CHART_EVENT_STREAM=1` 追加）。
`/api/orca/queue` が 404 の場合は ORCA queue 未提供として扱う（既存: 404 で以後の呼び出し停止）。
`/api01rv2/pusheventgetv2` が 404 の場合は push events 未提供として扱い、ポーリング停止が望ましい（提案: 404 検知で停止フラグ導入）。
サムネイル URL が 404 の場合は非致命として扱い、UI はサムネイル非表示/プレースホルダで継続（提案: `img onError` で隠す）。
ローカル検証代替: `VITE_DISABLE_MSW=0` で MSW を有効化し、/api/orca/queue と /api01rv2/pusheventgetv2 の mock を使用。
SSE/ORCA polling の軽量抑止フラグ:
`VITE_DISABLE_CHART_EVENT_STREAM=1` で SSE を無効化（chart-events の接続を行わない）。
`VITE_DISABLE_ORCA_POLLING=1` で /api/orca/queue と /api01rv2/pusheventgetv2 のネットワーク呼び出しを停止（ローカルで空レスポンスを返す）。
Admin config 404 回避（Vite proxy 例外）:
`/api/admin/*` は /api を剥がさず `/openDolphin/resources/api/admin/*` へ中継するよう例外対応済み。
検証: DevTools の Network で `/api/admin/config` が `/openDolphin/resources/api/admin/config` へ到達することを確認。
MSW 優先化:
`VITE_DISABLE_MSW=0` の場合、Reception の `fetchWithResolver` は mock 候補を先に試す（`/orca/*/mock` を優先）。
検証: Network で `/orca/appointments/list/mock` や `/orca/visits/list/mock` が呼ばれることを確認。
/orca/deptinfo 404 の扱い:
`/orca/deptinfo` が 404 の場合は候補取得をスキップし、予約一覧由来の候補で継続（非致命）。
MSW 追加対応:
`/orca/deptinfo` は MSW で簡易CSVを返す（例: `01 内科,02 外科,03 小児科`）。
`/orca/disease/import/:patientId` も MSW で空配列を返す（患者IDが未登録でも 200）。
`/api01rv2/patientlst7v2` は MSW で最小の XML（Api_Result=0000）を返す。

起動例:
```bash
LOGFILTER_HEADER_AUTH_ENABLED=false \
VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK=0 \
WEB_CLIENT_MODE=npm \
./setup-modernized-env.sh
```

### 7.2 実施

- 手順1: 画面一覧とサーバー機能一覧を確定し、担当と実施日を割り当てる。
- 手順2: 画面ごとの確認観点フォーマットに沿って確認を実施し、エビデンスを保存する。
- 手順3: サーバー機能ごとの確認（API/バッチ/連携）を実施し、結果を記録する。
- 手順4: トレーサビリティ表を更新し、未確認の画面/機能がないか突合する。
- 手順5: 8.1 チェックリストの判定（Yes/No/要確認）を埋め、要確認は10章に反映する。

#### 7.2.1 ブラウザ/DevTools を用いた動作確認

- ブラウザ操作で再現手順を確認し、Network/Console を記録する
- DevTools で API リクエスト/レスポンス、エラー内容、パフォーマンス指標を確認する
- 取得したログ/スクリーンショットをエビデンスとして保存する

#### 7.2.2 実施ログ（2026-02-02）

- 入口: `http://localhost:5173/login` → 施設選択 → `/f/1.3.6.1.4.1.9414.10.1/login` 表示を確認
- Console: `A form field element should have an id or name attribute` が3件
- 認証情報未共有のため Login/Reception/Charts/Patients/Administration の導線検証は未実施

#### 7.2.3 実施ログ（2026-02-02）

- 認証情報: login `dolphindev` / pass `dolphindev`
- 主要導線: Login → Reception → Charts → Patients を確認（Administration は権限不足で無効化表示）
- Console: `A form field element should have an id or name attribute`（count: 12）、OrcaSummary で React key 重複警告
- Network: `/openDolphin/resources/api/orca21/medicalmodv2/outpatient` が 404（UIプレビューに表示）
- UIエラー表示: `statusText.toLowerCase is not a function` を含むネットワーク失敗メッセージ

#### 7.2.4 実施ログ（2026-02-02）

- 認証情報: login `dolphindev` / pass `dolphindev`（system_admin 相当）
- 主要導線: Login → Charts → Administration を確認（Administration リンク有効・遷移は成功）
- Administration 画面: URL は `/administration` だが表示ヘッダ/本文は Charts コンテンツのまま
- Console: OrcaSummary の React key 重複警告、`A form field element should have an id or name attribute`（count: 12）
- Network: `/api/admin/config` と `/api/admin/delivery` が 404、`/api/orca/queue` と `/orca/claim/outpatient` も 404

#### 7.2.5 実施ログ（2026-02-03）

- 認証情報: login `dolphindev` / pass `dolphindev`（system_admin 相当）
- 主要導線: Admin/Charts を再読み込みし、Administration/Charts 双方の描画を確認
- Administration 画面: `/administration` で管理画面コンテンツが描画されることを確認
- Console: `A form field element should have an id or name attribute`（Administration: count 2 / Charts: count 11）。OrcaSummary の React key 重複警告・`statusText.toLowerCase` 例外は未再現
- Network: `/api/admin/config`・`/api/orca/queue`・`/orca/claim/outpatient`・`/orca21/medicalmodv2/outpatient` が 404

#### 7.2.6 実施ログ（2026-02-03）

- 修正対象: AppLayout Outlet key 付与後の表示確認
- 主要導線: Charts をリロード後に Administration へ遷移
- Administration 画面: `/administration` で管理画面コンテンツが描画されることを再確認（Charts 残留なし）
- Console: `A form field element should have an id or name attribute`（count: 2）。OrcaSummary の React key 重複警告・`statusText.toLowerCase` 例外は未再現
- Network: `/api/admin/config`・`/api/orca/queue`・`/orca/claim/outpatient`・`/orca21/medicalmodv2/outpatient` が 404

#### 7.2.7 実施ログ（2026-02-03）

- 修正対象: `/orca/claim/outpatient` の mock フォールバック
- 主要導線: Charts で「請求バンドルを再取得」を実行
- Network: `/orca/claim/outpatient` が 404 → `/orca/claim/outpatient/mock` が 404（フォールバック試行は発生）
- Console: 404 resource error が発生、`statusText.toLowerCase` 例外は未再現

#### 7.2.8 実施ログ（2026-02-03）

- 修正対象: form id/name 警告の再検証
- 主要導線: Administration / Charts / Patients を順に表示
- Console: Administration と Charts は id/name 警告が未再現、Patients で `A form field element should have an id or name attribute`（count: 24）
- Console: Patients で 500 リソースエラーが 1 件発生

#### 7.2.9 実施ログ（2026-02-03）

- 修正対象: `/orca/claim/outpatient/mock` 404 解消
- 主要導線: Charts で「請求バンドルを再取得」を実行
- Network: `/orca/claim/outpatient` が 404 → `/orca/claim/outpatient/mock` が 200（成功）
- Console: 404 resource error は残存、`statusText.toLowerCase` 例外は未再現

#### 7.2.10 実施ログ（2026-02-03）

- 修正対象: Patients の id/name 警告
- 主要導線: Patients 画面を表示して Console を確認
- Console: `A form field element should have an id or name attribute` 警告は未再現
- Console（再実施）: id/name 警告・500 リソースエラーともに未再現

#### 7.2.11 実施ログ（2026-02-03）

- 修正対象: Patients 500 エラー再検証
- 主要導線: Patients 画面を再読み込みして Console を確認
- Console: 500 リソースエラーは未再現

#### 7.2.12 実施ログ（2026-02-03）

- 修正対象: Reception 受付画面の全機能 + WEBORCA 実データ反映
- 主要導線:
  - 患者マスタ検索（氏名検索）を実行
  - 検索/フィルタ（日付変更→検索/再取得）
  - 保存ビュー作成（受付-20251202）
  - Patients へ遷移 → Reception へ戻る
  - resolveMasterSource=server へ切替 → 再取得
  - 監査履歴を更新
- 結果:
  - dataSourceTransition=server へ切替できたが、missingMaster=true が継続
  - 受付一覧/予約/会計リストは 0件のまま（WEBORCA 実データ反映は確認できず）
  - 監査サマリ: `APPOINTMENT_OUTPATIENT_FETCH(error)` を表示
  - 監査履歴: `/orca/visits/list/mock` と `/orca/claim/outpatient/mock` の error を記録
  - Console: `A form field element should have an id or name attribute` 警告（count 22）
  - Network: `/orca/claim/outpatient` `/orca/appointments/list` `/orca/visits/list` が `net::ERR_ABORTED`

#### 7.2.13 実施ログ（2026-02-03）

- 修正対象: Reception の id/name 警告
- 主要導線: Reception 画面表示 → Console 確認
- Console: `A form field element should have an id or name attribute` 警告が残存（count 22）
- 該当候補: 氏名/カナ/生年月日/性別/区分/患者ID/各種セレクト/検索/保存ビュー等の入力要素で id/name 未付与を確認

#### 7.2.14 実施ログ（2026-02-03）

- 修正対象: /orca/appointments/visits mock 追加後の再検証
- 主要導線: Reception で再取得
- 結果:
  - dataSourceTransition=mock に切替済みだが missingMaster=true が継続
  - `/orca/appointments/list` `/orca/visits/list` は `net::ERR_ABORTED` のまま
  - `/orca/appointments/list/mock` `/orca/visits/list/mock` は `net::ERR_CONNECTION_REFUSED`
  - 受付一覧/予約/会計リストは 0件のまま
  - Console に id/name 警告は表示されず

#### 7.2.15 実施ログ（2026-02-03）

- 修正対象: MSW 無効時の mock 候補除外
- 主要導線: resolveMasterSource=server へ切替 → Reception で再取得
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - `/orca/appointments/list` `/orca/visits/list` は `net::ERR_ABORTED` のまま
  - 一覧データ反映は 0件のまま（効果未確認）
  - Console は audit/telemetry のみ（id/name 警告なし）

#### 7.2.16 実施ログ（2026-02-03）

- 修正対象: AbortSignal 除外修正後の Reception 再検証
- 主要導線: resolveMasterSource=server へ切替 → 再取得 → 検索（患者名）実行
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - `/orca/appointments/list` `/orca/visits/list` は `net::ERR_ABORTED` のまま
  - 一覧データ反映は 0件のまま（効果未確認）
  - Console は audit/telemetry のみ（id/name 警告なし）

#### 7.2.17 実施ログ（2026-02-03）

- 修正対象: AbortError 再試行追加後の Reception 再検証
- 主要導線: resolveMasterSource=server へ切替 → 再取得 → 検索（患者名）実行
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - `/orca/appointments/list` `/orca/visits/list` は `net::ERR_ABORTED` のまま
  - 一覧データ反映は 0件のまま（効果未確認）
  - Console は audit/telemetry のみ（AbortError 再試行の詳細は確認できず）

#### 7.2.18 実施ログ（2026-02-03）

- 修正対象: AbortError 再試行/メタ伝播強化後の Reception 再検証
- 主要導線: resolveMasterSource=server へ切替 → 再取得 → 検索（患者名）実行
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - `/orca/appointments/list` `/orca/visits/list` は `net::ERR_ABORTED` のまま
  - 一覧データ反映は 0件のまま（効果未確認）
  - Console に `Deprecated feature used` (count 1) が出現
  - abortRetryAttempted/abortRetryReason/abortSignalAborted は UI/Console で確認できず

#### 7.2.19 実施ログ（2026-02-03）

- 修正対象: /orca rewrite 修正後の Reception 再検証
- 主要導線: resolveMasterSource=server へ切替 → 再取得 → 検索（患者名）実行
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - `/orca/appointments/list` `/orca/visits/list` は `net::ERR_ABORTED` のまま
  - 一覧データ反映は 0件のまま（効果未確認）
  - Console に `Deprecated feature used` (count 1) が出現
  - abortRetryAttempted/abortRetryReason/abortSignalAborted は UI/Console で確認できず

#### 7.2.20 実施ログ（2026-02-03）

- 修正対象: Trial ORCA 情報適用後の既存患者受付→一覧反映
- 主要導線: resolveMasterSource=server へ切替 → 再取得 → 患者マスタ検索（氏名）実行
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - recordsReturned=0（既存患者を取得できず）
  - `/orca/appointments/list` `/orca/visits/list` は pending のまま
  - 受付一覧/予約/会計リストは 0件のまま
  - Console は audit/telemetry のみ
  - Trial ORCA 情報の適用状態を確認できず、既存患者受付の実操作は未達

#### 7.2.21 実施ログ（2026-02-03）

- 修正対象: ORCA トライアル接続後のマスタ取得確認と受付テスト
- 主要導線: resolveMasterSource=server へ切替 → 再取得 → 患者マスタ検索（氏名）実行
- 結果:
  - dataSourceTransition=server、missingMaster=true が継続
  - recordsReturned=0（既存患者を取得できず）
  - `/orca/appointments/list` `/orca/visits/list` は pending のまま
  - 受付一覧/予約/会計リストは 0件のまま
  - Console は audit/telemetry のみ
  - ORCA トライアル接続の反映確認ができず、受付テストは未達

#### 7.2.22 実施ログ（2026-02-03）

- 修正対象: Trial ORCA 情報適用後の既存患者受付→一覧反映（再試行）
- 主要導線: ORCA_MODE=weborca + VITE_DEV_PROXY_TARGET=https://weborca-trial.orca.med.or.jp + ORCA_BASIC_USER/PASSWORD を設定して再起動 → system01dailyv2 200/Api_Result=00 → Reception 受付送信
- 結果:
  - `/api/api01rv2/system01dailyv2` は HTTP 200 / Api_Result=00
  - Reception 受付送信は 401 Authentication required で失敗
  - 受付一覧は 0 件のまま（patientId=00001 行なし）
  - Console に 401/acceptmodv2 error を記録
  - 既存患者受付→一覧反映は未達（Basic 認証情報の再確認が必要）

#### 7.2.23 実施ログ（2026-02-03）

- 修正対象: Trial ORCA 情報適用済みの環境で既存患者受付→一覧反映（再再試行）
- 主要導線: ORCA_BASIC_USER/PASSWORD を環境へ設定 → 再起動 → Reception 受付送信
- 結果:
  - 受付送信は 401 Authentication required で失敗
  - 受付一覧は 0 件のまま（patientId=00001 行なし）
  - Console に 401/acceptmodv2 error を記録
  - 既存患者受付→一覧反映は未達（Basic 認証の有効性要再確認）

#### 7.2.24 実施ログ（2026-02-03）

- 修正対象: setup-modernized-env.sh 修正反映後の既存患者受付→一覧反映
- 主要導線: ORCA_BASIC_USER/PASSWORD を設定して再起動 → Reception 受付送信
- 結果:
  - 受付送信は 401 Authentication required で失敗
  - 受付一覧は 0 件のまま（patientId=00001 行なし）
  - Console に 401/acceptmodv2 error を記録
  - 既存患者受付→一覧反映は未達（認証経路の再確認が必要）

#### 7.2.25 実施ログ（2026-02-03）

- 修正対象: acceptmodv2 認証修正後の受付送信→一覧反映
- 主要導線: ORCA_BASIC_USER/PASSWORD を設定して再起動 → Reception 受付送信
- 結果:
  - 受付送信は 401 Authentication required で失敗
  - 受付一覧は 0 件のまま（patientId=00001 行なし）
  - Console に 401/acceptmodv2 error を記録
  - 既存患者受付→一覧反映は未達（認証経路の再確認が必要）

#### 7.2.26 実施ログ（2026-02-03）

- 修正対象: setup-modernized-env.sh の認証フォールバック修正反映後の受付送信→一覧反映
- 主要導線: ORCA_TRIAL_USER/PASS を設定して再起動 → Reception 受付送信
- 結果:
  - 受付送信は 401 Authentication required で失敗
  - 受付一覧は 0 件のまま（patientId=00001 行なし）
  - Console に 401/acceptmodv2 error を記録
  - 既存患者受付→一覧反映は未達（認証経路の再確認が必要）

#### 7.2.26-1 証跡マップ（2026-02-04 追補）

| 実施ログ | RUN_ID | 証跡パス | 備考 |
| --- | --- | --- | --- |
| 7.2.1 | 20260204T091000Z-mainflow | `artifacts/webclient/screen-structure-plan/20260204T091000Z-mainflow/qa-log.md` | ブラウザ導線確認の再実行（Login〜Administration） |
| 7.2.2 | 20260204T091000Z-mainflow | `artifacts/webclient/screen-structure-plan/20260204T091000Z-mainflow/qa-log.md` | 施設選択画面の再確認 |
| 7.2.3 | 20260204T091000Z-mainflow | `artifacts/webclient/screen-structure-plan/20260204T091000Z-mainflow/qa-log.md` | Login→Reception→Charts→Patients の再実行（console 警告は再現せず） |
| 7.2.4 | 20260204T091000Z-mainflow | `artifacts/webclient/screen-structure-plan/20260204T091000Z-mainflow/qa-log.md` | Administration 画面表示の再確認 |
| 7.2.5 | 20260204T091000Z-mainflow | `artifacts/webclient/screen-structure-plan/20260204T091000Z-mainflow/qa-log.md` | 主要導線スクショ更新 |
| 7.2.6 | 20260204T091000Z-mainflow | `artifacts/webclient/screen-structure-plan/20260204T091000Z-mainflow/qa-log.md` | Outlet 修正後の表示確認（再実行） |
| 7.2.7 | 20260204T091400Z-claim | `artifacts/webclient/claim-deprecation/20260204T091400Z-claim/qa-claim-deprecation.md` | CLAIM 呼び出しなし（仕様変更で 404 フォールバック未再現） |
| 7.2.8 | 20260204T091600Z-404 | `artifacts/webclient/screen-structure-plan/20260204T091600Z-404/qa-404-suppression.md` | id/name 警告は再現せず（console warning 0） |
| 7.2.9 | 20260204T091400Z-claim | `artifacts/webclient/claim-deprecation/20260204T091400Z-claim/qa-claim-deprecation.md` | /orca/claim/outpatient mock へ遷移せず（CLAIM 廃止により再現不可） |
| 7.2.10 | 20260204T091600Z-404 | `artifacts/webclient/screen-structure-plan/20260204T091600Z-404/qa-404-suppression.md` | Patients id/name 警告・500 は再現せず |
| 7.2.11 | 20260204T091600Z-404 | `artifacts/webclient/screen-structure-plan/20260204T091600Z-404/qa-404-suppression.md` | Patients 500 再検証（console error 0） |
| 7.2.12 | 20260204T083500Z-orca-consistency | `artifacts/verification/20260204T083500Z/reception-ui.json` | ORCA 実データ 0 件で整合確認不可 |
| 7.2.13 | 20260204T091600Z-404 | `artifacts/webclient/screen-structure-plan/20260204T091600Z-404/qa-404-suppression.md` | Reception id/name 警告は再現せず |
| 7.2.14 | 20260204T091800Z-orca | `artifacts/webclient/screen-structure-plan/20260204T091800Z-orca/qa-reception-charts-orca.md` | /orca/* が 200（mock 接続拒否は再現せず） |
| 7.2.15 | 20260204T091800Z-orca | `artifacts/webclient/screen-structure-plan/20260204T091800Z-orca/qa-reception-charts-orca.md` | MSW 無効時も /orca/* 200（ERR_ABORTED 未再現） |
| 7.2.16 | 20260204T091800Z-orca | `artifacts/webclient/screen-structure-plan/20260204T091800Z-orca/qa-reception-charts-orca.md` | AbortSignal 関連は再現せず（/orca 200） |
| 7.2.17 | 20260204T091800Z-orca | `artifacts/webclient/screen-structure-plan/20260204T091800Z-orca/qa-reception-charts-orca.md` | AbortError 再試行は再現せず（/orca 200） |
| 7.2.18 | 20260204T091800Z-orca | `artifacts/webclient/screen-structure-plan/20260204T091800Z-orca/qa-reception-charts-orca.md` | Deprecated feature 警告は再現せず（console warning 0） |
| 7.2.19 | 20260204T091800Z-orca | `artifacts/webclient/screen-structure-plan/20260204T091800Z-orca/qa-reception-charts-orca.md` | /orca rewrite 修正後の 200 を確認 |
| 7.2.20 | 20260204T083500Z-orca-consistency | `artifacts/verification/20260204T083500Z/reception-ui.json` | ORCA 実データ 0 件（既存患者受付未達） |
| 7.2.21 | 20260204T083500Z-orca-consistency | `artifacts/verification/20260204T083500Z/reception-ui.json` | ORCA トライアルデータ未取得（0 件） |
| 7.2.22 | - | 証跡なし | ORCA trial 受付送信（acceptmodv2）再現できず |
| 7.2.23 | - | 証跡なし | 同上（認証/権限差分で未再現） |
| 7.2.24 | - | 証跡なし | 同上 |
| 7.2.25 | - | 証跡なし | 同上 |
| 7.2.26 | - | 証跡なし | 同上 |
| 7.2.33 | 20260204T055600Z-acceptmodv2-webclient | `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/accept-summary.md` | web-client 受付送信（acceptmodv2）成功（Api_Result=00） |
| 7.2.34 | 20260204T120058Z-soap-note | `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/` | Charts SOAP（S/O/A/P）入力/保存/再表示/編集（MSW） |
| 7.2.38 | 20260204T125507Z-soap-persistence-modernized | `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/qa-soap-persistence.md` | SOAP 保存（server-modernized）再検証。POST は発火するが response 500 |
| 7.2.39 | 20260204T130650Z-soap-subjectives-500 | `OpenDolphin_WebClient/artifacts/verification/20260204T130650Z-soap-subjectives-500/soap-subjectives-500/` | /orca/chart/subjectives 500 切り分け（proxy 500 / 9080 応答なし） |
| 7.2.40 | 20260204T133200Z-listener-check | `OpenDolphin_WebClient/artifacts/verification/20260204T133200Z-listener-check/listener-check/` | listener 復旧（9080/8080 応答 401 を確認） |
| 7.2.41 | 20260204T133701Z-soap-persistence-modernized | `OpenDolphin_WebClient/artifacts/verification/20260204T133701Z-soap-persistence-modernized/soap-persistence/qa-soap-persistence.md` | patient 作成後の SOAP 保存再検証（500/DB制約） |
| 7.2.40 | 20260204T132654Z-patients-edit | `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/patients-edit/qa-patients-edit.md` | Patients 検索→詳細→編集→保存→再表示（MSW） |
| 7.2.42 | 20260204T235000Z-chart-events-500 | `OpenDolphin_WebClient/artifacts/verification/20260204T235000Z-chart-events-500/chart-events-500.md` | /api/chart-events 500 の経路特定と恒久対応案整理 |
| 7.2.43 | 20260204T235603Z-chart-events-msw | `OpenDolphin_WebClient/artifacts/verification/20260204T235603Z-chart-events-msw/qa-chart-events-msw.md` | /api/chart-events MSW handler 追加で 500 抑止を確認 |
| 7.2.44 | 20260205T055237Z-chart-events-server | `OpenDolphin_WebClient/artifacts/verification/20260205T055237Z-chart-events-server/qa-chart-events-server.md` | server-modernized 側で 500 → 503 に抑止する恒久対応を確認 |

#### 7.2.26-3 証跡マップ（2026-02-05 追補）

| 実施ログ | RUN_ID | 証跡パス | 備考 |
| --- | --- | --- | --- |
| 7.2.45 | 20260205T061829Z-claim-ui-audit | `OpenDolphin_WebClient/artifacts/verification/20260205T061829Z-claim-ui-audit/claim-ui-audit/qa-claim-ui-audit.md` | CLAIM UI 最終監査（Reception/Charts で CLAIM 文言/導線なし） |

#### 7.2.26-2 未完検証の追加実行計画（acceptmodv2）

方針更新: acceptmodv2 は受付業務の必須APIとして復旧/検証対象に戻す。

目的: 7.2.22〜7.2.26 の 401 ループを解除し、受付送信→一覧反映の証跡を取得する。

事前チェック（再現前ランブック）:
- 接続先/認証（server-modernized）: `ORCA_BASE_URL` または `ORCA_API_HOST/PORT/SCHEME` が設定済み。
- 認証（server-modernized→ORCA）: `ORCA_API_USER` / `ORCA_API_PASSWORD` が設定済み。
- WebORCA 判定: Trial の場合は `ORCA_MODE=weborca`（または `ORCA_API_WEBORCA=1`）を明示。
- `/api` 付与: `ORCA_API_PATH_PREFIX` を `off` にしていないこと（WebORCA の `/api` 付与が必要）。
- Web クライアント認証: ログイン後に `Authorization` が付与されるか確認。
- 代替認証を使う場合: `VITE_ENABLE_LEGACY_HEADER_AUTH=1` + `LOGFILTER_HEADER_AUTH_ENABLED=1`。
- 施設ヘッダ: `X-Facility-Id` を付与する必要がある環境は `VITE_ENABLE_FACILITY_HEADER=1`。
- ORCA データ前提: Dr/患者 seed が存在（例: Dr=10000/10001, Patient=00005）。
- POST 開放: Trial で `acceptmodv2` が HTTP405 の場合はブロッカー（別環境が必要）。

seed/権限の準備手順（最小）:
1. Dr seed の確認/投入:
   - ORCA 側に診療担当医（Dr）コードが存在することを確認（例: `10000/10001`）。
   - 不在の場合は ORCA 側のデータ投入手順で Dr を追加（運用チーム/ORCA 管理者に依頼）。
2. Patient seed の確認/投入:
   - 受付送信対象の患者IDを 2 件用意（例: `00005`=受付済み、`00006`=未受付）。
   - 不在の場合は ORCA 側で患者登録を実施（基本属性 + 保険区分）。
3. 予約/会計状態の前提:
   - 予約枠が存在すること（当日分の予約 1 件）。
   - 会計ステータスの状態差（送信済み/保留/失敗）を 1 件ずつ用意。
4. 権限/ロールの確認:
   - Web クライアント側の `admin` ロールで Reception 操作が可能であることを確認。
   - `system_admin` ロールで Administration の ORCA 設定確認が可能であることを確認。
   - ロール不足の場合はユーザー権限の付与を依頼。

最小手順（curl + UI）:
1. `system01dailyv2` で疎通確認（Basic + `X-Facility-Id`）。
2. `/api/orca11/acceptmodv2?class=01` の POST を直接確認（HTTP405 でないこと）。
3. Web クライアントでログイン → Reception で「受付送信」。
4. 受付一覧に反映されることを確認（受付ID/患者IDが表示）。

期待応答:
- `system01dailyv2`: HTTP 200 / `Api_Result=00`。
- `acceptmodv2` (direct): HTTP 200 / `Api_Result=00`（成功）または `10/21`（データ不足だが到達確認）。
- UI: バナーに `Api_Result=00` 表示、一覧に受付が追加。

失敗時の分岐（簡易）:
| 症状 | 主な原因 | 対処 |
| --- | --- | --- |
| 401 Unauthorized | Web クライアント認証未付与 / header 認証無効 | ログイン再実施、`Authorization` 送出確認。header 認証なら `VITE_ENABLE_LEGACY_HEADER_AUTH=1` + `LOGFILTER_HEADER_AUTH_ENABLED=1` |
| 403 Forbidden | 施設ID/権限不一致 | `X-Facility-Id` とユーザー権限を再確認 |
| 404 Not Found | `/api` 付与漏れ、proxy 先誤り | `ORCA_MODE=weborca`、`ORCA_API_PATH_PREFIX`、`VITE_DEV_PROXY_TARGET` を再確認 |
| 405 Method Not Allowed | ORCA 側で POST 未開放（Trial 制約） | POST 開放済みの環境へ切替（dev ORCA など） |
| 5xx | ORCA 接続/seed 不足/DB 例外 | `ORCA_API_*` と seed（Dr/患者）を再確認 |

証跡フォーマット:
- RUN_ID: `YYYYMMDDTHHMMSSZ-acceptmodv2`
- 保存先: `artifacts/verification/{RUN_ID}/`
- ファイル例: `qa-acceptmodv2.md` / `curl-system01dailyv2-headers.txt` / `curl-system01dailyv2-body.json` / `reception-accept-01.png` / `reception-accept-network.json` / `server-modernized-acceptmodv2.log`（該当行のみ）

実行順序と担当:
| 順序 | 作業 | 実施可否 | 担当 | 前提/備考 |
| --- | --- | --- | --- | --- |
| 1 | 認証情報の提供と施設IDの確定 | 要準備 | 家老 | 殿/運用チームからの共有が必要 |
| 2 | server-modernized の環境変数反映と再起動 | 実施可能 | 足軽8 | 1 の情報受領後に実施 |
| 3 | `system01dailyv2` 疎通（curl）で 200/Api_Result=00 を確認 | 実施可能 | 足軽8 | Basic + `X-Facility-Id` |
| 4 | Reception 受付送信（acceptmodv2） | 実施可能 | 足軽8 | UI 送信。失敗時は curl 代替 |
| 5 | 受付一覧/予約/会計の反映を UI で確認 | 実施可能 | 足軽8 | 受付送信後に再取得 |
| 6 | ORCA 応答 JSON と UI の突合記録 | 実施可能 | 足軽8 | 8.1.4 の証跡と同 RUN_ID で保存 |

補足: 受付送信が 401 の場合は、`Authorization` と `X-Facility-Id` の送出ログを保存し、`curl -v` のヘッダ証跡を添付する。

acceptmodv2 復旧に必要な前提（参考）:
- 接続/認証:
  - ORCA 接続先が到達可能（Trial/Dev/本番のいずれか）。Dev は VPN/FW/稼働前提。
  - Basic 認証（ユーザー/パス）が有効で、`X-Facility-Id` が正しいこと。
  - `ORCA_MODE=weborca` / `ORCA_API_PATH_PREFIX` の整合（WebORCA 想定時は `/api` 必須）。
- seed/権限:
  - 医師マスタ（Dr）と患者マスタが存在（少なくとも各1件）。
  - 受付送信に必要なロール/権限（admin/doctor など）が付与されていること。
  - facility.json の施設IDと ORCA 側設定が一致。
- 環境変数:
  - `ORCA_API_HOST/PORT/SCHEME` または `ORCA_BASE_URL`
  - `ORCA_API_USER/PASSWORD`
  - `ORCA_MODE=weborca`（必要時）
  - `VITE_DISABLE_MSW=1` / `VITE_DEV_PROXY_TARGET=<server-modernized>/openDolphin/resources`

Trial 不可の場合の本番想定計画（参考）:
1. 本番相当 ORCA の接続先/認証情報/施設ID を事前共有（運用担当から提供）。
2. 本番相当環境で `system01dailyv2` を 200/Api_Result=00 で確認。
3. 本番相当の患者/医師 seed を最低限用意（受付送信対象の患者IDを確定）。
4. web-client を本番相当接続に向けて起動（MSW 無効、proxy 経由で実 ORCA 呼び出し）。
5. 受付送信（acceptmodv2）を実行し、UI/Network/ORCA 応答の証跡を保存。

実測結果（2026-02-04）:
- RUN_ID: `20260204T033205Z-acceptmodv2-trial`
  - Trial: `https://weborca-trial.orca.med.or.jp/api/orca11/acceptmodv2?class=01`
  - HTTP: 200
  - Api_Result: 10（患者番号に該当する患者が存在しません）
  - 証跡: `OpenDolphin_WebClient/artifacts/verification/20260204T033205Z-acceptmodv2-trial/`
    - `acceptmodv2_request.xml`
    - `acceptmodv2_response.headers`
    - `acceptmodv2_response.xml`
    - `acceptmodv2_http_status.txt`
- Dev: `http://100.102.17.40:8000/api/orca11/acceptmodv2?class=01`
  - 接続不可（curl exit 28 / timeout）
  - 証跡: `OpenDolphin_WebClient/artifacts/verification/20260204T033205Z-acceptmodv2-trial/acceptmodv2_dev_error.log`
  - HTTP status: `acceptmodv2_dev_http_status.txt`（000）

Dev ORCA 到達性ブロッカー（前提/確認）:
- VPN: 社内 VPN 接続が必須（未接続だと 100.102.17.40:8000/443/8443 が timeout）。
- Firewall: 100.102.17.40 の 8000/443/8443 が許可されていること（FW/SG で遮断される場合がある）。
- 稼働状態: Dev ORCA コンテナ/サーバーが稼働していること（停止時は TCP timeout）。
- `/api` 前提: WebORCA 想定時は `/api` プレフィックスが必要。`ORCA_MODE=weborca` / `ORCA_API_PATH_PREFIX` を確認。
- 認証: Basic 認証（ormaster/change_me など）を設定し、proxy/直叩きの両経路で一致させる。

到達性の確認手順（最小）:
1. VPN 接続を確認（社内ネットワークに到達できること）。
2. TCP 確認: `nc -vz 100.102.17.40 8000`（または `curl -v http://100.102.17.40:8000/`）。
3. TLS 確認: `openssl s_client -connect 100.102.17.40:443 -servername 100.102.17.40`（必要な場合）。
4. ORCA 疎通: `curl -u <user>:<pass> -H 'Accept: application/xml' -H 'Content-Type: application/xml' --data-binary @<request.xml> http://100.102.17.40:8000/api01rv2/system01dailyv2`（HTTP200 / Api_Result=00）。
5. Vite proxy 経由の確認: `VITE_DEV_PROXY_TARGET=http://100.102.17.40:8000/openDolphin/resources` をセットし、UI から `/orca/visits/list` を確認。

最小 seed 作成コマンド例（Trial/Dev）:
- 注意: Trial は POST 制約やデータ不足で `acceptmodv2` が不安定。Dev は VPN/FW/稼働前提。
- XML は既存のテンプレを利用し、`Patient_ID` / `Physician_Code` は実データに合わせて更新する。

Trial（WebORCA 公開）:
```bash
BASE=https://weborca-trial.orca.med.or.jp
AUTH=trial:weborcatrial

# 医師コード取得（system01lstv2, class=02）
curl -u "${AUTH}" -H 'Accept: application/xml' -H 'Content-Type: application/xml; charset=UTF-8' \
  --data-binary @OpenDolphin_WebClient/artifacts/orca-connectivity/legacy/20251122T132337Z/crud/system01lstv2/request_class02_20251122T045446Z.xml \
  "${BASE}/api/api01rv2/system01lstv2?class=02"

# 患者作成（patientmodv2, class=01）
curl -u "${AUTH}" -H 'Accept: application/xml' -H 'Content-Type: application/xml; charset=UTF-8' \
  --data-binary @OpenDolphin_WebClient/docs/server-modernization/phase2/operations/assets/orca-api-requests/14_patientmodv2_request.xml \
  "${BASE}/api/orca12/patientmodv2?class=01"

# 受付登録（acceptmodv2, class=01）
curl -u "${AUTH}" -H 'Accept: application/xml' -H 'Content-Type: application/xml; charset=UTF-8' \
  --data-binary @OpenDolphin_WebClient/artifacts/orca-connectivity/legacy/20251122T132337Z/crud/acceptmodv2/request_20251122T045705Z.xml \
  "${BASE}/api/orca11/acceptmodv2?class=01"
```

Dev（到達性が確保できる場合）:
```bash
BASE=http://100.102.17.40:8000
AUTH=ormaster:change_me

curl -u "${AUTH}" -H 'Accept: application/xml' -H 'Content-Type: application/xml; charset=UTF-8' \
  --data-binary @OpenDolphin_WebClient/artifacts/orca-connectivity/legacy/20251122T132337Z/crud/system01lstv2/request_class02_20251122T045446Z.xml \
  "${BASE}/api01rv2/system01lstv2?class=02"

curl -u "${AUTH}" -H 'Accept: application/xml' -H 'Content-Type: application/xml; charset=UTF-8' \
  --data-binary @OpenDolphin_WebClient/docs/server-modernization/phase2/operations/assets/orca-api-requests/14_patientmodv2_request.xml \
  "${BASE}/api/orca12/patientmodv2?class=01"

curl -u "${AUTH}" -H 'Accept: application/xml' -H 'Content-Type: application/xml; charset=UTF-8' \
  --data-binary @OpenDolphin_WebClient/artifacts/orca-connectivity/legacy/20251122T132337Z/crud/acceptmodv2/request_20251122T045705Z.xml \
  "${BASE}/api/orca11/acceptmodv2?class=01"
```

seed 確認 実測結果（2026-02-04）:
- RUN_ID: `20260204T042010Z-acceptmodv2-seedcheck`
  - system01lstv2: HTTP 200 / Api_Result=00（医師コード 10001/10003 を取得）
    - `OpenDolphin_WebClient/artifacts/verification/20260204T042010Z-acceptmodv2-seedcheck/system01lstv2_response.xml`
  - patientmodv2（テンプレ 14_patientmodv2_request.xml）: HTTP 200 / Api_Result=H1（保険者番号検証エラー）
    - `.../patientmodv2_response.xml`
  - patientmodv2（alt request_20251122T045544Z.xml）: HTTP 200 / Api_Result=00 / Patient_ID=01414
    - `.../patientmodv2_alt_response.xml`
- RUN_ID: `20260204T042913Z-acceptmodv2-patient01414`
  - acceptmodv2（Patient_ID=01414）: HTTP 200 / Api_Result=14（ドクターが存在しません）
  - Physician_Code=10000 が Trial 側で未登録の可能性（system01lstv2 の医師コードに合わせる必要あり）
  - 証跡: `OpenDolphin_WebClient/artifacts/verification/20260204T042913Z-acceptmodv2-patient01414/`
    - `acceptmodv2_request.xml` / `acceptmodv2_response.headers` / `acceptmodv2_response.xml` / `acceptmodv2_http_status.txt`
- RUN_ID: `20260204T050320Z-acceptmodv2-phys10001`
  - acceptmodv2（Patient_ID=01414 / Physician_Code=10001）: HTTP 200 / Api_Result=00 / Acceptance_Id=00001
  - Trial 側の医師コードに合わせることで受付登録成功を確認
  - 証跡: `OpenDolphin_WebClient/artifacts/verification/20260204T050320Z-acceptmodv2-phys10001/`
    - `acceptmodv2_request.xml` / `acceptmodv2_response.headers` / `acceptmodv2_response.xml` / `acceptmodv2_http_status.txt`

WEBORCA実データ送信（web-client経由）準備:
- 手順/チェックリストは `docs/weborca-reception-checklist.md` の「2.9 WEBORCA実データ送信（web-client経由）準備チェックリスト」を参照。
- 前提:
  - server-modernized に ORCA 接続情報（`ORCA_API_*` / `ORCA_BASE_URL` / `ORCA_MODE=weborca`）が反映済み。
  - Web クライアントは `VITE_DISABLE_MSW=1` で起動し、`VITE_DEV_PROXY_TARGET` が server-modernized を指す。
  - 受付送信用のユーザー（`admin`/`doctor`）でログインでき、`Authorization` が付与される。
  - ORCA 実データ（受付対象の患者ID/当日受付情報）が存在。
- 実施チェック:
  - `/orca/appointments/list` `/orca/visits/list` が 200 で返る。
  - Reception で患者ID/保険区分/来院区分を入力し、送信リクエストが実送出される。
  - RUN_ID を採番し、送信前後の UI/Network 証跡を保存。

Dev ORCA 到達性チェックリスト（実行用）:
- [ ] 事前条件: VPN 接続 / FW 許可 / Dev ORCA 稼働 / Basic 認証 / `ORCA_MODE=weborca` / `ORCA_API_PATH_PREFIX` を確認
- [ ] ルート確認: `route -n get 100.102.17.40`（`utun` 経由で到達すること）
- [ ] TCP 到達: `nc -vz 100.102.17.40 8000`（接続成功）
- [ ] HTTP 到達: `curl -v http://100.102.17.40:8000/`（接続成功/応答あり）
- [ ] TLS 到達: `openssl s_client -connect 100.102.17.40:443 -servername 100.102.17.40`（必要時）
- [ ] ORCA 疎通: `curl -u <user>:<pass> ... /api01rv2/system01dailyv2`（HTTP200 / Api_Result=00）
- [ ] UI 経由: Vite proxy 経由で `/orca/visits/list` が 200（UI/Network で確認）

Dev ORCA 到達不可時のエスカレーション（必要確認先/依頼項目）:
- 連絡先（一次窓口）: 家老（取りまとめ）
- 連絡先（確認先想定）:
  - ネットワーク/VPN 管理者（VPN 接続/ルーティング/許可）
  - インフラ/サーバー管理者（Dev ORCA 稼働状態/ポート開放）
  - ORCA 運用担当（Basic 認証/施設ID/接続先確認）

依頼テンプレ（確認項目/再現条件/証跡）:
- 件名: Dev ORCA（100.102.17.40:8000）到達不可の確認依頼
- 再現条件:
  - 実行日時: `<YYYY-MM-DD HH:mm>`
  - 接続元: `<端末名/拠点>`
  - VPN: `<接続済/未接続>`
  - ルート: `route -n get 100.102.17.40` の結果（utun 経由か）
  - コマンド: `nc -vz 100.102.17.40 8000` / `curl -v http://100.102.17.40:8000/`
- 確認依頼項目:
  - Dev ORCA サーバーの稼働状態（プロセス/コンテナ/ヘルス）
  - 100.102.17.40:8000/443/8443 の FW/SG 許可状況
  - VPN ルーティング（100.64.0.0/10）への到達許可
  - Basic 認証情報の有効性（ユーザー/パス/施設ID）
  - WebORCA のパス前提（`/api` が必要か）
- 添付証跡:
  - `artifacts/verification/<RUN_ID>/route-100.102.17.40.txt`
  - `artifacts/verification/<RUN_ID>/socket-connect-100.102.17.40-8000.txt`
  - `artifacts/verification/<RUN_ID>/curl-http-stdout.txt`
  - `artifacts/verification/<RUN_ID>/curl-system01dailyv2-stdout.txt`

参考（7.2.1〜7.2.26 以外の補助証跡）:
- `artifacts/webclient/screen-structure-plan/20260204T091200Z-extras/qa-extra-log.md`（Charts Print/Debug 導線）

#### 7.2.27 実施ログ（2026-02-04）

- 修正対象: ORCA関連API 実HTTP検証（認証付き）
- 主要導線:
  - Basic 認証 + X-Facility-Id 付与で curl 実行（user/pass: dolphindev）
  - RUN_ID=20260203T232243Z-orca-api-auth
- 結果:
  - `/api/orca/queue`
    - mock header: 200（source=mock、MOCK-001/002）
    - retry（patientId=MOCK-001&retry=true）: retryApplied=true / retryReason=mock_retry
    - discard（DELETE patientId=MOCK-002）: discardApplied=true / queue=[]
    - live header: 200（source=live、queue=[]）
  - `/api01rv2/pusheventgetv2`
    - mock header: 200（stub, Api_Result=0000）
    - mock header 無し: 200（ORCA trial のイベント配列）
  - `/orca/disease/import/00001`: 404 patient_not_found（Api_Result=10）
- 証跡: `OpenDolphin_WebClient/artifacts/orca-queue-verify/20260203T232243Z-orca-api-auth/`

#### 7.2.28 実施ログ（2026-02-04）

- 修正対象: ORCA未設定時の /api01rv2/pusheventgetv2 / /orca/disease/import 再検証
- 主要導線:
  - ORCA_API_* / ORCA_MODE を空にした override で server-modernized-dev 再起動
  - RUN_ID=20260203T232322Z-orca-api-no-orca-auth
- 結果:
  - `/api01rv2/pusheventgetv2`
    - mock header: 200（stub, Api_Result=0000）
    - mock header 無し: 503 orca.transport.unavailable
  - `/orca/disease/import/00001`: 404 patient_not_found（Api_Result=10、設定済みと同値）
- 証跡: `OpenDolphin_WebClient/artifacts/orca-queue-verify/20260203T232322Z-orca-api-no-orca-auth/`

#### 7.2.29 実施ログ（2026-02-04）

- 修正対象: /api01rv2/pusheventgetv2 の 503/stub 再現（ORCA未設定）
- 主要導線:
  - ORCA_API_* / ORCA_MODE を空にした override で server-modernized-dev 再起動
  - RUN_ID=20260203T232747Z-pushevent-no-orca-recheck
- 結果:
  - mock header: 200 stub（Api_Result=0000）
  - mock header 無し: 503 orca.transport.unavailable
- 証跡: `OpenDolphin_WebClient/artifacts/orca-queue-verify/20260203T232747Z-pushevent-no-orca-recheck/`

#### 7.2.30 実施ログ（2026-02-04）

- 修正対象: MSW 有効時の E2E 再検証（console warning 解消確認）
- 主要導線: Playwright `qa-404-suppression.mjs` で Reception → Charts → Patients
- 結果:
  - console error / warning / 404 = 0
  - Network: `/orca/appointments/list` `/orca/visits/list` `/orca21/medicalmodv2/outpatient` が 200
- 証跡:
  - RUN_ID: 20260203T215120Z-msw-on-warnfix
  - `artifacts/webclient/screen-structure-plan/20260203T215120Z-msw-on-warnfix/qa-404-suppression.md`
  - `artifacts/webclient/screen-structure-plan/20260203T215120Z-msw-on-warnfix/qa-404-suppression.json`
  - `artifacts/webclient/screen-structure-plan/20260203T215120Z-msw-on-warnfix/screenshots-404-suppression`

#### 7.2.31 実施ログ（2026-02-04）

- 修正対象: MSW 無効時の E2E 再検証（実経路 + console warning 解消確認）
- 主要導線: Playwright `qa-404-suppression.mjs` で Reception → Charts → Patients（MSW 無効）
- 結果:
  - console error / warning / 404 = 0
  - Network: `/orca/appointments/list` `/orca/visits/list` `/orca21/medicalmodv2/outpatient` が 200
- 証跡:
  - RUN_ID: 20260203T215654Z-msw-off-warnfix2
  - `artifacts/webclient/screen-structure-plan/20260203T215654Z-msw-off-warnfix2/qa-404-suppression.md`
  - `artifacts/webclient/screen-structure-plan/20260203T215654Z-msw-off-warnfix2/qa-404-suppression.json`
  - `artifacts/webclient/screen-structure-plan/20260203T215654Z-msw-off-warnfix2/screenshots-404-suppression`

#### 7.2.32 実施ログ（2026-02-04）

- 修正対象: ORCA 実接続の API 成功確認（server-modernized 直）
- 主要導線: `/openDolphin/resources/orca/appointments/list` `/openDolphin/resources/orca/visits/list` を curl で実行
- 結果:
  - `/orca/appointments/list` 200
  - `/orca/visits/list` 200
- 証跡:
  - `artifacts/verification/20260204T082000Z/orca-appointments-headers.txt`
  - `artifacts/verification/20260204T082000Z/orca-appointments-body.json`
  - `artifacts/verification/20260204T082000Z/orca-visits-headers.txt`
  - `artifacts/verification/20260204T082000Z/orca-visits-body.json`

#### 7.2.33 実施ログ（2026-02-04）

- 修正対象: WEBクライアント経由の受付送信（acceptmodv2）成功証跡
- 主要導線: Reception で患者 01415 を受付送信（admin ロール）
- 結果:
  - Api_Result=00（情報受付登録が完了しました）
  - Network: `/api/orca/queue` と `/orca/visits/mutation` が 200
  - Console warning/error なし
- 証跡:
  - RUN_ID: 20260204T055600Z-acceptmodv2-webclient
  - `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/accept-summary.md`
  - `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/screenshots/`
  - `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/network/`

#### 7.2.33 実施ログ（2026-02-04）

- 修正対象: Dev ORCA（100.102.17.40:8000）到達性の切り分け
- 主要導線:
  - ルーティング確認（`route -n get 100.102.17.40`）
  - socket 接続テスト（2秒タイムアウト）
  - curl による HTTP 到達性確認（`/` / `/api01rv2/system01dailyv2`）
- 結果:
  - ルーティングは `utun1`（100.64.0.0/10）経由
  - socket 接続は Timeout（2秒）
  - curl は接続タイムアウト（2000ms）
  - Dev ORCA（100.102.17.40:8000）へ到達不可
- 前提/要件:
  - 100.64.0.0/10 への VPN 接続が有効であること（`utun` 経路）
  - 100.102.17.40:8000 の FW/SG で許可済みであること
  - Dev ORCA 側が稼働中であること（運用側の疎通確認）
- 証跡:
  - `artifacts/verification/20260204T130849Z-dev-orca-connectivity/route-100.102.17.40.txt`
  - `artifacts/verification/20260204T130849Z-dev-orca-connectivity/socket-connect-100.102.17.40-8000.txt`

#### 7.2.34 実施ログ（2026-02-04）

- 修正対象: Charts SOAP 記載（S/O/A/P）入力/保存/再表示/編集
- 主要導線: Playwright `tests/charts/e2e-soap-note.spec.ts`（MSW）
- 結果:
  - S/O/A/P に入力 → 保存 → 再表示 → 編集の一連が完了
  - 各セクションの履歴ラベルが「記載履歴なし」から更新
  - Plan 編集の追記が保存後も保持
- 証跡:
  - RUN_ID: 20260204T120058Z-soap-note
  - `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/qa-soap-note.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/soap-note-input.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/soap-note-saved.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/soap-note-edited.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/har/`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T120058Z-soap-note/videos/`
  - `artifacts/verification/20260204T130849Z-dev-orca-connectivity/curl-http-stdout.txt`
  - `artifacts/verification/20260204T130849Z-dev-orca-connectivity/curl-system01dailyv2-stdout.txt`

#### 7.2.34 実施ログ（2026-02-04）

- 修正対象: オーダー画面（薬剤/処置マスタ）の表示・検索・入力（ORCA 連携）
- 主要導線:
  - Web クライアント起動 → Charts 画面（`patientId=01415`）
  - 処方編集 → 薬剤マスタ検索/選択 → 用量/用法入力
  - オーダー編集 → 処置マスタ検索/選択 → 数量入力
- 前提/要件:
  - `/api/admin/config` `/api/admin/delivery` は QA で `chartsDisplayEnabled=true` をモック
  - `/orca/master/*`（generic-class / material / youhou）は QA でモック
- 結果:
  - 薬剤マスタ表示/選択/用量・用法入力を確認（OK）
  - 処置マスタ表示/選択/数量入力を確認（OK）
  - `/orca/disease/import/01415` と `/orca/order/bundles`（medOrder/generalOrder）は 404（mock 未実装のため未検証）
- 証跡:
  - `artifacts/webclient/order-master-ui/20260204T073200Z-order-master-ui/qa-order-master-ui.md`
  - `artifacts/webclient/order-master-ui/20260204T073200Z-order-master-ui/screenshots-order-master/01-med-master-input.png`
  - `artifacts/webclient/order-master-ui/20260204T073200Z-order-master-ui/screenshots-order-master/02-treatment-master-input.png`

#### 7.2.35 実施ログ（2026-02-04）

- 修正対象: 検証環境の整備（OpenDolphin_WebClient 作業ディレクトリへ切替）
- 主要導線:
  - `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient` の構成確認
  - `setup-modernized-env.sh` と `ORCA_CERTIFICATION_ONLY.md` を確認し、Trial 既定値/必須変数を整理
- 結果:
  - `web-client/` `server-modernized/` の配置を確認（準備可能）
  - WebORCA Trial の公開情報（base URL / basic 認証）が `docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md` に記載
  - `setup-modernized-env.sh` は `ORCA_API_*` / `ORCA_MODE` / `VITE_DEV_PROXY_TARGET` を使用し、`ORCA_*` が未設定の場合は既定値を使用
  - 実起動/接続は未実施（資格情報/Facility ID の適用は未確認）
- 証跡:
  - `OpenDolphin_WebClient` 直下の構成確認ログは本報告に記載

#### 7.2.36 実施ログ（2026-02-04）

- 修正対象: SOAP 記載（保存/再表示）の server-modernized 連携有無
- 主要導線:
  - Charts 画面で SOAP 入力 → 保存
  - DocumentTimeline の SOAP 履歴に再表示されることを確認
- 結果:
  - SOAP 入力は DocumentTimeline に再表示される（OK）
  - sessionStorage に `opendolphin:web-client:soap-history:*` が生成される（クライアント保持）
  - `/orca/chart/subjectives` `/orca25/subjectivesv2` 等の SOAP 系 endpoint へのリクエストは 0（server-modernized 連携なし）
  - リロードでの再表示は未実施（履歴表示で確認）
- 影響/示唆:
  - SOAP 記載は現状クライアント保持のみで、server-modernized への永続化は未実装
  - 永続化が必要な場合は SOAP 保存時に server 側 API を追加/連携する必要あり
- 証跡:
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125500Z-soap-persistence/soap-persistence/qa-soap-persistence.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125500Z-soap-persistence/soap-persistence/screenshots/01-soap-saved.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125500Z-soap-persistence/soap-persistence/screenshots/02-soap-history.png`

#### 7.2.37 実施ログ（2026-02-04）

- 修正対象: SOAP 保存時の server-modernized 連携（`/orca/chart/subjectives`）
- 主要導線:
  - SOAP 保存時に `/orca/chart/subjectives` へ JSON 送信
  - 通信ログで request/response を確認
- 結果:
  - `/orca/chart/subjectives` への request は発火（POST 1件）
  - server-modernized（`localhost:8080`）が未起動のため response を取得できず（接続不可）
  - server 側永続化の確認はブロック
- 証跡:
  - `OpenDolphin_WebClient/artifacts/verification/20260204T131500Z-soap-persistence/soap-persistence/qa-soap-persistence.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T131500Z-soap-persistence/soap-persistence/network/soap-requests.json`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T131500Z-soap-persistence/soap-persistence/server-reachability.txt`

#### 7.2.38 実施ログ（2026-02-04）

- 修正対象: SOAP 保存時の server-modernized 連携（`/orca/chart/subjectives`）再検証
- 主要導線:
  - web-client dev server（`VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources` + MSW off）
  - Charts 画面で Subjective に入力 → 保存 → DocumentTimeline の SOAP 履歴で再表示
- 結果:
  - SOAP 入力は DocumentTimeline に再表示される（OK、クライアント保存）
  - `/orca/chart/subjectives` への POST 1 件を確認
  - response は 500（Internal Server Error、body 空）
  - server 側永続化/Api_Result=00 の確認は未達（500 のため）
- 追加所見:
  - server-modernized 稼働中でも `/orca/chart/subjectives` が 500 を返すため、server 側の例外ログ/実装確認が必要
- 証跡:
  - RUN_ID: 20260204T125507Z-soap-persistence-modernized
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/qa-soap-persistence.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/screenshots/01-soap-saved.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/screenshots/02-soap-history.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/network/soap-requests.json`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/network/soap-responses.json`

#### 7.2.39 実施ログ（2026-02-04）

- 修正対象: `/orca/chart/subjectives` 500 の原因切り分け（server-modernized）
- 主要導線:
  - `curl` で Vite dev server (`localhost:5174`) に POST → 500 を確認
  - `curl` で server-modernized (`localhost:9080`) 直叩き → 応答タイムアウト
  - server-modernized の `server.log` を grep（subjective/Exception/ERROR）
- 結果:
  - Vite dev server では 500（`Content-Type: text/plain`、本文なし）
  - server-modernized 直叩きは応答なし（3s タイムアウト）
  - server log に subjectives 由来の例外は記録されず
- 追加所見:
  - 500 はアプリ例外ではなく、proxy 側の upstream 応答待ち（または接続エラー）由来の可能性が高い
  - `/orca/chart/subjectives` はサーバー側で 4xx/200 を返す実装のため、500 は到達以前の障害を疑う
- 証跡:
  - RUN_ID: 20260204T130650Z-soap-subjectives-500
  - `OpenDolphin_WebClient/artifacts/verification/20260204T130650Z-soap-subjectives-500/soap-subjectives-500/curl-5174-subjectives-500.txt`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T130650Z-soap-subjectives-500/soap-subjectives-500/curl-9080-dolphin-timeout.txt`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T130650Z-soap-subjectives-500/soap-subjectives-500/server-log-grep.txt`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T130650Z-soap-subjectives-500/soap-subjectives-500/docker-health.json`

#### 7.2.40 実施ログ（2026-02-04）

- 修正対象: server-modernized listener 復旧（8080/9080）
- 主要導線:
  - コンテナ再起動（`opendolphin-server-modernized-dev`）
  - host 9080 / container 8080 に GET を実施
- 結果:
  - host 9080 / container 8080 ともに 401 応答（listener 復旧を確認）
  - 以前の host 9080 タイムアウトは解消
- 証跡:
  - RUN_ID: 20260204T133200Z-listener-check
  - `OpenDolphin_WebClient/artifacts/verification/20260204T133200Z-listener-check/listener-check/host-9080-dolphin.txt`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T133200Z-listener-check/listener-check/container-8080-dolphin.txt`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T133200Z-listener-check/listener-check/docker-health.json`

#### 7.2.41 実施ログ（2026-02-04）

- 修正対象: SOAP 保存の再検証（listener 復旧後）
- 主要導線:
  - `X-Facility-Id` 付与 (`VITE_ENABLE_FACILITY_HEADER=1`) で web-client を再起動
  - `/patient` に最小患者 `TEST-0001` を登録
  - SOAP 保存 → `/orca/chart/subjectives` へ POST
- 結果:
  - `/orca/chart/subjectives` は 500（`Could not commit transaction`）
  - server.log に FK 制約違反を記録:
    - `d_document.karte_id` が `d_karte` に存在しない (`fk6s9ifrm58t6jr9qamv7ey83lm`)
  - SOAP server 永続化は未達（DB制約でロールバック）
- 追加所見:
  - 患者登録後もカルテ（`d_karte`）が存在しない状態で文書挿入が発生している可能性
  - 対応案:
    - `getKarte` が空配列の場合はカルテ生成/永続化を行う
    - または SOAP 保存前にカルテ作成（API or service）を明示
- 証跡:
  - RUN_ID: 20260204T133701Z-soap-persistence-modernized
  - `OpenDolphin_WebClient/artifacts/verification/20260204T133701Z-soap-persistence-modernized/soap-persistence/qa-soap-persistence.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T133701Z-soap-persistence-modernized/soap-persistence/network/soap-responses.json`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T133701Z-soap-persistence-modernized/soap-persistence/server-log-subjectives.txt`

#### 7.2.42 実施ログ（2026-02-05）

- 修正対象: `/api/chart-events` 500 の経路特定と恒久対応案整理
- 主要導線:
  - 既存 RUN（`20260204T154158Z-update-depth-fix5`）の console log を抽出
  - MSW 設定（`onUnhandledRequest: 'bypass'`）と handler 定義を確認
  - Vite proxy で `/api` が `server-modernized` に到達することを確認
- 結果:
  - `/api/chart-events` が 500 を返し、`[chart-events] stream error` が発生（console 抽出ログに記録）
  - MSW には `/api/chart-events` handler がなく、未ハンドルのため実サーバへ透過
  - `/api/chart-events` は `server-modernized` の `ChartEventStreamResource` に到達する経路であり、ORCA_MODE に依存しない
  - 同 RUN で `/api/admin/config` `/api/orca/queue` `/api01rv2/pusheventgetv2` も 500 が並行しており、server-modernized 側の応答異常が疑われる
- 責務切り分け:
  - 500 応答は server-modernized 側の責務（SSE/認証/依存先/例外処理）
  - web-client は現状 5xx を受けて retry + console warn を継続するため、恒久的には抑止/停止ロジックの追加が望ましい
- 恒久対応案（整理）:
  - server-modernized: 未認証/依存未準備時は 401/403/503 を明示返却し、500 を回避（例外の握り潰し防止 + ログ出力）
  - server-modernized: SSE 用依存（DB/ChartEventHistory）や listener の健全性を起動時に検証し、失敗時は `/chart-events` を明示的に無効化
  - web-client: 5xx が連続する場合は「ストリーム未提供」として停止（404 と同様の `streamUnavailable` 扱い）+ exponential backoff で再試行を抑制
  - web-client: dev での 500 連発を避けるため `VITE_DISABLE_CHART_EVENT_STREAM=1` または MSW stub を用意
- 証跡:
  - RUN_ID: 20260204T235000Z-chart-events-500
  - `OpenDolphin_WebClient/artifacts/verification/20260204T235000Z-chart-events-500/chart-events-500.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T235000Z-chart-events-500/chart-events-500-console-sample.json`

#### 7.2.43 実施ログ（2026-02-05）

- 修正対象: chart-events 500 抑止（MSW handler 追加）
- 主要導線:
  - `web-client/src/mocks/handlers/chartEvents.ts` を追加し `/api/chart-events` を mock SSE で返却
  - `pnpm vitest run src/mocks/handlers/chartEvents.test.ts` で 200 + text/event-stream を確認
- 結果:
  - MSW 有効時は `/api/chart-events` を 200 (text/event-stream) で返却し、server-modernized 500 を抑止
  - chart-events handler を `handlers/index.ts` に組み込み済み
- 証跡:
  - RUN_ID: 20260204T235603Z-chart-events-msw
  - `OpenDolphin_WebClient/artifacts/verification/20260204T235603Z-chart-events-msw/qa-chart-events-msw.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T235603Z-chart-events-msw/chart-events-msw-test.log`

#### 7.2.44 実施ログ（2026-02-05）

- 修正対象: server-modernized の `/chart-events` 500 抑止（例外捕捉 → 503 返却）
- 主要導線:
  - `ChartEventStreamResource.subscribe` で例外捕捉し `service_unavailable` を返すよう修正
  - `ChartEventStreamResourceTest` で `ChartEventSseSupport.register` 例外時の 503 を確認
- 結果:
  - 例外発生時に 503 へ変換され、500 を抑止できることをテストで確認
- 証跡:
  - RUN_ID: 20260205T055237Z-chart-events-server
  - `OpenDolphin_WebClient/artifacts/verification/20260205T055237Z-chart-events-server/qa-chart-events-server.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260205T055237Z-chart-events-server/open.dolphin.rest.ChartEventStreamResourceTest.txt`
  - `OpenDolphin_WebClient/artifacts/verification/20260205T055237Z-chart-events-server/TEST-open.dolphin.rest.ChartEventStreamResourceTest.xml`

#### 7.2.45 実施ログ（2026-02-05）

- 修正対象: 文書テンプレ保存（`/odletter/letter`）UI 実測
- 主要導線:
  - Charts → 文書作成 → 紹介状（標準）を入力し保存
  - 施設ID `1.3.6.1.4.1.9414.72.103` / user `doctor1` / patientId `00005` / karteId `9079`
- 結果:
  - `PUT /odletter/letter` が 500（`internal_server_error`）
  - message: `Session layer failure in open.dolphin.rest.LetterResource...#putLetter`
  - `/odletter/list/9079` は 200 だが `list=null`
  - 保存失敗のため edit/delete/print は未実施（ブロッカー）
- 証跡:
  - RUN_ID: 20260205T134000Z-odletter
  - traceId: b35d3d14-7a39-4a7b-b44a-38d1ab730795
  - `OpenDolphin_WebClient/artifacts/verification/20260205T134000Z-odletter/odletter-save-500.md`

#### 7.2.40 実施ログ（2026-02-04）

- 修正対象: Patients 画面（検索→詳細→編集→保存→再表示）
- 主要導線: Playwright `tests/e2e/outpatient-patients-edit.msw.spec.ts`（MSW + fetch override）
- 結果:
  - 検索条件（キーワード/診療科/担当医/保険）を入力して検索更新、入力値保持を確認
  - 000001 を選択し memo を更新、保存トースト表示
  - 一覧再取得後も memo 更新が保持されることを確認
  - 別患者選択 → 再選択でも memo 更新が保持されることを確認
- 証跡:
  - RUN_ID: 20260204T132654Z-patients-edit
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/patients-edit/qa-patients-edit.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/patients-edit/patients-edit-input.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/patients-edit/patients-edit-saved.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/patients-edit/patients-edit-reopen.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/patients-edit/patients-edit-save-payload.json`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/har/`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T132654Z-patients-edit/videos/`

#### 7.2.36 実施ログ（2026-02-04）

- 修正対象: オーダー画面（薬剤/処置マスタ）の検索/入力再実証（MSW ハンドラ追加後）
- 主要導線:
  - Playwright: `tests/charts/e2e-order-master-search.spec.ts`
  - Charts 画面（`patientId=000001`）で処方編集 → 薬剤マスタ検索 → 選択 → 入力反映
  - オーダー編集 → 処置マスタ検索（材料）→ 選択 → 入力反映
- 結果:
  - 薬剤マスタ（`A100 アムロジピン`）の検索/選択/入力反映を確認（OK）
  - 処置マスタ（`M001 処置材料A`）の検索/選択/入力反映を確認（OK）
- 証跡:
  - `OpenDolphin_WebClient/artifacts/verification/20260204T173600Z-order-master/qa-order-master-search.md`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T173600Z-order-master/order-master-medication.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T173600Z-order-master/order-master-procedure.png`
  - `OpenDolphin_WebClient/artifacts/verification/20260204T173600Z-order-master/har/`

### 7.3 結果整理

- 結果の集計:
  - ログイン画面までの遷移は確認済み（施設選択→`/f/{facilityId}/login`）。
  - Console に `form field element should have an id or name attribute` が3件発生。
  - Network は静的アセット中心（API呼出は未確認）。
- 結果の集計（追記）:
  - 認証情報でログイン成功、Reception/Charts/Patients を表示確認。
  - Administration は role 不足で無効化（想定どおり）。
  - Charts で `statusText.toLowerCase is not a function` のエラー文言が表示。
  - `/openDolphin/resources/api/orca21/medicalmodv2/outpatient` の 404 を確認。
  - OrcaSummary で React key 重複警告、フォーム要素の id/name 未付与が増加。
- 結果の集計（追記2）:
  - system_admin 相当でログイン後、Administration リンクは有効化され遷移可能。
  - `/administration` に遷移しても Charts 画面が描画される（管理画面の実体が未表示）。
  - `/api/admin/config` と `/api/admin/delivery` が 404。
- 結果の集計（追記3）:
  - `/administration` で管理画面コンテンツが描画されることを確認（前回の Charts 描画は解消）。
  - OrcaSummary の React key 重複警告と `statusText.toLowerCase` 例外は未再現。
  - フォーム要素の id/name 未付与警告は引き続き発生（count 2/11）。
  - `/api/admin/config`・`/api/orca/queue`・`/orca/claim/outpatient`・`/orca21/medicalmodv2/outpatient` の 404 が継続。
- 結果の集計（追記4）:
  - Outlet key 付与後、Administration で Charts 残留が再現せず（解消を確認）。
  - フォーム要素の id/name 未付与警告（count 2）は継続。
  - 管理系/ORCA 系 404 は継続。
- 結果の集計（追記5）:
  - `/orca/claim/outpatient` の mock フォールバックは呼び出しまで到達するが `/orca/claim/outpatient/mock` が 404。
  - 404 解消は未達（mock 側の受け口が不足）。
- 結果の集計（追記6）:
  - id/name 警告は Administration/Charts では解消を確認、Patients で count 24 が残存。
  - Patients で 500 エラーのリソース失敗が 1 件発生。
- 結果の集計（追記7）:
  - `/api/api01rv2/system01dailyv2` は HTTP 200 / Api_Result=00 を確認。
  - Reception 受付送信は 401 Authentication required で失敗し、一覧反映は未達。
- 結果の集計（追記8）:
  - ORCA_BASIC_USER/PASSWORD を設定して再試行しても Reception 受付送信は 401 のまま。
  - 既存患者受付→一覧反映は未達。
- 結果の集計（追記9）:
  - setup-modernized-env.sh 修正後も Reception 受付送信は 401 のまま。
  - 既存患者受付→一覧反映は未達。
- 結果の集計（追記10）:
  - acceptmodv2 認証修正後も Reception 受付送信は 401 のまま。
  - 既存患者受付→一覧反映は未達。
- 結果の集計（追記11）:
  - setup-modernized-env.sh の認証フォールバック修正後も Reception 受付送信は 401 のまま。
  - 既存患者受付→一覧反映は未達。
- 結果の集計（追記7）:
  - `/orca/claim/outpatient/mock` が 200 で応答し、フォールバック先の 404 は解消。
- 結果の集計（追記8）:
  - Patients の id/name 警告は未再現（解消を確認）。
- 結果の集計（追記9）:
  - Patients の 500 リソースエラーも未再現。
- 結果の集計（追記10）:
  - Reception で resolveMasterSource=server に切替し再取得したが missingMaster=true が継続。
  - 監査サマリに `APPOINTMENT_OUTPATIENT_FETCH(error)` を表示。
  - 受付一覧/予約/会計リストは 0件のまま（WEBORCA 実データ反映は確認できず）。
  - 保存ビューは作成できるが、選択/適用は再遷移で解除（一覧データ 0件）。
- 結果の集計（追記11）:
  - Reception の id/name 警告は残存（count 22）。
- 結果の集計（追記12）:
  - Reception の mock 追加後も `/orca/appointments/list/mock` `/orca/visits/list/mock` が `ERR_CONNECTION_REFUSED`。
  - missingMaster=true が継続し、一覧データ反映は未確認。
- 結果の集計（追記13）:
  - MSW 無効時の mock 候補除外修正後も `/orca/appointments/list` `/orca/visits/list` は `ERR_ABORTED` のまま。
  - missingMaster=true が継続し、一覧データ反映は未確認。
- 結果の集計（追記14）:
  - AbortSignal 除外修正後も `/orca/appointments/list` `/orca/visits/list` は `ERR_ABORTED` のまま。
  - missingMaster=true が継続し、一覧データ反映は未確認。
- 結果の集計（追記15）:
  - AbortError 再試行追加後も `/orca/appointments/list` `/orca/visits/list` は `ERR_ABORTED` のまま。
  - abortRetryAttempted/abortRetryReason は UI/Console で確認できず。
- 結果の集計（追記16）:
  - AbortError 再試行/メタ伝播強化後も `/orca/appointments/list` `/orca/visits/list` は `ERR_ABORTED` のまま。
  - abortRetryAttempted/abortRetryReason/abortSignalAborted は UI/Console で確認できず。
- 結果の集計（追記17）:
  - /orca rewrite 修正後も `/orca/appointments/list` `/orca/visits/list` は `ERR_ABORTED` のまま。
  - missingMaster=true が継続し、一覧データ反映は未確認。
- 結果の集計（追記18）:
  - Trial ORCA 適用後の既存患者受付は、患者検索結果が 0 件のため未達。
  - `/orca/appointments/list` `/orca/visits/list` は pending のまま。
- 結果の集計（追記19）:
  - ORCA トライアル接続後も患者検索結果が 0 件で、受付テストが未達。
  - `/orca/appointments/list` `/orca/visits/list` は pending のまま。
- 結果の集計（追記20）:
  - MSW 有効/無効の E2E で console error / warning / 404 が 0 を確認。
  - `/orca/appointments/list` `/orca/visits/list` `/orca21/medicalmodv2/outpatient` が 200 で応答。
- 結果の集計（追記21）:
  - server-modernized 直の `/orca/appointments/list` `/orca/visits/list` が 200 を確認（header auth 付与）。
- 結果の集計（追記22）:
  - `/api/orca/queue` は認証付きで mock/live/retry/discard を 200 で確認（RUN_ID=20260203T232243Z-orca-api-auth）。
  - `/api01rv2/pusheventgetv2` は ORCA 設定時に live 200 / mock 200 を確認（同 RUN_ID）。
  - `/orca/disease/import/00001` は 404 patient_not_found（Api_Result=10）。
- 結果の集計（追記23）:
  - ORCA 未設定時は `/api01rv2/pusheventgetv2` が 503、mock header で 200 stub を確認（RUN_ID=20260203T232322Z-orca-api-no-orca-auth）。
  - `/orca/disease/import/00001` は設定有無とも 404 patient_not_found（Api_Result=10）。
- 結果の集計（追記24）:
  - /api01rv2/pusheventgetv2 の 503/stub 再現を再確認（RUN_ID=20260203T232747Z-pushevent-no-orca-recheck）。
- 重要指摘の分類:
  - P1: 認証情報未共有により主要導線の実検証がブロック。
  - P2: フォーム要素に id/name 未付与（アクセシビリティ/自動入力影響の可能性）。
- 重要指摘の分類（追記）:
  - P1: Charts で `/orca21/medicalmodv2/outpatient` が 404（医療記録取得が失敗）。
  - P1: エラー処理で `statusText.toLowerCase` 例外が表示（通信失敗時のハンドリング不備）。
  - P2: OrcaSummary の React key 重複警告（描画の重複/欠落リスク）。
  - P2: フォーム要素の id/name 未付与（アクセシビリティ/自動入力影響の可能性）。
- 重要指摘の分類（追記2）:
  - P1: Administration 画面が Charts を描画（ルーティング/権限差分の誤配線の疑い）。
  - P1: `/api/admin/config` と `/api/admin/delivery` が 404（管理系 API ルート未接続）。
- 重要指摘の分類（追記3）:
  - P1: `/api/admin/config`・`/api/orca/queue`・`/orca/claim/outpatient`・`/orca21/medicalmodv2/outpatient` の 404 が継続。
  - P2: フォーム要素の id/name 未付与（アクセシビリティ/自動入力影響の可能性）。
- 重要指摘の分類（追記4）:
  - P2: フォーム要素の id/name 未付与（アクセシビリティ/自動入力影響の可能性）。
- 重要指摘の分類（追記5）:
  - P1: `/orca/claim/outpatient/mock` が 404（mock フォールバック先が未提供）。
- 重要指摘の分類（追記6）:
  - P2: Patients で id/name 未付与警告が残存（count 24）。
- 重要指摘の分類（追記7）:
  - P1: `/orca/claim/outpatient` は引き続き 404（mock へのフォールバックで暫定回避）。
- 重要指摘の分類（追記8）:
  - P2: Patients の id/name 警告は解消。
- 重要指摘の分類（追記9）:
  - P1: Reception で `/orca/visits/list`・`/orca/appointments/list`・`/orca/claim/outpatient` が `net::ERR_ABORTED`（WEBORCA 実データ反映が確認できず）。
  - P2: Reception のフォーム要素で id/name 未付与警告が継続（count 22）。
- 重要指摘の分類（追記10）:
  - P1: `/orca/appointments/list/mock` と `/orca/visits/list/mock` が `ERR_CONNECTION_REFUSED`（mock 追加後も到達不可）。
- 重要指摘の分類（追記11）:
  - P1: `/orca/appointments/list` `/orca/visits/list` が `ERR_ABORTED` のまま（MSW 無効時の mock 除外修正の効果未確認）。
- 重要指摘の分類（追記12）:
  - P1: AbortSignal 除外修正後も `/orca/appointments/list` `/orca/visits/list` が `ERR_ABORTED` のまま。
- 重要指摘の分類（追記13）:
  - P1: AbortError 再試行追加後も `/orca/appointments/list` `/orca/visits/list` が `ERR_ABORTED` のまま。
- 重要指摘の分類（追記14）:
  - P1: AbortError 再試行/メタ伝播強化後も `/orca/appointments/list` `/orca/visits/list` が `ERR_ABORTED` のまま。
- 重要指摘の分類（追記15）:
  - P1: /orca rewrite 修正後も `/orca/appointments/list` `/orca/visits/list` が `ERR_ABORTED` のまま。
- 重要指摘の分類（追記16）:
  - P1: Trial ORCA 適用後も既存患者が取得できず、受付操作が未達。
- 重要指摘の分類（追記17）:
  - P1: ORCA トライアル接続後も既存患者が取得できず、受付テストが未達。
- 重要指摘の分類（追記18）:
  - P2: audit/ChartEventStream の console warning は MSW on/off の E2E で解消を確認。
- 対応要否の判定:
  - 認証情報共有後に再実施（Login→Reception/Charts/Patients/Administration）。
  - フォーム要素の id/name 付与は修正要検討。
- 対応要否の判定（追記）:
  - `/orca21/medicalmodv2/outpatient` の 404 は server-modernized の RESTEasy 登録/プロキシ設定を確認（P1）。
  - `statusText.toLowerCase` 例外は fetch error の型/undefined ガードを追加（P1）。
  - OrcaSummary の key 重複は key 生成規則を再点検（P2）。
- 対応要否の判定（追記2）:
  - Administration ルーティングのコンテンツ切替/権限分岐を確認（P1）。
  - `/api/admin/config` と `/api/admin/delivery` の API 配線/プロキシを確認（P1）。
- 対応要否の判定（追記3）:
  - `/api/admin/config`・`/api/orca/queue`・`/orca/claim/outpatient`・`/orca21/medicalmodv2/outpatient` のルート/プロキシ設定を確認（P1）。
  - フォーム要素の id/name 未付与は継続対応（P2）。
- 対応要否の判定（追記4）:
  - Outlet key 修正は反映済み。管理系/ORCA 系 404 とフォーム要素警告の解消を継続確認。
- 対応要否の判定（追記5）:
  - `/orca/claim/outpatient/mock` の受け口（MSW/fixture/プロキシ）を用意し、フォールバック成功を再検証。
- 対応要否の判定（追記6）:
  - Patients の id/name 未付与箇所を特定し修正（P2）。
- 対応要否の判定（追記7）:
  - `/orca/claim/outpatient` 本体の 404 は引き続き解消検討（P1）。
- 対応要否の判定（追記8）:
  - Patients の id/name 警告は解消済みとして扱う。
- 対応要否の判定（追記9）:
  - Reception の ORCA 系取得失敗（`net::ERR_ABORTED`）の原因を確認し、WEBORCA 実データ反映を再検証。
  - Reception の id/name 警告（count 22）を特定して修正。
- 対応要否の判定（追記10）:
  - mock エンドポイントのプロキシ/モックサーバー経路を確認し、`/orca/appointments/list/mock` `/orca/visits/list/mock` の到達性を回復。
- 対応要否の判定（追記11）:
  - MSW 無効時の mock 除外修正後も `ERR_ABORTED` が継続するため、実環境の ORCA 経路/Proxy/サーバー状態を確認。
- 対応要否の判定（追記12）:
  - AbortSignal 除外修正後も `ERR_ABORTED` が継続するため、AbortSignal 関連の送信経路/HTTP 実装差分を再確認。
- 対応要否の判定（追記13）:
  - AbortError 再試行のログ出力を確認（abortRetryAttempted/abortRetryReason の可視化）。
  - `ERR_ABORTED` の原因（HTTP クライアント/Proxy）を再調査。
- 対応要否の判定（追記14）:
  - abortRetryAttempted/abortRetryReason/abortSignalAborted の UI 表示箇所を確認し、監査ログに出るか再点検。
  - `Deprecated feature used` の発生箇所を特定。
- 対応要否の判定（追記15）:
  - /orca rewrite 修正後も ERR_ABORTED が継続するため、Vite proxy/rewrite の実適用を確認。
- 対応要否の判定（追記16）:
  - Trial ORCA の接続情報が反映されているか（環境変数/設定/再起動）を確認し、患者データ取得後に再検証。
- 対応要否の判定（追記17）:
  - ORCA トライアル接続の反映状況（接続先/認証/起動状態）を確認し、患者データ取得後に再検証。
- 対応要否の判定（追記18）:
  - MSW 有効/無効の E2E は console error/404/5xx 0 を確認済み。
  - ORCA 実接続（appointments/visits）は 200 確認済み。WEBORCA 実データの整合（8.1.4）は別途継続。

### 7.3.1 運用連携可否（ORCA/modernized）

- 判定: 受付送信（acceptmodv2）は成功証跡あり。ただし運用連携の最終判定は未確定。
- 理由:
  - web-client からの acceptmodv2 は Api_Result=00 を確認済み（7.2.33）。
  - しかし ORCA 実データの反映・Reception の整合（患者/受付/会計/予約）が未確認（8.1.4）。
  - ORCA 側の反映確認（画面/API）と突合証跡が不足。
- 参考証跡:
  - acceptmodv2 成功: RUN_ID `20260204T055600Z-acceptmodv2-webclient`
    - `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/accept-summary.md`
  - ORCA API 到達: `/orca/appointments/list` `/orca/visits/list` が 200（7.2.32）。
  - ORCA 実データ 0 件: `artifacts/verification/20260204T083500Z/*`（Reception UI 「該当なし」）。

運用連携の残項目:
- ORCA 実データ（patients/appointments/visits/queue）が UI に反映されることの突合証跡。
- 受付送信後の会計/予約/例外状態の整合証跡（8.1.4）。
- 会計送信結果の ORCA 側確認（acceptlstv2 class=01/02 + server-modernized ログ）。
- ORCA 側での受付反映確認（画面 or API ログ）の保存。

本番想定検証（Trial 不可時の計画/前提）:
- 前提:
  - ORCA 本番相当の接続先と認証情報（Basic + Facility）が確定していること。
  - 受入対象の Dr/Patient/予約/会計の seed が存在すること。
  - `ORCA_API_*` / `ORCA_MODE=weborca` / `ORCA_API_PATH_PREFIX` が正しく設定されていること。
- 最小手順:
  1. `system01dailyv2` で疎通確認（HTTP 200 / Api_Result=00）。
  2. `acceptmodv2` を direct POST で確認（HTTP 200 / Api_Result=00）。
  3. Web クライアントで Reception 受付送信を実施。
  4. Reception UI と ORCA 応答の突合（患者/受付/会計/予約）。
- 証跡:
  - RUN_ID 付きログ、Reception 送信前後スクショ、`acceptmodv2`/`appointments/visits` のレスポンス。
  - ORCA 側で受付反映を確認した記録（画面 or API のログ）。

### 7.4 レビュー / 承認

- レビュー観点:
  - エラー文言の妥当性（再現性/解消の手がかり）
  - 監査ログの取得項目/保存期間
  - 監視・アラート設定（閾値/通知先/一次対応フロー）
- 承認条件:
- 承認者:

## 8. 成果物定義（チェックリスト / エビデンス）

### 8.1 チェックリスト

#### 8.1.0 記入方針 / 記入案

- Yes: 証跡（RUN_ID + パス）を備考に記載し、確認範囲（画面/API/ロール）を明示する。
- No: 再現ログ/スクショを備考に記載し、再現条件と暫定対処を併記する。
- 要確認: 未実施/環境不足/権限不足の理由を備考に記載し、次アクションを明示する。
- MSW on/off の E2E は「画面表示 + console error/404/5xx=0」の範囲のみを担保する（データ整合/業務状態の一致には使わない）。
- API 到達確認（200 応答）のみの証跡は「実データ整合」には使わない（UI 表示 or ORCA 実データとの突合を別途要求）。

記入案（2026-02-04 時点）:
- 8.1.1/8.1.2/8.1.3 は体系的確認が未実施のため、原則「要確認」で記入。
- MSW on/off E2E の証跡（RUN_ID: 20260203T215120Z-msw-on-warnfix / 20260203T215654Z-msw-off-warnfix2）は「画面表示 + console error/404/5xx=0」の備考に引用可能。
- CLAIM 廃止検証の証跡（RUN_ID: 20260203T214629Z）は「/orca/claim/outpatient 呼び出しゼロ」の補助根拠として備考に引用可能。
- 8.1.4 は実データ整合の証跡未取得のため、全行「要確認」で記入。

#### 8.1.0.1 残項目ゼロ宣言に必要な不足分（2026-02-04 時点）

- 8.1.1/8.1.2/8.1.3 のチェックリストを実施し、Yes/No/要確認を確定（権限差分/バリデーション/エラー文言/外部連携失敗時挙動/監査ログ/アラート等）。
- 8.1.4 の WebORCA 実データ整合（患者/受付/会計/予約）を UI 表示と ORCA 応答の突合で証跡化。
- 既存証跡の紐付け（MSW on/off E2E、CLAIM 廃止検証、ORCA API 200）を備考欄へ反映し、残件が 0 になった時点で完了宣言。

#### 8.1.0.2 8.1.1〜8.1.3 実行計画（最小手順）

- 対象画面の固定: Login/Reception/Charts/Patients/Administration/Print の6画面を対象にする（Debug は除外）。
- ロール差分の最小セット: `admin` と `system_admin` の2ロールで実施（権限差分の有無だけ確認）。
- 手順（画面/遷移/エラー文言）:
  - 各画面で「初回表示 → reload → back/forward」を1回実施し、表示崩れやエラー文言の有無を記録。
  - エラー文言はスクショ保存し、再現手順を備考に記載。
- 手順（外部連携失敗）:
  - ORCA未設定で `/api01rv2/pusheventgetv2` が 503 となるケースを利用し、UI/ログの失敗時表示を記録。
- 手順（監査/アラート/バッチ/競合）:
  - 本項は設計/運用資料の確認が必要なため、資料の所在を確定しチェックリストに反映。
- 証跡命名: `artifacts/webclient/checklist-minimal/<RUN_ID>/` へ保存し、RUN_ID を備考に記載。

#### 8.1.1 不足しやすい観点（画面/サーバー）

| 観点 | チェック項目 | Yes | No | 要確認 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 画面 | 状態別表示（空/読み込み中/エラー/権限なし）が定義されている |  |  | 要確認 | 未実施（定義・確認が必要） |
| 画面 | 権限差分（閲覧/編集/管理者）の表示・操作が整理されている |  |  | 要確認 | 未実施（ロール差分の確認が必要） |
| 画面 | エラー文言が具体的で再現/解消の手がかりを示す |  |  | 要確認 | 未実施（文言レビュー未着手） |
| 画面 | 遷移/リロードで状態が破綻しない |  |  | 要確認 | 最小検証: Reception/Charts の reload/back/forward を確認（RUN_ID: 20260204T001738Z）。全画面は未実施 |
| 画面 | 検索/一覧の組合せ（並び替え/絞り込み/ページング）が確認対象 |  |  | 要確認 | 未実施（検索/並び替えの実測が必要） |
| 画面 | アクセシビリティ（キーボード/フォーカス/コントラスト）が確認対象 |  |  | 要確認 | 未実施（A11y 確認が必要） |
| 画面 | ファイルアップロードの失敗系（容量/拡張子/途中失敗）が確認対象 |  |  | 要確認 | 未実施（失敗系の確認が必要） |
| 画面 | 複数デバイス対応（レスポンシブ/回転/DPI差分）が確認対象 |  |  | 要確認 | 未実施（デバイス差分の確認が必要） |
| 画面 | 表示の時差（非同期更新/ポーリング/キャッシュ反映遅延）が確認対象 |  |  | 要確認 | 未実施（反映遅延の確認が必要） |
| サーバー | APIエラー分類（4xx/5xx/タイムアウト）とリトライ方針が定義されている |  |  | 要確認 | 未実施（分類/方針の定義確認が必要） |
| サーバー | 認可/スコープの差分（ロール別制限）が確認対象 |  |  | 要確認 | 未実施（権限制限の整理が必要） |
| サーバー | 競合/排他（同時更新/重複登録）のシナリオが確認対象 |  |  | 要確認 | 未実施（競合シナリオの洗い出しが必要） |
| サーバー | 外部連携失敗時の挙動（再送/保留/通知）が確認対象 |  |  | 要確認 | 未実施（失敗系の挙動確認が必要） |
| サーバー | 通知/メール（送信失敗/再送/配信停止）が確認対象 |  |  | 要確認 | 未実施（通知系の確認が必要） |
| サーバー | バッチ再実行条件と影響範囲が明確 |  |  | 要確認 | 未実施（条件/影響の整理が必要） |
| サーバー | 監査ログの取得項目・保存期間が明確 |  |  | 要確認 | 未実施（監査ログの定義確認が必要） |
| サーバー | 監視・アラートの閾値と一次対応フローが明確 |  |  | 要確認 | 未実施（運用設計の確認が必要） |
| サーバー | 互換性（旧データ/旧APIの取り扱い、移行差分）が確認対象 |  |  | 要確認 | 未実施（互換性の整理が必要） |

#### 8.1.2 要確認事項（短文チェック）

| 観点 | チェック項目 | Yes | No | 要確認 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 画面 | 入力バリデーション（必須/任意、境界値、文字種）が揃っている |  |  | 要確認 | 未実施（バリデーションの棚卸が必要） |
| 画面 | 画面遷移（ブラウザバック/リロード）で状態が破綻しない |  |  | 要確認 | 最小検証: Reception/Charts の reload/back/forward を確認（RUN_ID: 20260204T001738Z）。全画面は未実施 |
| 画面 | ロール/権限別の表示・操作差分が確認できる |  |  | 要確認 | 未実施（ロール差分の実測が必要） |
| 画面 | アクセシビリティ観点（キーボード/フォーカス/コントラスト）がある |  |  | 要確認 | 未実施（A11y 確認が必要） |
| 画面 | 複数デバイス対応（レスポンシブ/回転/DPI差分）が確認できる |  |  | 要確認 | 未実施（デバイス差分の確認が必要） |
| 画面 | 表示の時差（非同期更新/ポーリング/キャッシュ反映遅延）が把握できる |  |  | 要確認 | 未実施（反映遅延の確認が必要） |
| サーバー | 外部連携失敗時の挙動（再送/保留/通知）が確認されている |  |  | 要確認 | 未実施（失敗系の確認が必要） |
| サーバー | 通知/メール（送信失敗/再送/配信停止）が確認されている |  |  | 要確認 | 未実施（通知系の確認が必要） |
| サーバー | ログ/監査の取得項目・保存期間が明確 |  |  | 要確認 | 未実施（監査ログの定義確認が必要） |
| サーバー | 設定変更の反映タイミングとロールバック手順がある |  |  | 要確認 | 未実施（手順の整備が必要） |
| サーバー | 互換性（旧データ/旧APIの取り扱い、移行差分）が整理されている |  |  | 要確認 | 未実施（互換性の整理が必要） |

#### 8.1.3 リスクと対策（チェックリスト化）

| リスク | 対策 | Yes | No | 要確認 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 状態別表示の未確認 | 状態一覧を洗い出し必須確認に追加 |  |  | 要確認 | 未実施（状態一覧の作成が必要） |
| 権限差分の未確認 | ロール別チェックリストを作成 |  |  | 要確認 | 未実施（ロール別の観点整理が必要） |
| エラー文言の不備 | 文言レビューを作業に組み込む |  |  | 要確認 | 未実施（文言レビュー未着手） |
| 外部連携障害時の未確認 | 失敗時挙動を仕様化し確認 |  |  | 要確認 | 未実施（失敗系の確認が必要） |
| 同時更新の未確認 | 競合シナリオを追加 |  |  | 要確認 | 未実施（競合シナリオ未整備） |
| バッチ再実行の未確認 | 再実行手順とガードを明記 |  |  | 要確認 | 未実施（手順/ガード未整備） |
| 監査ログの未確認 | ログ項目一覧を別表で作成 |  |  | 要確認 | 未実施（ログ項目の一覧化が必要） |
| キャッシュ反映の未確認 | 反映タイミング確認を追加 |  |  | 要確認 | 未実施（反映タイミングの実測が必要） |
| 複数デバイス対応の未確認 | デバイス差分の確認項目を追加 |  |  | 要確認 | 未実施（デバイス差分の確認が必要） |
| 表示の時差の未確認 | 反映遅延の計測手順を追加 |  |  | 要確認 | 未実施（遅延の実測が必要） |
| 通知/メールの未確認 | 通知失敗/再送/停止の確認を追加 |  |  | 要確認 | 未実施（通知系の確認が必要） |
| 互換性の未確認 | 旧データ/旧APIの取り扱いを整理 |  |  | 要確認 | 未実施（互換性の整理が必要） |

#### 8.1.4 WEBORCA実データ反映（Reception評価チェックリスト）

| 観点 | チェック項目 | Yes | No | 要確認 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 患者 | ID/氏名/生年月日/性別/保険区分が ORCA 実データと一致する |  |  | 要確認 | ORCA 実データ 0 件のため未確認 |
| 受付 | 受付日時/区分/診療科/担当医が ORCA 実データと一致する |  |  | 要確認 | 同上 |
| 会計 | 送信状態/会計ステータス/エラー表示が ORCA 実データと整合する |  |  | 要確認 | 同上 |
| 予約 | 予約日時/予約枠/ステータスが ORCA 実データと一致する |  |  | 要確認 | 同上 |
| 例外 | 未送信/エラー/保留の表示が ORCA 実データと整合する |  |  | 要確認 | 例外状態の実データがないため未確認 |
| 反映 | データ更新後の反映タイミングが仕様どおり |  |  | 要確認 | 実データがないため反映タイミングは未計測 |

補足（実データ整合の証跡）:
- ORCA 実データ（appointments/visits）0 件を確認（2026-02-04）。Reception UI は「該当なし」表示で一致。
- 証跡:
  - `artifacts/verification/20260204T083500Z/orca-appointments-headers.txt`
  - `artifacts/verification/20260204T083500Z/orca-appointments-body.json`
  - `artifacts/verification/20260204T083500Z/orca-appointments-headers-today.txt`
  - `artifacts/verification/20260204T083500Z/orca-appointments-body-today.json`
  - `artifacts/verification/20260204T083500Z/orca-visits-headers-today.txt`
  - `artifacts/verification/20260204T083500Z/orca-visits-body-today.json`
  - `artifacts/verification/20260204T083500Z/reception-ui.png`
  - `artifacts/verification/20260204T083500Z/reception-ui.json`

##### 8.1.4 前提条件（未完検証のための具体条件）

- ORCA 実データ（受付済み/未受付）が存在していること。
- 受付送信に必要な ORCA 認証情報が有効であること（Basic + Facility ヘッダ）。
- Reception 画面で患者一覧が取得できること（`/orca/appointments/list` `/orca/visits/list` が 200）。
- WebORCA の接続先が確定していること（Trial/本番いずれか）。
- 施設ID/ユーザーIDが正しいこと（facility.json と一致）。

##### 8.1.4 必要なユーザー権限 / シードデータ / 環境変数

- ユーザー権限:
  - `admin`（Reception/Charts の通常操作）
  - `system_admin`（Administration で ORCA 設定確認が必要な場合）
- シードデータ（ORCA 側）:
  - 受付済み患者 1 名（当日分）
  - 未受付患者 1 名（当日分、予約枠あり）
  - 送信失敗/保留状態の患者 1 名（例外表示確認用）
- 環境変数/設定（server-modernized 側）:
  - `ORCA_API_HOST` / `ORCA_API_PORT` / `ORCA_API_SCHEME`
  - `ORCA_API_USER` / `ORCA_API_PASSWORD`
  - `ORCA_MODE=weborca`（WebORCA 利用時）
  - `ORCA_API_PATH_PREFIX`（必要なら `/api` を明示）
  - `LOGFILTER_HEADER_AUTH_ENABLED=false`（認証モーダル回避が必要な場合）
  - `VITE_ENABLE_FACILITY_HEADER=1` / `VITE_ENABLE_LEGACY_HEADER_AUTH=1`（必要時）

##### 8.1.4 再検証の最小データ条件（患者/受付/会計/予約）

- 患者: 当日受付済み 1 名（保険区分あり）＋当日未受付 1 名（予約枠あり）
- 受付: 当日分の受付データ 1 件（受付日時/診療科/担当医が明示）
- 会計: 送信済み 1 名＋送信失敗 or 保留 1 名（例外表示確認用）
- 予約: 当日予約枠 1 件（予約日時/枠/ステータスが参照可能）

##### 8.1.4 UI / Network / ORCA レスポンス突合チェック（最小）

- UI:
  - 患者ID/氏名/生年月日/性別/保険区分
  - 受付日時/区分/診療科/担当医
  - 会計ステータス（送信済み/失敗/保留）
  - 予約枠/予約ステータス
- Network:
  - `/orca/appointments/list` `/orca/visits/list` が 200
  - 必要に応じて `/api/orca/queue` が 200
- ORCAレスポンス:
  - appointments/visits の該当患者レコードが UI と一致
  - 会計/送信状態が UI と一致

##### 8.1.4 証跡フォーマット（最小）

- RUN_ID を必ず採番
- スクショ: Reception 一覧（患者/受付/会計/予約の可視範囲）
- ログ: ORCA レスポンス JSON（appointments/visits）+ Network 200 のヘッダ/要約

##### 8.1.4 WEBクライアント経由の実データ送信（最小手順）

1. Web クライアントで `admin` ロールのユーザーでログイン。
2. Reception 画面で対象患者を検索し、受付送信を実行。
3. 送信完了後、受付一覧に患者が反映されることを確認（受付日時/診療科/担当医）。
4. 会計ステータスが送信済み/保留など想定どおりであることを確認。
5. 予約枠/予約ステータスが UI に反映されていることを確認。
6. 必要に応じて `/api/orca/queue` を再取得し、送信キューの反映を確認。

##### 8.1.4 実データ送信の突合ポイント / 期待結果

- 患者: ORCA 実データの患者ID/氏名/生年月日/性別/保険区分と UI 表示が一致。
- 受付: 受付日時/区分/診療科/担当医が ORCA 実データと一致。
- 会計: 送信状態/会計ステータス/エラー表示が ORCA 実データと一致。
- 予約: 予約枠/予約ステータスが ORCA 実データと一致。
- 例外: 送信失敗/保留の状態が UI に表示され、ORCA 応答と整合。

##### 8.1.4 実データ送信の証跡フォーマット

- RUN_ID: `YYYYMMDDTHHMMSSZ-weborca-accept`
- スクショ:
  - Reception 一覧（送信前/送信後）
  - 受付送信結果のバナー/トースト（表示があれば）
- ログ:
  - Network: `acceptmodv2` / `appointments/list` / `visits/list` のレスポンス
  - ORCA レスポンス JSON（患者/受付/会計/予約）
  - `/api/orca/queue` 応答（必要時）
- ORCA 側確認:
  - ORCA 画面 or API で受付送信が反映されていることを確認（確認方法をメモ）

##### 8.1.4 ORCA会計送信の結果確認（ORCA側/ログ）

- 手順（最小）:
  - Reception で会計送信（再送/完了）操作を実行。
  - ORCA 受付一覧 API で会計待ち/会計済みの状態を確認（`/api01rv2/acceptlstv2?class=01` と `class=02`）。
  - server-modernized のログで `acceptlstv2`/会計送信に対応する `Api_Result` を確認。
- 判定基準:
  - UI の会計ステータスが ORCA 受付一覧（class=01/02）の状態と一致。
  - ORCA 応答が `Api_Result=00` を返す（成功）。
  - server-modernized ログにエラーが残らない（`Api_Result`/trace を記録）。
- 証跡フォーマット:
  - RUN_ID: `YYYYMMDDTHHMMSSZ-orca-accounting`
  - スクショ: Reception 一覧（会計待ち/会計済みの該当行）
  - ログ: `acceptlstv2` レスポンス JSON、Network 200 ヘッダ、server-modernized ログ抜粋
  - 保存先例: `artifacts/verification/<RUN_ID>/accounting-send/`
- 実測（2026-02-04）:
  - RUN_ID: `20260204T072850Z-orca-accounting`（WebORCA Trial）
  - class=01: `Api_Result=00`（患者ID `01415` の受付レコードあり）
  - class=02: `Api_Result=21`（会計済み一覧は空）
  - 証跡: `artifacts/verification/20260204T072850Z-orca-accounting/accounting-send/qa-orca-accounting.md`
- 実測（再確認 / 2026-02-04）:
  - RUN_ID: `20260204T074500Z-e2e-outpatient-flow` で通し検証を試行（受付送信エラー、ORCA送信 no-response）
  - 再確認 RUN_ID: `20260204T073630Z-orca-accounting`
  - class=01: `Api_Result=00`（患者ID `01415` の受付レコードあり）
  - class=02: `Api_Result=21`（会計済み一覧は空）
  - 証跡: `artifacts/verification/20260204T073630Z-orca-accounting/accounting-send/qa-orca-accounting.md`

##### 8.1.4 証跡整理（患者/受付/会計/予約）

| 観点 | 現状の証跡 | 判定 | 追加で必要な証跡 |
| --- | --- | --- | --- |
| 患者 | ORCA API 200（`artifacts/verification/20260204T082000Z/orca-appointments-body.json`, `orca-visits-body.json`）※接続確認のみ | 要確認 | Reception 画面の患者行スクショ + ORCA 応答 JSON の患者情報突合（患者ID/氏名/生年月日/性別/保険区分） |
| 受付 | ORCA API 200（同上）※受付情報の UI 表示突合は未実施 | 要確認 | Reception 画面の受付一覧スクショ + ORCA 応答 JSON の受付情報突合（受付日時/区分/診療科/担当医） |
| 会計 | acceptlstv2 class=01/02（20260204T072850Z） | 要確認（class=02 空） | Reception の会計ステータス表示スクショ + 会計送信後の class=02 応答 |
| 予約 | ORCA API 200（`orca-appointments-body.json`）※予約表示突合は未実施 | 要確認 | Reception の予約枠/ステータス表示スクショ + ORCA 応答突合 |
| 例外 | 証跡なし | 要確認 | 送信失敗/保留時の UI 表示スクショ + ORCA 応答のエラー/保留状態突合 |
| 反映 | 証跡なし | 要確認 | ORCA 側の更新→Reception 反映時刻のログ/スクショ（反映遅延の計測） |

##### 8.1.4-1 未完検証の追加実行計画（実データ整合）

目的: 患者/受付/会計/予約/例外/反映の各項目で UI 表示と ORCA 応答の整合証跡を取得する。

前提条件:
- ORCA 側に当日分の実データが存在（受付済み/未受付/例外の最低各1件）
- Reception 画面で一覧取得が可能（`/orca/appointments/list` `/orca/visits/list` が 200）
- 受付送信に必要な認証情報が有効（Basic + `X-Facility-Id`）
- 施設ID/ユーザーIDが正しいこと（facility.json と一致）

証跡フォーマット:
- RUN_ID: `YYYYMMDDTHHMMSSZ-orca-consistency`
- 保存先: `artifacts/verification/{RUN_ID}/`
- ファイル例: `reception-patient-01.png` / `reception-visit-01.png` / `reception-accounting-01.png` / `orca-appointments-body.json` / `orca-visits-body.json` / `orca-raw-headers.txt` / `qa-orca-consistency.md`

実行順序と担当:
| 順序 | 作業 | 実施可否 | 担当 | 前提/備考 |
| --- | --- | --- | --- | --- |
| 1 | ORCA 側のシードデータ準備（受付済/未受付/例外） | 要準備 | 家老 | ORCA 側の運用者/殿の協力が必要 |
| 2 | 認証情報/施設IDの再確認 | 要準備 | 家老 | 7.2.26-2 と共通 |
| 3 | Reception 一覧取得（患者/受付/予約/会計） | 実施可能 | 足軽8 | 1/2 完了後に実施 |
| 4 | ORCA 応答 JSON を取得（appointments/visits） | 実施可能 | 足軽8 | curl で保存 |
| 5 | UI と ORCA 応答の突合（患者/受付/予約） | 実施可能 | 足軽8 | `qa-orca-consistency.md` に差分なしを記録 |
| 6 | 会計/例外の該当 API を Network から特定し JSON 保存 | 実施可能 | 足軽8 | 必要なら DevTools の HAR も保存 |
| 7 | 反映タイミング計測（ORCA 更新→UI 反映） | 要準備 | 足軽8 | ORCA 側の更新操作が必要 |

##### 8.1.4-2 実行可否判定（2026-02-04）

- 判定: 不可
- ブロッカー:
  - ORCA 認証情報/施設IDが未共有（Basic + `X-Facility-Id`）。
  - Dev ORCA（100.102.17.40:8000）は到達不可（7.2.33）。
  - 現行シェル環境で `ORCA_*` / `VITE_*` が未設定（実行環境未構成）。
  - ORCA 実データの有無が未確認（`/orca/appointments/list` `/orca/visits/list` の実データ確認が必要）。
- 解決手順:
  1. ORCA 認証情報/施設IDを共有し、server-modernized へ `ORCA_API_*` を設定。
  2. VPN 接続/FW 許可/Dev ORCA 稼働を確認し、到達性を回復。
  3. ORCA 実データを確認（`/orca/appointments/list` `/orca/visits/list` が 200 かつ実データあり）。
  4. web-client を `VITE_DISABLE_MSW=1` で起動し、`/orca/appointments/list` `/orca/visits/list` が 200 であることを確認。
  5. Reception から送信/再送操作を実行し、RUN_ID/スクショ/Network/ORCA 応答（`/api/orca/queue` など）を保存。

##### 8.1.6 通し検証（受付→カルテ→オーダー→診察終了→会計送信）証跡テンプレ

目的: 受付〜会計送信までの一連フローの証跡と結果記録を統一する。

前提条件（最小）:
- ORCA 接続が可能（`/orca/appointments/list` `/orca/visits/list` が 200）。
- 受付対象の患者が存在し、カルテ作成が可能。
- オーダー可能なマスタ/診療行為が存在。
- 会計送信が実行可能な権限（admin/doctor など）を付与。

RUN_ID/保存先:
- RUN_ID: `YYYYMMDDTHHMMSSZ-e2e-outpatient-flow`
- 保存先: `artifacts/verification/{RUN_ID}/`
- 推奨構成: `screenshots/` `network/` `orca/` `qa-e2e-flow.md`

記録フォーマット（最小）:
- `qa-e2e-flow.md` に以下を記載
  - 日時（開始/終了）、環境（ORCA_MODE/ENV/Branch）、MSW、接続先、ユーザー/ロール、施設ID
  - 実行したステップと結果（OK/NG/保留）
  - 主要 API のステータス（appointments/visits/queue/必要な order/claim 系）

証跡テンプレ（ステップ別）:
| ステップ | 期待結果 | 証跡（スクショ/ログ） |
| --- | --- | --- |
| 受付（Reception） | 受付送信/一覧反映が成功 | `screenshots/reception-before.png` / `screenshots/reception-after.png` / `network/reception-requests.json` |
| カルテ（Charts） | 患者カルテが表示される | `screenshots/charts-open.png` |
| オーダー入力 | オーダーが保存される | `screenshots/order-entry.png` / `network/order-requests.json` |
| 診察終了 | ステータスが更新される | `screenshots/visit-finish.png` |
| 会計送信 | 送信結果が表示される | `screenshots/accounting-send.png` / `network/accounting-requests.json` / `orca/queue-response.json` |

##### 8.1.6-1 通し検証ブロッカー切り分け（2026-02-04 実測）

- 実測 RUN_ID: 20260204T064501Z（web-client 5173 → server-modernized → WebORCA trial）

主要症状:
- `/orca/appointments/list`: Api_Result=21（対象予約なし）
- `/orca/visits/list`: Api_Result=13（対象なし）
- `/orca/order/bundles` `/orca/disease/import`: 404 patient_not_found
- `/orca/appointments/mutation`: Api_Result=12「予約時間設定誤り」

原因切り分け:
- 実データ空: ORCA 側に当日分の appointment/visit が存在しない、または list リクエストの期間/時刻が対象外
- 患者未存在: ORCA には患者がいるが server-modernized のローカルDBに登録がなく、order/disease が 404
- 時刻エラー: appointments/mutation の時間が ORCA 予約枠/診療時間の設定に不一致（形式/時間帯/区分）

解消案:
1. ORCA 側で当日予約/来院データを作成（受付済/未受付 各1件）
2. `/orca/appointments/list` `/orca/visits/list` のリクエスト期間を当日に合わせる（Start/End）
3. dev では `OPENDOLPHIN_STUB_ENDPOINTS_MODE=allow` または `OPENDOLPHIN_STUB_ENDPOINTS_ALLOW=1` を指定し、`/orca12/patientmodv2/outpatient` を許可して ORCA 患者をローカルへ同期
4. 代替案: `/patient` でローカル患者作成（ORCA 患者ID一致が必要なため要検討）
5. ORCA の予約枠/診療時間設定に合わせて appointments/mutation の時間を指定
6. 予約作成が不要な場合は acceptmodv2 → visits/list 反映を前提に運用

##### 8.1.6-2 通し検証（MSW handlers 追加後）実測（2026-02-04）

- RUN_ID: 20260204T073114Z
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T073114Z/fullflow/`
- Base URL: http://localhost:5173（MSW 有効想定）

結果:
- Reception 受付送信: Api_Result=16（診療科・保険組合せで受付登録済みのためエラー）
- Reception 一覧: `appointments/list` Api_Result=21、`visits/list` Api_Result=13（一覧が空で患者行なし）
- Charts: 直接 patientId で遷移（一覧行は未生成）
- Order: `/orca/order/bundles` が 404 patient_not_found
- 診療終了: outcome=MISSING
- ORCA 送信: `/orca21/medicalmodv2/outpatient` は 200（Network で確認）

補足/最小修正案:
- `appointments/list` / `visits/list` の MSW 応答が空（dataSource=real）。MSW 介在を確認し、当日分のダミー行を返す handler を追加
- `/orca/order/bundles` の 404 は患者未存在のため。MSW で最小レスポンスを返すか、ローカル患者を作成して再実行
- ORCA 送信の待受が `/api21/medicalmodv2` になっているため、スクリプト側を `/orca21/medicalmodv2/outpatient` にも対応させる

##### 8.1.6-3 ブロッカー原因切り分け（Reception Api_Result=16 / appointments・visits 空 / patient_not_found）

- Api_Result=16（受付送信エラー）
  - ORCA 応答: 「診療科・保険組合せで受付登録済みです。二重登録疑い」
  - 原因: 同一患者/診療科/保険で当日分の受付が既に存在
  - 回避: 新規患者ID/別診療科/別保険の組合せで再送、または既存受付をキャンセル/診療終了してから再送

- appointments/visits が空（Api_Result=21/13）
  - 原因: ORCA 側に当日分の予約/来院データが存在しない、または list の期間/時刻が対象外
  - 回避: ORCA に当日予約/来院を作成し、list の期間（Start/End）を当日に合わせる

- `/orca/order/bundles` が patient_not_found
  - 原因: server-modernized のローカルDBに患者が存在しない
  - 回避: dev では `OPENDOLPHIN_STUB_ENDPOINTS_MODE=allow` または `OPENDOLPHIN_STUB_ENDPOINTS_ALLOW=1` で
    `/orca12/patientmodv2/outpatient` を許可し ORCA 患者をローカル同期、または `/patient` でローカル患者を作成（ORCA 患者IDと一致させる）

必要な前提/seed:
- ORCA 側に当日分の appointment/visit を 1件以上用意（受付済/未受付）
- 受付対象患者がローカルDBに存在（ORCA 患者IDと一致）
- 受付送信は未重複の患者/診療科/保険の組合せで実行

##### 8.1.6-4 受付送信エラー/ORCA送信 no-response 切り分け（2026-02-04）

- RUN_ID: 20260204T073855Z（MSW handlers 追加後の再実行）

受付送信エラーの原因:
- Api_Result=16（受付登録済み/二重登録疑い）
- 同一患者/診療科/保険で当日受付が既に存在
- 回避: 新規患者ID/別診療科/別保険で再送、または既存受付のキャンセル/診療終了後に再送

ORCA送信 no-response の原因:
- スクリプト待受を `/api21/medicalmodv2` のみから `/orca21/medicalmodv2/outpatient` に拡張済み
- それでも no-response → ORCA送信リクエスト自体が発火していない可能性
- 画面表示では outcome=MISSING のため、必要データ（診療科/受付行）欠落で送信抑止の疑い

再実行に必要な前提:
- Reception 一覧に当日分の患者行が出ること（appointments/visits list が空でない）
- 患者がローカルDBに存在し、Charts で診療科が確定できること
- MSW であれば appointments/visits に当日分のダミー行を返す handler を追加

##### 8.1.6-5 ORCA送信未発火（outcome=MISSING）原因切り分け（2026-02-04）

- RUN_ID: 20260204T073855Z
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T073855Z/fullflow/network/network.json`

原因特定:
- `/orca21/medicalmodv2/outpatient` 応答が outcome=MISSING / outpatientList 空
  - missingMaster=false / fallbackUsed=false だが、対象データが空のため MISSING
- `/api21/medicalmodv2` が発火していない（Network に存在しない）
- ChartsActionBar の送信前チェックで `Department_Code` が不足すると送信を停止
  - `Department_Code` は Reception 一覧の選択行（selectedEntry.department）由来
  - appointments/visits 空 → Reception 行未生成 → Department_Code 不明 → 送信ブロック

回避策/条件:
- Reception 一覧に当日分の患者行を出す（appointments/visits list を非空にする）
- 選択行から診療科/診療日が確定する状態で Charts を開く
- MSW 使用時は appointments/visits に当日分のダミー行を返す handler を追加して送信前条件を満たす

##### 8.1.6-6 MSWダミー行追加後の再実行（2026-02-04）

- RUN_ID: 20260204T075725Z
- Base URL: https://localhost:5175（VITE_DISABLE_MSW=0）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T075725Z/fullflow/`

結果:
- `/orca/appointments/list/mock` / `/orca/visits/list/mock` は 200（mock 経路で応答）
- Reception 行は未生成（patientId=01415 で一致する行がなく not-found）
- ORCA送信は発火し `/api21/medicalmodv2` へ POST（HTTP 502）
- `/orca21/medicalmodv2/outpatient` は outcome=MISSING / outpatientList 空のまま

補足:
- mock 応答は Vite dev middleware（flagged-mock-plugin）のサンプル患者（000001/000003）で返っており、
  MSW fixtures のダミー行（01415）は利用されていない可能性がある
- Playwright で MSW が有効化されていない場合、Service Worker 制御を確認し再ロードが必要

##### 8.1.6-7 flagged-mock 調整後の再実行（2026-02-04）

- RUN_ID: 20260204T084111Z
- Base URL: https://localhost:5175（VITE_DISABLE_MSW=0 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T084111Z/fullflow/`

結果:
- Reception 行は生成され、Charts まで遷移（patientId=01415）
- ORCA 送信ボタンが `disabled (data-disabled-reason=running)` で発火せず
- `/orca/appointments/list/mock` `/orca/visits/list/mock` は 200
- `/api21/medicalmodv2` は未発火（Network 記録なし）
- 会計へは遷移可能（Reception 画面へ戻る）

補足/次の確認点:
- `診療終了` 実行後も isRunning が解除されず送信がブロックされる疑い
- 送信前ガード（missing fields / dataSourceTransition / missingMaster / fallbackUsed）を UI で確認し、
  `Department_Code` / `Perform_Date` が解決されているかを再確認

##### 8.1.6-8 isRunning 修正反映後の再実行（2026-02-04）

- RUN_ID: 20260204T085650Z
- Base URL: https://localhost:5175（VITE_DISABLE_MSW=0 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T085650Z/fullflow/`

結果:
- Reception 行生成 → Charts 遷移は成功（patientId=01415）
- ORCA送信ボタンが `disabled (running)` のまま
- Network は `/orca/appointments/list/mock` `/orca/visits/list/mock` のみ（`/api21/medicalmodv2` 未発火）
- Console: MSW Service Worker 登録に失敗（SSL cert error）

補足:
- isRunning 修正後も `running` が解除されないため送信ブロック継続
- `診療終了` 実行後に ORCA関連 API が発火しないため、finish 処理がロックのままの疑い

##### 8.1.6-9 SW SSL対策後の再実行（2026-02-04）

- RUN_ID: 20260204T090822Z
- Base URL: http://localhost:5175（HTTPS OFF）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T090822Z/fullflow/`

結果:
- Reception: 受付登録完了、行生成 → Charts 遷移 OK
- ORCA送信: disabled（`not_server_route,missing_master`）で未発火
- 会計送信: `missing_master` により disabled
- Order: フォームが disabled のため入力不可

補足:
- dataSourceTransition が server でなく、missingMaster=true のため送信ガードが発火
- MSW/flagged-mock のフラグで `missingMaster=false` / `dataSourceTransition=server` を強制するか、
  MSW OFF で server route を確立して再試行が必要

##### 8.1.6-10 missing_master / not_server_route 解消後の再実行（2026-02-04）

- RUN_ID: 20260204T101753Z
- Base URL: http://localhost:5175（HTTPS OFF / MSW 有効 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T101753Z/fullflow/`

結果:
- Reception: 受付登録完了 → 行生成 → Charts 遷移 OK（patientId=01415）
- Charts flags: `dataSourceTransition=server` / `missingMaster=false` / `fallbackUsed=false`
- ORCA送信ボタン: enabled（`disabled=false` / `data-disabled-reason=null`）
- ORCA送信: クリック後も確認ダイアログが表示されず、`/api21/medicalmodv2` / `/api21/medicalmodv23` 未発火
- Network: `POST /orca21/medicalmodv2/outpatient` のみ（診療終了側の確認リクエスト）
- 会計へ: ボタンが安定せずクリックタイムアウト
- Console: `Maximum update depth exceeded`（PatientsTab 起点のレンダーループ警告）

補足/次の確認点:
- missing_master/not_server_route のガードは解消済みだが、送信確認ダイアログが起動せず送信フローに入らない
- ORCA送信が発火しない原因として、Charts 側のレンダーループ/状態更新不整合が疑わしい
- `ChartsActionBar` の送信ボタン押下が state 更新（`confirmAction`）に反映されているか、UI 側のログ/監視で確認が必要

##### 8.1.6-11 sendDisabled ガード解消条件の整理（2026-02-04）

- 対象ガード: `not_server_route` / `missing_master` / `permission_denied`

解消条件（前提）:
- `not_server_route`: `dataSourceTransition=server` を満たすこと。`resolveOutpatientFlags` は `claim/outpatient`・`orcaSummary`・`appointment` のいずれかの `dataSourceTransition` を採用するため、少なくとも 1 系列で server を返す必要がある。
- `missing_master`: `missingMaster=false` を満たすこと。`claim/outpatient` または `orcaSummary` のレスポンスで `missingMaster=false` を返し、fallback 経路を避ける。
- `permission_denied`: 送信時に 401/403 を返さず、`hasStoredAuth()` が true（`devFacilityId`/`devUserId`/`devPasswordPlain or Md5` が保存済み）。

設定/修正の例:
- route: `VITE_DISABLE_MSW=1`（実 API）または `VITE_OUTPATIENT_DATA_SOURCE_TRANSITION=server` を明示し、`/orca/appointments/list`・`/orca/visits/list` が server 経由で返ることを確認。
- master: ORCA master 取得が成功する seed/時刻条件を用意し、`missingMaster=false` が返ることを確認（必要なら MSW の flagged mock で `missingMaster=false` を強制）。
- permission: facility/user/password を session/localStorage に保存し、Basic 認証 or legacy header のいずれかで 401/403 を回避。

補足:
- 上記ガード解消後でも、送信確認ダイアログ非表示の場合は `confirmAction` が更新されていない可能性があり、UI 側の追加ログが必要。

##### 8.1.6-12 PatientsTab 修正反映後の再実行（2026-02-04）

- RUN_ID: 20260204T103927Z
- Base URL: http://localhost:5175（HTTPS OFF / MSW 有効 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T103927Z/fullflow/`

結果:
- Reception: 受付登録完了 → 行生成 → Charts 遷移 OK
- ORCA送信ダイアログ: 非表示（クリック後も表示されず）
- ORCA送信発火: `/api21/medicalmodv2` 未発火、Network は `/orca21/medicalmodv2/outpatient` のみ
- Console: `Maximum update depth exceeded` が継続発生

補足:
- PatientsTab 修正反映後でもレンダーループ警告が残り、送信ダイアログも未表示

##### 8.1.6-13 baseDraft 修正反映後の再実行（2026-02-04）

- RUN_ID: 20260204T105046Z
- Base URL: http://localhost:5175（HTTPS OFF / MSW 有効 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T105046Z/fullflow/`

結果:
- Reception: 受付登録完了 → 行生成 → Charts 遷移 OK
- ORCA送信ダイアログ: 非表示（クリック後も表示されず）
- ORCA送信発火: `/api21/medicalmodv2` 未発火、Network は `/orca21/medicalmodv2/outpatient` のみ
- Console: `Maximum update depth exceeded` が継続発生

補足:
- baseDraft 修正反映後も送信ダイアログ未表示のため、confirmAction が反映されない問題が継続

##### 8.1.6-14 sendDisabled 修正反映後の再実行（2026-02-04）

- RUN_ID: 20260204T114051Z
- Base URL: http://localhost:5175（HTTPS OFF / MSW 有効 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T114051Z/fullflow/`

結果:
- Reception: 受付登録完了 → 行生成 → Charts 遷移 OK
- ORCA送信ダイアログ: 非表示（クリック後も表示されず）
- ORCA送信発火: `/api21/medicalmodv2` 未発火、Network は `/orca21/medicalmodv2/outpatient` のみ
- 会計へ: ボタンが安定せずクリックタイムアウト

補足:
- sendDisabled 修正反映後も確認ダイアログ未表示・未発火が継続

##### 8.1.6-15 Alt+S 修正反映後の再実行（2026-02-04）

- RUN_ID: 20260204T120346Z
- Base URL: http://localhost:5175（HTTPS OFF / MSW 有効 / flagged-mock 有効）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T120346Z/fullflow/`

結果:
- Reception: 受付登録完了 → 行生成 → Charts 遷移 OK
- ORCA送信ダイアログ: 非表示（クリック後も表示されず）
- ORCA送信発火: `/api21/medicalmodv2` 未発火、Network は `/orca21/medicalmodv2/outpatient` のみ
- 会計へ: 画面遷移できず（Timeout）

補足:
- Alt+S 修正反映後も送信ダイアログ未表示・未発火が継続

##### 8.1.6-16 sendDisabled=true の根因整理（2026-02-04）

観測済み証跡:
- RUN_ID: 20260204T090822Z
- ORCA送信: disabled（`not_server_route,missing_master`）
- 証跡: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T090822Z/fullflow/`

sendDisabled が true になる条件:
- `isRunning=true`: 直前のアクションが未完了。`data-disabled-reason=running` が付与される。
- `approvalLocked=true`: 承認済み/署名確定でロック中。`approval_locked` がガード理由に出る。
- `missing_master=true`: master 欠損を検知。`missing_master` がガード理由に出る。
- `dataSourceTransition!=server` かつ `requireServerRouteForSend=true`: `not_server_route` がガード理由に出る。
- `permissionDenied=true` または `hasPermission=false`: 送信時 401/403 検知 or auth 未設定で `permission_denied` が出る。

解消策:
- isRunning: 直前アクションの完了/失敗を待つ。必要なら画面リロードで状態をリセット。
- approvalLocked: 承認済みレコードを解除/新規受付で再作成。
- missing_master: ORCA master 取得成功を保証（seed/時刻条件）し、`missingMaster=false` を返す。MSW 検証時は flagged-mock で `VITE_OUTPATIENT_MISSING_MASTER=0` を明示。
- not_server_route: `dataSourceTransition=server` を保証（MSW OFF で実 API、または `VITE_OUTPATIENT_DATA_SOURCE_TRANSITION=server` を明示）。
- permission_denied: devFacilityId/devUserId/password を session/localStorage に保存し Basic 認証を通す（401/403 を回避）。

補足:
- ガード理由は `#charts-actions-send-guard` または send ボタンの `data-disabled-reason` に出力される。

#### 8.1.5 残項目ゼロ宣言の可否（2026-02-04 時点）

- 判定: 不可
- 理由:
  - 8.1.1/8.1.2/8.1.3 の多くが未実施のため「要確認」。
  - 8.1.4（WebORCA 実データ整合）の証跡が未取得。
- 残項目ゼロ宣言の条件:
  - 8.1.1/8.1.2/8.1.3 を実施し、Yes/No/要確認を確定（備考に RUN_ID/証跡を記載）。
  - 8.1.4 の患者/受付/会計/予約/例外/反映を UI 表示と ORCA 応答で突合し、証跡を保存。
  - 必要に応じてロール差分/外部連携失敗時の確認を追加し、要確認が 0 になる状態を確認。

### 8.2 エビデンス

- 形式: スクリーンショット / ログ / レポート / チケット / その他
- 保存先: `artifacts/verification/20260204T082000Z/`（最新）
- CLAIM廃止検証: `artifacts/webclient/claim-deprecation/20260203T214629Z/`（RUN_ID: 20260203T214629Z, `qa-claim-deprecation.md` / `qa-claim-deprecation.json` / screenshots）
- チェックリスト最小検証（遷移/リロード）: `artifacts/webclient/checklist-minimal/20260204T001738Z/`（RUN_ID: 20260204T001738Z, `qa-checklist-minimal.md` / `qa-checklist-minimal.json` / screenshots）
- acceptmodv2（web-client 受付送信）: `OpenDolphin_WebClient/artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/`（`accept-summary.md` / screenshots / network）
- ORCA 会計送信結果: `artifacts/verification/<RUN_ID>/accounting-send/`（acceptlstv2 JSON / Reception スクショ / server-modernized ログ）
- ORCA 会計送信結果（実測）:
  - `artifacts/verification/20260204T072850Z-orca-accounting/accounting-send/`（acceptlstv2 class=01/02）
  - `artifacts/verification/20260204T073630Z-orca-accounting/accounting-send/`（会計送信後の再確認）
- SOAP 記載（保存/再表示）: `OpenDolphin_WebClient/artifacts/verification/20260204T125500Z-soap-persistence/soap-persistence/`（`qa-soap-persistence.md` + screenshots）
- SOAP server 連携（/orca/chart/subjectives）: `OpenDolphin_WebClient/artifacts/verification/20260204T131500Z-soap-persistence/soap-persistence/`（request 発火・server 未起動）
- SOAP server 連携（/orca/chart/subjectives）再検証: `OpenDolphin_WebClient/artifacts/verification/20260204T125507Z-soap-persistence-modernized/soap-persistence/`（response 500、永続化未確認）
- SOAP server 連携 500 切り分け: `OpenDolphin_WebClient/artifacts/verification/20260204T130650Z-soap-subjectives-500/soap-subjectives-500/`（proxy 500/9080 応答なし）
- listener 復旧確認: `OpenDolphin_WebClient/artifacts/verification/20260204T133200Z-listener-check/listener-check/`（9080/8080 応答確認）
- SOAP server 連携（patient 作成後）: `OpenDolphin_WebClient/artifacts/verification/20260204T133701Z-soap-persistence-modernized/soap-persistence/`（DB制約で 500）
- MSW on E2E: `artifacts/webclient/screen-structure-plan/20260203T215120Z-msw-on-warnfix/`（`qa-404-suppression.md/json` + screenshots）
- MSW off E2E: `artifacts/webclient/screen-structure-plan/20260203T215654Z-msw-off-warnfix2/`（`qa-404-suppression.md/json` + screenshots）
- 命名規則: `{screen}-{step}-{timestamp}.{ext}`（例: `reception-01-20260202T232324Z.png`, `console-01-20260202T232324Z.txt`）
- 保持期間: 原則 1 年（規定がある場合は規定に従う）

#### 8.2.1 実行記録テンプレ（RUN_ID/証跡保存/記録表）

- RUN_ID 命名: `YYYYMMDDTHHMMSSZ-{scenario}`（例: `20260204T112000Z-weborca-reception-send`）
- 証跡保存先: `artifacts/verification/{RUN_ID}/`
- 最小記録項目: 日時 / 環境 / MSW / 接続先 / 結果 / 証跡パス

| RUN_ID | 日時（開始/終了） | 環境（ORCA_MODE/ENV/Branch） | MSW | 接続先（trial/prod/host） | 結果 | 証跡パス |
| --- | --- | --- | --- | --- | --- | --- |
| 20260204T112000Z-weborca-reception-send | 2026-02-04 11:20〜11:35 | ORCA_MODE=weborca, ORCA_API_*, branch=main | off | dev or trial | 受付送信/再送の結果を記録 | `OpenDolphin_WebClient/artifacts/verification/20260204T112000Z-weborca-reception-send/` |

### 8.3 完了条件

- 必須チェック項目: 8.1 チェックリストの必須項目が全て Yes または適切な代替策で合意済み
- エビデンス提出: 重要機能/主要画面のエビデンスが保存先に格納されている
- 承認記録: 重大不具合の対応方針（修正/延期/受容）が承認済み、完了承認者が記録済み

## 9. 運用ルール

### 9.1 更新頻度

- 定期更新: 半年ごと
- トリガー更新: 仕様変更 / 重大障害 / 体制変更 / 大幅な機能追加

### 9.2 変更時の見直し手順

1. 変更内容の記録（変更理由・影響範囲）
2. 関係者レビュー（実施者/レビュー担当）
3. 承認取得（承認者）
4. 改定版の公開 / 周知（関係者へ周知）

### 9.3 版管理

- 版番号付与ルール: 0.x（草案）→ 1.0（初版）→ 1.x（改訂）
- 変更履歴の記載先: 本書末尾「13. 変更履歴」
- 旧版の保管先: 共有ストレージ内の `project/verification/archive/` に保存

### 9.4 不具合時のデバッグ方針

- 不具合が見つかった場合は、再現条件と手順を明記し、デバッグ作業を計画に組み込む
- ブラウザ/DevTools のログを優先的に取得し、原因切り分けの一次情報とする

## 10. 要確認事項

> 共通の要確認事項は「8.1.2 要確認事項（短文チェック）」でチェックする。

### 10.1 共通要確認事項（チェックリスト参照）

- 8.1.2 の各項目に対し、実施前判断の有無と根拠を記載する。

### 10.2 案件固有の要確認事項

- モダナイズ版 REST API の OpenAPI（yaml/json）の正本が未確認。現時点の一次は `MODERNIZED_REST_API_INVENTORY.md`。
- 画面対応表の正本は分散（web-client-api-mapping + 各画面設計）。単一のトレーサビリティ表は未整備。
- `/api01rv2/*` など XML 系の ORCA 連携エンドポイントが server-modernized の「管理範囲」か、外部 ORCA 直結/プロキシかの明記が必要。
- Legacy REST 互換 API（Administration/Debug）を「本番導線の機能一覧」に含めるか要判断。
- CLAIM 廃止対象（`/karte/claim`, `/schedule/document`, `/serverinfo/claim/conn` 等）は「対象外」欄へ明示が必要。
- 画面オーナー（4.1 のオーナー欄）の割当確定が必要。
- Debug 導線を確認範囲に含めるかの判断が必要。
- `/f/:facilityId/outpatient-mock` の扱い（AppRouter は `/debug/outpatient-mock` のみ許可）。
- Administration の直アクセスガード仕様（旧資料と現行実装の整合）。
- Administration の詳細設計ドキュメント有無。
- returnTo を含む詳細遷移図の不足。
- 複数デバイス対応（レスポンシブ/回転/DPI差分）の確認範囲・証跡が未定。
- 表示の時差（非同期更新/ポーリング/キャッシュ反映遅延）の確認範囲・証跡が未定。
- 通知/メール（送信失敗/再送/配信停止）の確認範囲・証跡が未定。
- 互換性（旧データ/旧APIの取り扱い、移行差分）の確認範囲・証跡が未定。

## 11. リスクと対応

| リスク | 影響 | 兆候 | 対策 |
| --- | --- | --- | --- |
| 状態別表示の未確認 | 例外時にユーザーが詰まる | 画面が空白/無応答 | 状態一覧を事前に洗い出し必須確認に追加 |
| 権限差分の未確認 | 情報漏えい/操作不可 | 権限エラーが散発 | ロール別チェックリストを作成 |
| エラー文言の不備 | 問い合わせ増/復旧遅延 | 不明なエラー報告 | 文言レビューを作業に組み込む |
| 外部連携障害時の未確認 | 連携停止/不整合 | 再試行方針が不明 | 失敗時挙動を仕様化し確認 |
| 同時更新の未確認 | 上書き/破損 | 競合時の欠落 | 競合シナリオを追加 |
| バッチ再実行の未確認 | 重複/欠損 | 再実行時の差異 | 再実行手順とガードを明記 |
| 監査ログの未確認 | 監査対応不可 | ログ欠落の指摘 | ログ項目一覧を別表で作成 |
| キャッシュ反映の未確認 | 画面と実データ不一致 | 更新後の差 | 反映タイミング確認を追加 |
| 複数デバイス対応の未確認 | 端末差分による表示崩れ | 端末差分の指摘 | デバイス差分の確認項目を追加 |
| 表示の時差の未確認 | 反映遅延による誤認 | 反映差分の報告 | 反映遅延の計測手順を追加 |
| 通知/メールの未確認 | 通知漏れ/再送漏れ | 通知が届かない報告 | 通知失敗/再送/停止の確認を追加 |
| 互換性の未確認 | 旧データ/旧APIで不具合 | 移行後の差分報告 | 互換性の整理と検証を追加 |
| ERR_ABORTED の未切り分け | 受付/予約取得が断続的に失敗 | `net::ERR_ABORTED` が継続 | AbortSignal/再取得頻度/Proxy 経路を切り分け |
| missingMaster 継続の未切り分け | マスタ未準備扱いで UI が反映停止 | `missingMaster=true` が継続 | ORCA wrapper 経路とレスポンスメタを確認 |

### 11.1 リスク対策（短文補足）

- 状態別表示の未確認: 例外時にユーザーが詰まる → 状態一覧を洗い出し必須確認に追加
- 権限差分の未確認: 情報漏えい/操作不可 → ロール別チェックリストを作成
- エラー文言の不備: 問い合わせ増/復旧遅延 → 文言レビューを作業に組み込む
- 外部連携障害時の未確認: 連携停止/不整合 → 失敗時挙動を仕様化し確認
- 同時更新の未確認: 上書き/破損 → 競合シナリオを追加
- バッチ再実行の未確認: 重複/欠損 → 再実行手順とガードを明記
- 監査ログの未確認: 監査対応不可 → ログ項目一覧を別表で作成
- キャッシュ反映の未確認: 画面と実データ不一致 → 反映タイミング確認を追加
- 複数デバイス対応の未確認: 端末差分による表示崩れ → デバイス差分の確認項目を追加
- 表示の時差の未確認: 反映遅延による誤認 → 反映遅延の計測手順を追加
- 通知/メールの未確認: 通知漏れ/再送漏れ → 通知失敗/再送/停止の確認を追加
- 互換性の未確認: 旧データ/旧APIで不具合 → 互換性の整理と検証を追加
- ERR_ABORTED の未切り分け: 受付/予約取得が断続的に失敗 → AbortSignal/再取得頻度/Proxy 経路を切り分け
- missingMaster 継続の未切り分け: マスタ未準備扱いで UI が反映停止 → ORCA wrapper 経路とレスポンスメタを確認

### 11.2 ERR_ABORTED / missingMaster 切り分けと暫定対処

#### 11.2.1 原因整理（要点）

- missingMaster は初期フラグ true が継承されるため、ORCA wrapper の応答が通らない/メタが欠落すると継続しやすい。
- ERR_ABORTED は AbortSignal による fetch 中断が主因で、MSW 有効時は signal をそのまま渡すため再現しやすい。
- proxy 経路が /openDolphin/resources を経由しない場合、server-modernized の wrapper 応答が取れず missingMaster が更新されない。

#### 11.2.2 再検証手順（MSW on/off・proxy 経路含む）

1. DevTools で `/orca/appointments/list` `/orca/visits/list` の Request URL が `/openDolphin/resources/` 経由か確認する。
2. 応答 JSON に `missingMaster` / `dataSourceTransition` が含まれるか確認する（無ければ wrapper 未経由の疑い）。
3. `VITE_DISABLE_MSW=1` で MSW を無効化し、ERR_ABORTED が再現するか確認する。
4. `refetchInterval` を一時停止または延長し、AbortSignal 由来の中断が減るか確認する。
5. `VITE_DEV_PROXY_TARGET` / `VITE_ORCA_API_PATH_PREFIX` / `ORCA_MODE` の組合せを固定し、weborca 直経路を避ける。

#### 11.2.3 暫定対処案

- 受信経路固定: server-modernized への proxy 経路を優先し、ORCA wrapper 応答で `missingMaster=false` を受け取る。
- AbortSignal 緩和: Reception の `refetchInterval` を延長/停止し、Abort を減らす。
- MSW 切替: MSW on/off の差分で再現性を確認し、問題が MSW 経由に偏る場合は MSW を無効化して検証を継続。

## cmd_20260206_23 カルテ版管理・真正性（追加）

- **Phase1（履歴/差分閲覧）**: DocumentModel/Module の append-only 履歴取得、任意 revision の取得、差分算出 API を実装し、RUN_ID=`20260206T151158Z-cmd_20260206_23_sub_1-server-versioning` にて `artifacts/verification/20260206T151158Z-cmd_20260206_23_sub_1-server-versioning/server-versioning.md` で履歴/API案と実証証跡を記録。`20260206T222006Z-cmd_20260206_23_sub_4-server-revision-api` で revision API を curl 実証し、`OpenDolphin_WebClient/artifacts/verification/20260206T222006Z-cmd_20260206_23_sub_4-server-revision-api/server-revision-api/` に証跡を残す。`server-versioning.md`（サーバー設計メモ）は multi-agent-shogun 側の同ディレクトリにのみ存在し、OpenDolphin WebClient 側にはコピーされないためこちらのパスを参照。
- **Phase2/3 開始条件**: `kaart.versioning.enabled=true` + `d_document_revision_meta`（または `d_document.root_revision_id`）を追加し、APIが `rootRevisionId`/`latestRevisionId`/`contentHash` を返すことを確認した時点で次フェーズへ進める。Phase2 では `content_hash`/`diff_meta` を永続化、Phase3 では差分格納を追加。
- **cmd_20260206_21 Do転記との監査整合**: Do転記は `AuditEventPayload.details` に `operationPhase=do` + `sourceRevisionId`/`baseRevisionId`/`createdRevisionId` を保存する必要がある。上記 `server-versioning.md` の audit 項目と照合し、同 RUN_ID の `RUN_ID.txt` も evidence に活用。

## 12. スケジュール

| フェーズ | 開始 | 終了 | 担当 | 備考 |
| --- | --- | --- | --- | --- |
| 計画 | 2026-02-03 | 2026-02-03 | 足軽1 / 家老 | 本計画書の確定 |
| 準備 | 2026-02-03 | 2026-02-04 | 足軽1-4 | 画面一覧・観点の整理 |
| 実施 | 2026-02-05 | 2026-02-07 | 足軽1-4 | 画面レビューと証跡 |
| レビュー | 2026-02-08 | 2026-02-08 | 家老 | レビュー/指摘整理 |
| 完了 | 2026-02-09 | 2026-02-09 | 家老 | 承認・完了 |

## 13. 変更履歴

| 版 | 日付 | 変更内容 | 変更者 | 承認者 |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-02-03 | 初版 | 足軽1 | 家老 |
| 0.2 | 2026-02-03 | 草案に統合文案・チェックリスト・リスク表を反映 | 足軽1 | 家老 |
| 0.3 | 2026-02-03 | 体制/RACI/スケジュール/基本情報を確定 | 足軽1 | 家老 |
| 0.4 | 2026-02-03 | CLAIM廃止検証の証跡を追加（RUN_ID: 20260203T214629Z） | 足軽7 | 家老 |
| 0.5 | 2026-02-04 | 8.1 記入方針/記入案と 8.1.4 証跡整理を追記 | 足軽7 | 家老 |
| 0.6 | 2026-02-04 | ERR_ABORTED/missingMaster の切り分けと対応方針を追記 | 足軽8 | 家老 |
| 0.6 | 2026-02-04 | 8.1 チェックリスト確定と残項目ゼロ宣言の可否判断を追記 | 足軽7 | 家老 |
| 0.7 | 2026-02-04 | 7.2 実施ログの再採番と PLACEHOLDER 注記整合を修正 | 足軽7 | 家老 |
| 0.8 | 2026-02-04 | 8.1.1〜8.1.3 実行計画と最小検証証跡を追記 | 足軽7 | 家老 |
| 0.9 | 2026-02-04 | 未完検証の前提条件（権限/データ/接続）を明文化 | 足軽7 | 家老 |
| 1.0 | 2026-02-04 | 8.1.4 再検証の最小条件/突合ポイント/証跡形式を追記 | 足軽7 | 家老 |
| 1.1 | 2026-02-04 | acceptmodv2 の seed/権限前提と準備手順を追記 | 足軽7 | 家老 |
| 1.2 | 2026-02-04 | Webクライアント経由の実データ送信手順/証跡を追記 | 足軽7 | 家老 |
| 1.3 | 2026-02-04 | 運用連携可否の判定と本番想定計画を追記 | 足軽7 | 家老 |
| 1.4 | 2026-02-04 | acceptmodv2 成功証跡の反映と運用連携残項目の更新 | 足軽7 | 家老 |
| 1.0 | 2026-02-04 | 7.2.22〜7.2.26 / 8.1.4 の追加実行計画と証跡フォーマットを追記 | 足軽8 | 家老 |
| 1.1 | 2026-02-04 | 未完検証の実行記録テンプレ（RUN_ID/証跡保存/記録表）を追記 | 足軽8 | 家老 |
| 1.2 | 2026-02-04 | Dev ORCA（100.102.17.40:8000）到達性の切り分け結果と前提条件を追記 | 足軽8 | 家老 |
| 1.3 | 2026-02-04 | Dev ORCA 到達性の確認手順をチェックリスト化 | 足軽8 | 家老 |
| 1.4 | 2026-02-04 | Dev ORCA 到達不可時のエスカレーション情報と依頼テンプレを追記 | 足軽8 | 家老 |
| 1.5 | 2026-02-04 | acceptmodv2 実測 RUN_ID を記録表に反映し、実測結果の整合を確保 | 足軽8 | 家老 |
| 1.6 | 2026-02-04 | WEBORCA 実データ送信の実行可否判定とブロッカー/解決手順を追記 | 足軽8 | 家老 |
| 1.7 | 2026-02-04 | WEBORCA 実データ送信の可否判定から acceptmodv2 依存を削除 | 足軽8 | 家老 |
| 1.8 | 2026-02-04 | WEBORCA 実データ送信のブロッカー表記から acceptmodv2 依存を完全除去 | 足軽8 | 家老 |
| 1.9 | 2026-02-04 | acceptmodv2 復旧の前提/本番想定計画（参考）を追記 | 足軽8 | 家老 |
| 2.0 | 2026-02-04 | 通し検証（受付→会計送信）証跡テンプレと RUN_ID 管理を統合 | 足軽8 | 家老 |
| 2.1 | 2026-02-04 | オーダー画面（薬剤/処置マスタ）検証の実施不可ログと証跡を追記 | 足軽8 | 家老 |
| 2.2 | 2026-02-04 | OpenDolphin_WebClient への切替と Trial 設定前提の整理を追記 | 足軽8 | 家老 |
| 2.1 | 2026-02-04 | ORCA 会計送信結果確認の手順/証跡フォーマットを追加 | 足軽7 | 家老 |
| 2.3 | 2026-02-04 | オーダー画面（薬剤/処置マスタ）UI 検証の実施証跡を更新 | 足軽7 | 家老 |
| 2.4 | 2026-02-04 | ORCA 会計送信結果（acceptlstv2 class=01/02）の実測証跡を追記 | 足軽7 | 家老 |
| 2.5 | 2026-02-04 | 会計送信後の acceptlstv2 class=02 再確認結果を追記 | 足軽7 | 家老 |
| 2.6 | 2026-02-04 | SOAP 記載の保存/再表示（server-modernized 連携有無）証跡を追記 | 足軽7 | 家老 |
| 2.7 | 2026-02-04 | SOAP 保存の server 連携実装と通信証跡（server 未起動）を追記 | 足軽7 | 家老 |
| 2.13 | 2026-02-04 | SOAP 保存の server-modernized 再検証（response 500）証跡を追記 | 足軽7 | 家老 |
| 2.14 | 2026-02-04 | `/orca/chart/subjectives` 500 切り分け結果（proxy 500/9080 応答なし）を追記 | 足軽7 | 家老 |
| 2.15 | 2026-02-04 | listener 復旧確認（9080/8080 応答）と SOAP 保存の DB 制約 500 を追記 | 足軽7 | 家老 |
| 2.6 | 2026-02-04 | MSW ハンドラ追加後の薬剤/処置マスタ再実証を追記 | 足軽8 | 家老 |
| 2.7 | 2026-02-04 | missing_master/not_server_route 解消後の再実行結果（8.1.6-10）を追記 | 足軽6 | 家老 |
| 2.8 | 2026-02-04 | PatientsTab 修正反映後の再実行結果（8.1.6-12）を追記 | 足軽6 | 家老 |
| 2.9 | 2026-02-04 | baseDraft 修正反映後の再実行結果（8.1.6-13）を追記 | 足軽6 | 家老 |
| 2.10 | 2026-02-04 | sendDisabled 修正反映後の再実行結果（8.1.6-14）を追記 | 足軽6 | 家老 |
| 2.11 | 2026-02-04 | Alt+S 修正反映後の再実行結果（8.1.6-15）を追記 | 足軽6 | 家老 |
| 2.12 | 2026-02-04 | sendDisabled=true 根因整理（8.1.6-16）を追記 | 足軽6 | 家老 |
