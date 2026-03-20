# Phase2 サーバー Foundation マネージャーチェックリスト（2025-11-14）

> **参照開始順**
> 1. `AGENTS.md`
> 2. `docs/web-client/README.md`（Web Client Hub）
> 3. `docs/server-modernization/phase2/INDEX.md`
> 4. `docs/managerdocs/PHASE2_SERVER_FOUNDATION_MANAGER_CHECKLIST.md`
>
> **報告テンプレ（RUN_ID / 証跡パス / DOC_STATUS 行）**
> - RUN_ID: `RUN_ID=<ID>`（設定レビューのみは `RUN_ID=NA`）
> - 証跡パス: `docs/server-modernization/phase2/foundation/...`, `ops/...`, `artifacts/...`, `logs/...`
> - DOC_STATUS 行: `docs/web-client/planning/phase2/DOC_STATUS.md`「モダナイズ/基盤（Server Foundation）」行の更新内容
>
> RUN_ID=`20251219T125123Z` で DDL 変換警告と Agroal クラスロード警告の解消を実施。証跡: `docs/server-modernization/phase2/operations/logs/20251219T125123Z-ddl-agroal-warn-fix.md`。
>
> **Archive 移行チェック（担当: Codex, 期限: 2025-11-29）**
> - [ ] Dormant 判定と関連ログ
> - [ ] `docs/archive/2025Q4/` への移行とスタブ作成
> - [ ] `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` / `DOC_STATUS.md` 備考へアーカイブ結果反映
>
- **開発端末手順の現行/Legacy 判定**
- [ ] `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` = 現行手順（Backend ops 参照時に使用）
- [ ] `mac-dev-login.local.md` は Legacy / Archive 扱いとし、DOC_STATUS と同期

## 1. 背景
- Server Modernization Phase2 の資料は `docs/server-modernization/phase2/INDEX.md` を起点に foundation/domains/operations/notes へ展開されている。
- 旧サーバーの移行計画は `docs/server-modernization/legacy-server-modernization-checklist.md`（Archive: `../archive/2025Q4/server-modernization/legacy-server-modernization-checklist.md`）にまとめられており、Jakarta EE 10 化・依存更新・WAR 配備手順が網羅されている。
- Jakarta EE 10 ギャップ、依存アップデート、影響評価は `foundation/JAKARTA_EE10_GAP_LIST.md` `foundation/DEPENDENCY_UPDATE_PLAN.md` `foundation/IMPACT_MATRIX.md` で管理。
- ドメイン別メモ（例: `phase2/domains/RESERVATION_BATCH_MIGRATION_NOTES.md`, `phase2/domains/JAKARTA_EE10_CHARTS_VIEW_IMPACT.md`）は UI/業務要件にも影響するため、Web クライアント側マネージャーと連携して更新する。
- WildFly 設定は `ops/modernized-server/docker/configure-wildfly.cli`（および legacy 版 CLI）と、`SERVER_MODERNIZED_DEBUG_CHECKLIST.md` / `SERVER_MODERNIZED_STARTUP_BLOCKERS.md` / `TRACE_PROPAGATION_CHECK.md` などの Runbook で追跡する。

## 2. 参照ドキュメントマップ
| 区分 | ドキュメント | 内容 / 役割 | メモ |
| --- | --- | --- | --- |
| ナビゲーション | `docs/server-modernization/phase2/INDEX.md` | Phase2 全体のリンク集。 | 2026-06-15 Docker ブロッカー記載あり。 |
| Foundation | `phase2/foundation/JAKARTA_EE10_GAP_LIST.md`<br/>`phase2/foundation/DEPENDENCY_UPDATE_PLAN.md`<br/>`phase2/foundation/IMPACT_MATRIX.md` | Jakarta EE 10 置換、依存アップデート、影響度マトリクス。 | 2025-11-02〜11-05 更新。 |
| ドメイン | `phase2/domains/RESERVATION_BATCH_MIGRATION_NOTES.md`<br/>`phase2/domains/JAKARTA_EE10_CHARTS_VIEW_IMPACT.md`<br/>`phase2/domains/ORCA_REST_IMPLEMENTATION_NOTES.md`（参考） | 予約バッチ/JMS、ChartsView 影響、ORCA ラッパー設計。 | 2025-11-02〜11-09 更新。 |
| Legacy 計画 | `legacy-server-modernization-checklist.md`（Archive: `../archive/2025Q4/server-modernization/legacy-server-modernization-checklist.md`） | 旧サーバー全体の移行計画と進捗。 | Java 11/17, WildFly 26, REST parity などを網羅。 |
| Ops/CLI | `ops/modernized-server/docker/configure-wildfly.cli`<br/>`ops/legacy-server/docker/configure-wildfly.cli`<br/>`phase2/operations/SERVER_MODERNIZED_DEBUG_CHECKLIST.md`<br/>`phase2/operations/TRACE_PROPAGATION_CHECK.md` | WildFly 設定、デバッグ観点、Trace 採取。 | CLI ファイルは 2025-11-03 以降の差分コメントあり。 |
| ブロッカー & 進捗 | `phase2/SERVER_MODERNIZED_STARTUP_BLOCKERS.md`<br/>`phase2/operations/logs/*.md`<br/>`PHASE2_PROGRESS.md` | 起動ブロッカー、実測ログ、進捗ボード。 | Docker ブロッカーや RUN_ID 記録を参照。 |

## 3. タスクボード
- [ ] **タスクA: Foundation ギャップ同期（担当A）**
  - [ ] `JAKARTA_EE10_GAP_LIST.md` / `DEPENDENCY_UPDATE_PLAN.md` の未完了項目を洗い出し、`legacy-server-modernization-checklist.md` §3 と照合。
  - [ ] `IMPACT_MATRIX.md` の担当欄を最新アサインへ更新し、`PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` へ反映。
  - [ ] `DOC_STATUS.md` に foundation 行が無い場合は追加し、最終レビュー日と担当者を追記。
- [ ] **タスクB: ドメイン別メモ整備（担当B）**
  - [ ] `RESERVATION_BATCH_MIGRATION_NOTES.md` の JMS/CLAIM セクションを現状の WildFly CLI 設定（dolphinQueue, InVmConnectionFactory 等）と突合。
  - [ ] `JAKARTA_EE10_CHARTS_VIEW_IMPACT.md` の `common` モジュール置換計画を Web クライアント側と共有し、UI へ影響する TODO を `PHASE2_WEB_CLIENT_EXPERIENCE_MANAGER_CHECKLIST.md` へ伝える。
  - [ ] ドメインメモ更新時は必ず `phase2/INDEX.md` と `DOC_STATUS.md` の備考を更新。
- [ ] **タスクC: WildFly / Ops Runbook 同期（担当C）**
  - [ ] `ops/modernized-server/docker/configure-wildfly.cli` と legacy 版 CLI の差分をレビューし、再実行時の冪等性や新規リソース追加を `SERVER_MODERNIZED_DEBUG_CHECKLIST.md` §CLI 節へ追記。
  - [ ] `TRACE_PROPAGATION_CHECK.md` の RUN_ID（例: `20251110T070638Z`）を確認し、トレース取得スクリプトと CLI 設定が整合しているか検証。
  - [ ] WildFly 再起動や Docker 起動にブロッカーがある場合は `SERVER_MODERNIZED_STARTUP_BLOCKERS.md` と `PHASE2_PROGRESS.md` を更新。
- [ ] **タスクD: Legacy 互換性・計画レビュー（担当D）**
  - [ ] `legacy-server-modernization-checklist.md` の各セクションに最新ステータスを記入し、完了日や Blocker を明示。
  - [ ] Legacy/Modernized 両方の WAR を参照するドキュメント（例: `SERVER_MODERNIZATION_PLAN.md`, `REST_API_INVENTORY.md`）が古い場合、関係するマネージャーへタスクを割り振る。
  - [ ] 週次ミーティング前に Legacy 計画と foundation/ops タスクの整合を確認し、必要に応じて新規タスクを追加。

## 4. 進捗確認ポイント
- Foundation ドキュメントと legacy チェックリストの内容が一致しているか。
- WildFly CLI 変更時に Runbook・ログ・DOC_STATUS がすべて更新されたか。
- ドメインメモの TODO が Web クライアント / ORCA 側タスクへ正しく連携されたか。
- ブロッカー一覧 (`SERVER_MODERNIZED_STARTUP_BLOCKERS.md`) が最新か。

## 5. ワーカー指示・報告テンプレ
- 【ワーカー指示】
  1. 対象セクション（Foundation / Domain / Ops / Legacy）と参照ファイルを列挙。
  2. CLI や設定変更を伴う場合は証跡ファイル（`logs/`, `artifacts/`, `tmp/`）の保存先を指定。
  3. DOC_STATUS と `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` の更新要否を明記。
- 【ワーカー報告】
  1. 変更ファイル、適用した CLI コマンド、RUN_ID（設定作業のみなら `RUN_ID=NA`）。
  2. WildFly/Compose のログパス、証跡ファイル（例: `artifacts/wildfly-cli/<RUN_ID>/`）。
  3. 未解決の Blocker とフォローアップ計画。
  4. DOC_STATUS 更新内容と行番号。

## 6. 更新ルール
- CLI や設定ファイルへの変更は必ず本チェックリストと `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` のサーバー領域に反映し、日付と担当を記入。
- Foundation／Domain 資料の章を追加・削除した場合は `phase2/INDEX.md` へリンクを追加し、`docs/web-client/README.md` にも連絡事項を残す（Web クライアントへ波及するため）。
- Legacy plan に関する決定事項は 24 時間以内に `PHASE2_SERVER_FOUNDATION_MANAGER_CHECKLIST.md` と `legacy-server-modernization-checklist.md` の両方へ反映する。

## 7. RUN_ID=20251122T071146Z 監視事項
- WildFly を `setup-modernized-env.sh` で起動後、`docker compose -f docker-compose.modernized.dev.yml logs --no-color server-modernized-dev | rg -n WELD-0014` と `rg -n WELD-0014 server_latest_logs.txt` で `WELD-001410/001435` が再発していないことを再確認し、23:56:26/WELD-000119・23:58:38/WELD-001478 を `server_latest_logs.txt` に追記する。再発した場合は `docs/server-modernization/phase2/operations/logs/20251122T071146Z-e2e.md` と本チェックリストの RUN_ID セクションへ即時報告。
- `curl -H "userName: dolphindev"` + `-H "password: 1cc2f4c06fd32d0a6e2fa33f6e1c9164"` + `-H "X-Facility-Id: 1.3.6.1.4.1.9414.10.1"` `http://localhost:9080/openDolphin/resources/user/1.3.6.1.4.1.9414.10.1:dolphindev` で HTTP 204 を取得し、`server.log` の `Missing credentials headers`（行 742 付近）および認証成功（行 814-815）を確認して WildFly が `/user/<facility>:<userid>` を処理できていることを記録しておく。
- `http://localhost:5173/api/user/1.3.6.1.4.1.9414.10.1:dolphindev` が 500 を返したケースは Vite dev/proxy の DNS 解決 (`host.docker.internal`) に起因。`DEBUG=axios,VITE_HTTP_LOG_BASEURL` + `VITE_DEV_PROXY_TARGET=http://host.docker.internal:9080/openDolphin/resources` で起動し、`https://localhost:5173/api/user/1.3.6.1.4.1.9414.10.1:dolphindev` へ `traceparent: 00-11111111111111111111111111111111-2222222222222222-01` / `x-request-id: front-end-test-1` を付けて叩くと `/tmp/vite.log` 7:27:22・7:27:51 に `http proxy error` ＋ `Error: getaddrinfo ENOTFOUND host.docker.internal`、`grep -n "/api/user" server.log | tail` は空（WildFly 未到達）。この証跡を `docs/server-modernization/phase2/operations/logs/20251122T071146Z-e2e.md` / DOC_STATUS / 本チェックリストに残し、front-end へ traceparent/x-request-id 共有済み。
- 2025-11-28 23:29 JST: 上記の対応案どおり `VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources` / `VITE_API_BASE_URL=http://localhost:9080/openDolphin/resources` / `VITE_DISABLE_MSW=1` / `VITE_DEV_USE_HTTPS=0` / `VITE_HTTP_LOG_BASEURL=http://localhost:5174` で Vite dev を port 5174 で再起動し、同じ traceparent/x-request-id を付与した `curl http://localhost:5174/api/user/1.3.6.1.4.1.9414.10.1:dolphindev` を実行したところ HTTP 204 / `x-trace-id: 67f1229d-eef6-4d88-a45a-9c78af051434`。`docker compose -f docker-compose.modernized.dev.yml logs --no-color server-modernized-dev | tail -n 40` には `GET /user/1.3.6.1.4.1.9414.10.1:dolphindev traceId=66857999-8f71-4c0f-952e-61c5042563ea` / `traceId=4e379083-6e4a-471f-858d-c652e75931a2` が記録され、WildFly 側で TraceId 4e379083-… を受信したことが確認できたため本ファイル・DOC_STATUS・`docs/server-modernization/phase2/operations/logs/20251122T071146Z-e2e.md` に追記し、front-end チームへ該当 traceparent/x-request-id + `TraceId=4e379083-6e4a-471f-858d-c652e75931a2` を共有したうえで `opendolphin-server`/`server-modernized-dev` など Docker network 上で解決可能な target へ向けた継続検証を行ってください。
- 2025-11-29 09:10 JST: docker network 名を proxy target に指定（`docker compose -f docker-compose.web-client.yml run -d --service-ports -e DEBUG=axios -e VITE_HTTP_LOG_BASEURL=true -e VITE_DEV_PROXY_TARGET=http://server-modernized-dev:8080/openDolphin/resources -e VITE_DISABLE_MSW=1 -e VITE_DEV_USE_HTTPS=1 web-client`）し、同じ traceparent/x-request-id で `curl -k https://localhost:5173/api/user/1.3.6.1.4.1.9414.10.1:dolphindev` を実行。HTTP 204 / `x-trace-id: 7aa530ee-0704-4914-aa56-b6ed5b06435f`、`docker compose -f docker-compose.modernized.dev.yml logs --no-color server-modernized-dev | tail -n 40` では `traceId=2dd6b745-29b8-4d75-8703-4b9adea3e6da` / `traceId=7aa530ee-0704-4914-aa56-b6ed5b06435f` を記録し `/tmp/vite.log` 非生成（getaddrinfo 消失）。front-end へ traceparent/x-request-id + `x-trace-id=7aa530ee-0704-4914-aa56-b6ed5b06435f` を共有し、docker network ホスト指定を維持して再検証を続ける。証跡: `docs/server-modernization/phase2/operations/logs/20251122T071146Z-e2e.md` / DOC_STATUS / server_latest_logs 抜粋。

> 最終更新: 2025-11-14 / 担当: Codex（Server Foundation マネージャー）
