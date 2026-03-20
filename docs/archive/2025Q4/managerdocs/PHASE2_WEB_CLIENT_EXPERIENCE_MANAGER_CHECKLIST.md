# Phase2 Web クライアント Experience マネージャーチェックリスト（2025-11-14）

> **参照開始順**
> 1. `AGENTS.md`
> 2. `docs/web-client/README.md`（Web Client Hub）
> 3. `docs/server-modernization/phase2/INDEX.md`
> 4. `docs/web-client/ux/ux-documentation-plan.md` → `ux/reception-schedule-ui-policy.md` / `ux/patients-admin-ui-policy.md` / `ux/charts-claim-ui-policy.md`（`ux/legacy/` は背景資料）
> 5. `docs/managerdocs/PHASE2_WEB_CLIENT_EXPERIENCE_MANAGER_CHECKLIST.md`
>
> **報告テンプレ（RUN_ID / 証跡パス / DOC_STATUS 行）**
> - RUN_ID: `RUN_ID=<ID>`（ドキュメントのみは `RUN_ID=NA`）
> - 証跡パス: `docs/web-client/...`, `artifacts/...`, `logs/...`（更新したカテゴリを列挙）
> - DOC_STATUS 行: `docs/web-client/planning/phase2/DOC_STATUS.md`「Web クライアント UX/Features」行の更新内容
>
> RUN_ID=`20251201T053420Z` で参照チェーン（AGENTS→README→Phase2 INDEX→本チェックリスト）を棚卸し済み。証跡: `docs/server-modernization/phase2/operations/logs/20251201T053420Z-run-id-chain.md`。
> RUN_ID=`20251219T062549Z` で参照チェーンを再確認し、RUN_ID をハブ文書で統一。証跡: `docs/web-client/planning/phase2/logs/20251219T062549Z-runid-governance.md`。
> RUN_ID=`20251219T063136Z` で DOC_STATUS 棚卸しとハブ同期を実施。証跡: `docs/web-client/planning/phase2/logs/20251219T063136Z-doc-status-hub-sync.md`。
> RUN_ID=`20251202T083708Z` で画面別 API マッピングとバージョン整合メモ（`src/webclient_screens_plan/02_画面別 API マッピングとバージョン整合.md`）を更新し、証跡ログ `docs/server-modernization/phase2/operations/logs/20251202T083708Z-api-mapping.md` を README/DOC_STATUS と同期。orca05 hash/diff 再取得済み（同 RUN_ID）。
> RUN_ID=`20251202T090000Z` で受付/カルテ/管理の screens 棚卸しを開始。証跡: `docs/server-modernization/phase2/operations/logs/20251202T090000Z-screens.md`（README/DOC_STATUS と同期）。
> RUN_ID=`20251202T090000Z` の棚卸し内容を `docs/web-client/ux/` 配下の UX 草稿（Reception/Charts/Patients+Administration）へ移植済み。証跡ログと同 RUN_ID を保持する。
> RUN_ID=`20251202T090000Z` で UX 草稿に検証観点・未決事項メモを追記し、README/DOC_STATUS/証跡ログの RUN_ID を同期済み。
> RUN_ID=`20251202T090000Z` で UX 草稿に Playwright シナリオ案と配信タイミング検証計画を追記し、README/DOC_STATUS/証跡ログと整合。
> RUN_ID=`20251202T090000Z` で UX 草稿に Playwright 実装準備メモと配信観測計画詳細化を追記し、README/DOC_STATUS/証跡ログへ反映。
> RUN_ID=`20251202T090000Z` で UX 草稿に Playwright ヘルパー試作案とフラグ設計メモを追加し、README/DOC_STATUS/証跡ログと再同期。
> RUN_ID=`20251202T090000Z` で UX 草稿に Playwright ヘルパー実装着手とフィクスチャ計画追記を行い、README/DOC_STATUS/証跡ログと再同期。
> RUN_ID=`20251202T090000Z` で UX 草稿に Playwright 設定フラグと未実装ヘルパーの実装完了を追記し、README/DOC_STATUS/証跡ログと再同期。
> RUN_ID=`20251202T090000Z` で UX 草稿にヘッダー切替案とヘルパー通し検証準備を追記し、README/DOC_STATUS/証跡ログと再同期。
> RUN_ID=`20251202T090000Z` で A/B: 管理配信検証計画・ORCA キュー/配信フラグ設計（`docs/web-client/ux/admin-delivery-validation.md`, `docs/web-client/ux/config-toggle-design.md`）と Playwright シナリオ叩き台（`docs/web-client/ux/playwright-scenarios.md`）を追加し、README/DOC_STATUS/証跡ログと RUN_ID を揃えた。
> RUN_ID=`20251202T090000Z` で A/B のヘッダー付与検証・モック ON/OFF チェックリストと Playwright 前提フラグ（`VITE_USE_MOCK_ORCA_QUEUE` / `VITE_VERIFY_ADMIN_DELIVERY`）を明記し、README/DOC_STATUS/証跡ログと再同期。
> RUN_ID=`20251202T090000Z` の A/B 実行結果（ヘッダー付与レスポンス差分とモック ON/OFF 切替確認）を Playwright シナリオ草稿へ反映し、README / DOC_STATUS / 証跡ログとあわせて再掲。
> RUN_ID=`20251202T090000Z` の A/B/C 実行結果として Playwright テスト追加・モック分岐強化・監査ログ正規化を反映し、README / DOC_STATUS / 証跡ログと RUN_ID を再掲。
> RUN_ID=`20251202T090000Z` で Reception/Charts の ORCA エラー・未紐付・送信キュー遅延バナーの tone/`aria-live`/carry over ルールを統一し、自動/手動更新・ステータス遷移・ロール別可否・監査ログ出力を `docs/web-client/ux/reception-schedule-ui-policy.md` / `docs/web-client/ux/charts-claim-ui-policy.md` に追記。Playwright シナリオへモック ON/OFF（`VITE_USE_MOCK_ORCA_QUEUE`/`VITE_VERIFY_ADMIN_DELIVERY`）でのバナー検証と診療終了解除パスを追加。
> RUN_ID=`20251202T090000Z` で Patients→Reception 戻り導線（フィルタ保持・保険/自費モード維持・権限ガード）と Administration 配信遅延時の警告/リトライ導線、モック ON/OFF のレスポンス差分・監査ログ項目・ヘッダー有無を UX 草稿へ追記し、README/DOC_STATUS/証跡ログと同期。
> RUN_ID=`20251212T090000Z` で DocumentTimeline/OrderConsole/OrcaSummary/Patients の `missingMaster` → `cacheHit` → `dataSourceTransition=server` tone chain を `auth-service.tone=server` フラグで同期し、`docs/server-modernization/phase2/operations/logs/20251212T090000Z-charts-orca.md`・`artifacts/webclient/ux-notes/20251212T090000Z-orca-flags.md`・`src/outpatient_ux_modernization/04B2_WEBクライアントChartsPatientsUX実装.md` を README/DOC_STATUS/本チェックリストでリンク整理した。

> RUN_ID=`20251209T150000Z`（parent=20251209T071955Z）で 04C5 再検証（MSW OFF ローカル）。`/orca/claim/outpatient/mock` **200**（cacheHit=false, missingMaster=false, dataSourceTransition=server, runId=20251208T124645Z, traceId=96e647c3-a8a2-4726-9829-d32edc06f883）／`/orca21/medicalmodv2/outpatient` **200**（cacheHit=true, missingMaster=false, traceId=deb71516-4910-4a3d-8831-58e7617e55fb）。dev proxy `http://100.102.17.40:8000/...` と `https://100.102.17.40:{443,8443}/...` は引き続き TCP timeout（curl exit 28, ボディ無）。証跡: `docs/server-modernization/phase2/operations/logs/20251209T150000Z-integration-gap-qa.md`, `artifacts/webclient/e2e/20251209T150000Z-integration-gap-fix/`（stage_http_8000*.txt, stage_https_{443,8443}.txt）、doc 更新: `src/outpatient_ux_modernization/04C5_outpatient_api_gap_retest.md` / `04C3_WEBクライアントAPI接続検証.md`。UI/HAR は Stage/Preview 復旧後に同 RUN_ID で取得。

> RUN_ID=`20251205T153000Z` では `getChartToneDetails` を介して DocumentTimeline/PatientsTab の `ToneBanner` を再整備し、OrcaSummary/OrderConsole の missingMaster banner も `tone-banner` + `aria-live` で Reception と一致させた。証跡: `docs/server-modernization/phase2/operations/logs/20251205T153000Z-charts-orca.md`・`artifacts/webclient/ux-notes/20251205T153000Z-charts-ui-audit.md`・`docs/web-client/ux/ux-documentation-plan.md`。
> RUN_ID=`20251205T150000Z` では `AuthServiceProvider` の `recordOutpatientFunnel('resolve_master', …)` + `handleOutpatientFlags` による `resolve_master`→`charts_orchestration` の telemetry funnel を記録し、`docs/server-modernization/phase2/operations/logs/20251205T150000Z-integration-implementation.md` / `docs/web-client/ux/reception-schedule-ui-policy.md` / `docs/web-client/ux/ux-documentation-plan.md` / `docs/web-client/planning/phase2/DOC_STATUS.md` に RUN_ID を展開して README/DOC_STATUS/本チェックリストを再同期した。
> RUN_ID=`20251214T090000Z` では Stage Reception→Charts→Patients シナリオで `/orca/claim/outpatient/*` / `/orca21/medicalmodv2/outpatient` を叩き、`dataSourceTransition=server` + `tone=server` バナー + `cacheHit`/`missingMaster`/`resolveMasterSource` 表示を `docs/web-client/ux/reception-schedule-ui-policy.md` の指針に沿って確認する計画を `src/outpatient_ux_modernization/04C3_WEBクライアントAPI接続検証.md` に記録。`docs/server-modernization/phase2/operations/logs/20251214T090000Z-integration-qa.md` と `artifacts/webclient/e2e/20251214T090000Z-integration/` に QA/telemetry/スクリーンショットを保存し、DOC_STATUS の「Web クライアント UX/Features」行にも RUN_ID を追記済み。現時点では Stage ORCA 証明書・接続権限がないため未実施で、Stage へのアクセス権限を持つワーカーが 2025-12-14 09:00 JST 以降に実行した成果物で本チェックリストを更新してください。
> RUN_ID=`20251208T124645Z` ローカル server-modernized dev proxy（`VITE_DISABLE_MSW=1`, `VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources`, ヘッダ userName=`1.3.6.1.4.1.9414.10.1:dolphindev`, password=`dolphindev`(MD5), clientUUID=`devclient`）で `/orca/claim/outpatient/mock` と `/orca21/medicalmodv2/outpatient` を curl POST。両方 **HTTP 200** で `runId=20251208T124645Z`, `dataSourceTransition=server`, `auditEvent` と `cacheHit/missingMaster` を取得（mock: cacheHit=false/missingMaster=false, medical: cacheHit=true/missingMaster=false）。証跡: `docs/server-modernization/phase2/operations/logs/20251208T124645Z-dev-proxy-validation.md`（ローカル節）、スクショ: `artifacts/webclient/e2e/20251208T124645Z-local/*.png`。
> RUN_ID=`20251205T133848Z` では Stage Charts→Patients QA を試行。`stage.open-dolphin` が DNS で解決できず `/orca/claim/outpatient/*` / `/orca21/medicalmodv2/outpatient` へ届かなかったため `missingMaster`/`cacheHit`/`dataSourceTransition=server` を含む tone/banner を現地で確認できず、`docs/server-modernization/phase2/operations/logs/20251205T133848Z-charts-qa.md` + `artifacts/webclient/e2e/20251205T133848Z-charts/`（ログ/スクリーンショット/ storyboard）に証跡を残しました。Stage DNS/ネットワークが復旧したら同 RUN_ID を再実行し、`docs/server-modernization/phase2/operations/logs/20251205T133848Z-charts-qa.md` を上書きしてください。
> RUN_ID=`20251206T112050Z` ではローカル Outpatient mock を Playwright `route.fulfill` で server トーンに合わせて QA。`missingMaster=false` / `cacheHit=true` / `dataSourceTransition=server` を `ToneBanner` とバッジで確認し、`docs/server-modernization/phase2/operations/logs/20251206T112050Z-charts-qa.md` と `artifacts/webclient/e2e/20251206T112050Z-charts/` に保存。ORCA 実 API での再確認は認証/CORS 解消後に実施する。
> RUN_ID=`20251208T153500Z` ではローカル MSW OFF で 04C3 再検証。`/orca/claim/outpatient/mock` `/orca21/medicalmodv2/outpatient` は 404 継続（X-Trace-Id: dfd255bd-ebdb-409d-8fec-24a4e6f204db / 65267e72-0123-44c8-96f8-9bc282624355）。Reception→Charts→Patients で tone=server / resolveMasterSource=server を carry-over、telemetry `resolve_master`→`charts_orchestration` に `missingMaster=false` / `cacheHit=true` / `dataSourceTransition=server` を記録（runId=20251208T150530Z）。証跡: `docs/server-modernization/phase2/operations/logs/20251208T153500Z-integration-qa.md`、`artifacts/webclient/e2e/20251208T153500Z-integration/`、doc: `src/outpatient_ux_modernization/04C3_WEBクライアントAPI接続検証.md`。MSW ON 差分は未実施。実 API stub 反映後に同手順で再取得する。


> **Archive 移行チェック（担当: Codex, 期限: 2025-11-29）**
> - [ ] Dormant 判定と根拠リンク
> - [ ] `docs/archive/2025Q4/` への移動と README / Hub からのリンク差替
> - [ ] `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` / `DOC_STATUS.md` 備考へアーカイブ結果を反映
>
- **開発端末手順の現行/Legacy 判定**
- [ ] `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` = 現行手順（mac-dev は以降 Archive 扱い）
- [ ] `mac-dev-login.local.md` や旧 Stage 手順はアーカイブ資料として DOC_STATUS に注釈を残す

## 1. 背景
- Web クライアント関連資料は `docs/web-client/README.md` をハブとして「architecture / process / features / operations / ux / design-system」に整理されている。最新の棚卸しは `planning/phase2/DOC_STATUS.md`（Active 行: README, REPOSITORY_OVERVIEW, WEB_CLIENT_REQUIREMENTS, SERVER_MODERNIZATION_PLAN など）で管理。
- カルテ UI 変更時は `docs/web-client/ux/ux-documentation-plan.md` → `ux/charts-claim-ui-policy.md` を起点に、legacy な `ux/legacy/CHART_UI_GUIDE_INDEX.md` / `ux/legacy/ONE_SCREEN_LAYOUT_GUIDE.md` / `ux/legacy/KARTE_SCREEN_IMPLEMENTATION.md` を補足で参照する。ChartsPage 系タスクは AGENTS.md の参照ルールも順守する。
- Features カテゴリには CareMap/Lab/予約/証明書など業務別ガイドがあり、UI 改修や API 仕様変更時は関連ファイルをすべて更新する必要がある。
- Operations カテゴリ（`LOCAL_BACKEND_DOCKER.md`, `ORCA_CERTIFICATION_ONLY.md`, `LEGACY_INTEGRATION_CHECKS.md`, `TEST_SERVER_DEPLOY.md` 等）はワーカーの環境構築・検証手順の基盤。証跡や secrets の取り扱いは各 Runbook に準拠。`mac-dev-login.local.md` は歴史的資料としてのみ参照する。

## 2. 参照ドキュメントマップ
| 区分 | ドキュメント | 内容 / 役割 | 最終更新（2025-11-時点） |
| --- | --- | --- | --- |
| ハブ & 棚卸し | `docs/web-client/README.md` / `planning/phase2/DOC_STATUS.md` | 全資料ナビゲーションと Active/Dormant/Archive 管理。 | README: 2025-11-07 / DOC_STATUS: 2025-11-07 |
| アーキテクチャ | `architecture/REPOSITORY_OVERVIEW.md`<br/>`architecture/WEB_CLIENT_REQUIREMENTS.md`<br/>`architecture/SERVER_MODERNIZATION_PLAN.md` | リポジトリ構成・機能/非機能要件・サーバー計画。 | 2025-11-12 / 2025-11-12 / 2025-11-15 |
| プロセス | `process/ROADMAP.md`<br/>`process/SWING_PARITY_CHECKLIST.md`<br/>`process/API_UI_GAP_ANALYSIS.md`<br/>`process/SECURITY_AND_QUALITY_IMPROVEMENTS.md` | マイルストーンと UI/API ギャップ、セキュリティ改善。 | 2025-11-05〜11-12 |
| UX & デザイン | `ux/ux-documentation-plan.md` → `ux/reception-schedule-ui-policy.md` / `ux/patients-admin-ui-policy.md` / `ux/charts-claim-ui-policy.md`（legacy: `ux/legacy/CHART_UI_GUIDE_INDEX.md` / `ux/legacy/ONE_SCREEN_LAYOUT_GUIDE.md` / `ux/legacy/KARTE_SCREEN_IMPLEMENTATION.md`）<br/>`design-system/ALPHA_COMPONENTS.md` | ChartsPage レイアウト、レール比率、コンポーネント設計。 | 2025-11-01 / 2025-11-01 / 2025-11-01 / 2025-11-04 |
| 機能別ガイド | `features/CARE_MAP_TIMELINE.md`<br/>`features/RECEPTION_SCHEDULE_AND_SUMMARY.md`<br/>`features/FACILITY_SCHEDULE_VIEW.md`<br/>`features/LAB_RESULTS_VIEWER.md`<br/>`features/ORDER_ENTRY_DATA_GUIDE.md`<br/>`features/MEDICAL_CERTIFICATES_AND_SCHEMA.md`<br/>`features/PHASE3_STAMP_AND_ORCA.md` | CareMap／受付／予約／検査／オーダ／文書／スタンプの仕様。 | 2025-11-01〜11-08 |
| 運用・手順 | `operations/LOCAL_BACKEND_DOCKER.md`<br/>`operations/ORCA_CERTIFICATION_ONLY.md`<br/>`operations/CAREMAP_ATTACHMENT_MIGRATION.md`<br/>`operations/DEV_MSW_MOCKS.md`<br/>`operations/LEGACY_INTEGRATION_CHECKS.md`<br/>`operations/TEST_SERVER_DEPLOY.md` | ローカル環境、ログイン情報、MSW モック、統合・テスト手順。 | 2025-11-06〜11-13 |

## 3. タスクボード
- [ ] **タスクA: ハブ/棚卸し同期（担当A）**
  - [x] `docs/web-client/README.md` のカテゴリ一覧を最新化し、追加・更新した資料へ必ずリンクを追記する。（2025-11-16 RUN_ID=`20251116T170500Z`: `ux/ux-documentation-plan.md` を追記し、legacy `ux/legacy/API_SURFACE_AND_AUDIT_GUIDE.md` を補足参照に追加）
  - [ ] `planning/phase2/DOC_STATUS.md` の Web クライアント行（README / architecture 系）を確認し、最終レビュー日と担当者を 2025-11 週次へ更新。
  - [ ] `README` に追加したリンクを `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` の Web クライアント行にも反映。
  - [ ] 【完了報告必須】更新内容・参照した行番号・RUN_ID（該当なしなら `RUN_ID=NA`）を記載。
- [ ] **タスクB: UX / ChartsPage 要件精査（担当B）**
  - [ ] `ux/ux-documentation-plan.md` → `ux/charts-claim-ui-policy.md` の順に確認し、レイアウト変更や新規ガイドが必要な場合はチェックリストへタスクを追加。（legacy 資料: `ux/legacy/CHART_UI_GUIDE_INDEX.md` / `ux/legacy/ONE_SCREEN_LAYOUT_GUIDE.md` / `ux/legacy/KARTE_SCREEN_IMPLEMENTATION.md`）
  - [ ] `features/CARE_MAP_TIMELINE.md` と `design-system/ALPHA_COMPONENTS.md` を突合し、DocumentTimeline や SafetySummaryCard など共通コンポーネントの状態管理が一致しているか確認。
  - [ ] ChartsPage 関連の作業をワーカーへ渡す際は、AGENTS.md で指定された UX 資料を参照済みかどうかをチェックし、【ワーカー指示】内に参照順序を記載。
  - [ ] 進捗は `DOC_STATUS.md` の「モダナイズ/カルテ UX」行（未作成の場合は行を追加）に残す。
- [ ] **タスクC: 機能別ガイド更新（担当C）**
  - [ ] `features/*.md` を API/UI ギャップ表（`process/API_UI_GAP_ANALYSIS.md`）と突合し、未反映の仕様差分や API 対応状況を補完。
  - [ ] `features/PHASE3_STAMP_AND_ORCA.md` と ORCA 関連 Runbook の整合を確認し、ORCA 側の変更が UI に波及する場合は ORCA マネージャーと連携してタスクを再割当。
  - [ ] 新規ドキュメントを作成した場合は `docs/web-client/features/README.md` が無いため、本チェックリスト §2 と README の該当カテゴリへリンクを追加。
- [ ] マスターデータ補完ブリッジ（04計画）: RUN_ID=`20251124T073245Z`（親=`20251124T000000Z`）の SP1〜SP5 計画・実績を `docs/server-modernization/phase2/operations/logs/20251124T073245Z-webclient-master-bridge.md` に集約し、`artifacts/api-stability/20251124T000000Z/master-sync/20251124/`（hashes + diffs + schema missing）・`artifacts/e2e/20251124T073245Z/`（SP4ログ）を証跡として整備。2025-11-26T05:47:12+0900 Stage/Preview Vite stage server（`VITE_DEV_PROXY_TARGET=http://100.102.17.40:8000/openDolphin/resources` / `VITE_API_BASE_URL=http://100.102.17.40:8000/openDolphin/resources` / `VITE_DISABLE_MSW=1` + `PLAYWRIGHT_BASE_URL=https://localhost:4173`）で `WEB_ORCA_MASTER_SOURCE=server npm run e2e:orca-master` を実行。Chart master bridge が `recordPerfLog`・warning badge・監査メタ（`dataSourceTransition=snapshot→server` / `dataSource=server` / `cacheHit=false` / `missingMaster=false` / `fallbackUsed=false`）を出力し `artifacts/e2e/20251124T073245Z/sp4-main-scenarios.log` を上書きした一方、Reception/Claim は `profile==='msw'` / `test.skip` / `test.fixme` による MSW snapshot/fallback を継続して caution-tone warning banner（`missingMaster=true` / `fallbackUsed=true`）を表示しています。Stage log と raw B 周りの `node scripts/bridge-sync.mjs` による `hashes/server/{orca05,orca06,orca08}.hash`・`diffs/server-vs-msw-orca*.json` 更新は接続再開前ループ（raw B → bridge-sync → hashes/diffs → DOC_STATUS/manager checklist/worker report）で完了しており、DOC_STATUS/README/manager checklist/worker report には `artifacts/e2e/20251124T073245Z/sp4-main-scenarios.log` へのリンクを維持しています。未完: Live baseURL coverage（Reception/Claim）、Reception/Claim MSW-only coverage、warning banner tone、`dataSourceTransition` の server ルートへの変移。Next steps: (1) Live baseURL/selector/skip-fixme 条件が整ったら Stage/Preview `WEB_ORCA_MASTER_SOURCE=server VITE_DISABLE_MSW=1 PLAYWRIGHT_BASE_URL=https://localhost:4173 npm run e2e:orca-master` を再実行して `warning banner tone` と `dataSourceTransition` の変化を Stage log と `docs/server-modernization/phase2/operations/logs/20251124T073245Z-webclient-master-bridge.md#SP4` に反映、(2) `docs/managerdocs/PHASE2_WEB_CLIENT_EXPERIENCE_MANAGER_CHECKLIST.md` / `docs/web-client/README.md` へ Stage log と `artifacts/api-stability/20251124T000000Z/master-sync/20251124/` diff 再取得状況・`pvt/docinfo fixture` / warning tone 対応を追記、(3) 次回 worker report で Stage log/server diff 再取得予定・Live baseURL 準備状況・未完タスクを明記し RUN_ID/証跡を再確認、(4) raw B 更新→bridge-sync→hashes/diffs→DOC_STATUS/manager checklist/worker report のループを接続再開前に完了させ、`artifacts/api-stability/20251124T000000Z/master-sync/20251124/` の `schema missing`/counts/hashMatch も同期する。
  <br/>再検証テンプレ: raw B 更新（ORCA 特材など）をトリガーに、(1) `node scripts/bridge-sync.mjs --run-id 20251126T150000Z --date 20251124 --source server` で `artifacts/api-stability/20251124T000000Z/master-sync/20251124/hashes/server/{orca05.hash,orca06.hash,orca08.hash}` + `diffs/server-vs-msw-orca*.json` を上書きし `schema missing: artifacts/api-stability/20251124T151500Z/ab-compare/20251124T153000Z/raw/B/orca-master-generic-class.json` を確認、(2) Stage Preview/Playwright/curl を同 RUN_ID で回して `dataSourceTransition=server` ルートの移行を追跡、(3) Stage Preview: `VITE_DISABLE_MSW=1 VITE_DEV_PROXY_TARGET=http://localhost:8000/openDolphin/resources VITE_API_BASE_URL=http://localhost:8000/openDolphin/resources VITE_DEV_USE_HTTPS=1 npm run preview -- --host 0.0.0.0 --port 4173 --strictPort` で `artifacts/e2e/20251126T150000Z/stage-preview.log` を上書きして `warning banner tone=server`/`dataSourceTransition=server` を確認、(4) Playwright: `RUN_ID=20251126T150000Z VITE_DISABLE_MSW=1 VITE_DEV_PROXY_TARGET=http://localhost:8000/openDolphin/resources VITE_API_BASE_URL=http://localhost:8000/openDolphin/resources PLAYWRIGHT_BASE_URL=https://localhost:4173 npx playwright test tests/e2e/orca-master.spec.ts` で `artifacts/e2e/20251126T150000Z/playwright-orca-master.log` に Live profile `dataSource=server/runId=20251126T150000Z/missingMaster=false/fallbackUsed=false` + `warning banner tone=server`/`dataSourceTransition=server` を記録、(5) curl: admin header + eight endpoints `/resources/api/orca/master/{generic-class,generic-price,youhou,material,kensa-sort,hokenja,address,etensu}` を `master-bridge-stub-check` で叩いて `dataSourceTransition=server->fallback`/`missingMaster=true`/`fallbackUsed=true`/`runId=20251126T150000Z`/`version=20251126`/`cacheHit=false`/`warning banner tone=server` を `artifacts/e2e/20251126T150000Z/master-bridge-stub-check.log` に記録し Stage log と照合。各サイクルの RUN_ID・`artifacts/api-stability/20251124T000000Z/master-sync/20251124/hashes/server/{orca05.hash,orca06.hash,orca08.hash}`・`diffs/server-vs-msw-orca*.json`・`artifacts/e2e/20251126T150000Z/{stage-preview.log,playwright-orca-master.log,master-bridge-stub-check.log}` を DOC_STATUS 65 行・このチェックリスト 55 行・master bridge plan 86 行・worker report/issue note に反映し、`warning banner tone=server` + `dataSourceTransition=server` を追跡。<br/>現時点では raw B 更新を追いかけず document 校正と証跡整理を優先し、次の raw B 更新トリガーが感知されたら本テンプレ順で再走することを明記。
- [x] RUN_ID=`20251126T150000Z`: server stub now loads artifacts/api-stability/20251124T000000Z/master-snapshots/ (msw-fixture fallback) for `/orca/master/*`, emits `dataSourceTransition=server->snapshot|server->msw-fixture|server->fallback`, and records `missingMaster`/`fallbackUsed`. Admin `d_facility`/`d_users` seed + header auth allowed `generic-class`〜`etensu` to hit Stage Preview (`VITE_DISABLE_MSW=1 VITE_DEV_PROXY_TARGET=http://localhost:8000/openDolphin/resources VITE_API_BASE_URL=http://localhost:8000/openDolphin/resources VITE_DEV_USE_HTTPS=1 npm run preview -- --host 0.0.0.0 --port 4173 --strictPort`) and Playwright (`RUN_ID=20251126T150000Z VITE_DISABLE_MSW=1 VITE_DEV_PROXY_TARGET=http://localhost:8000/openDolphin/resources VITE_API_BASE_URL=http://localhost:8000/openDolphin/resources PLAYWRIGHT_BASE_URL=https://localhost:4173 npx playwright test tests/e2e/orca-master.spec.ts`). Stage Preview, Playwright, and the `curl` cycle were rerun in the same session; `artifacts/e2e/20251126T150000Z/{stage-preview.log,playwright-orca-master.log,master-bridge-stub-check.log}` now capture Reception/Claim `warning banner tone=server`/`dataSourceTransition=server`, Playwright’s 1 pass + 8 skip Live profile `dataSource=server/runId=20251126T150000Z/missingMaster=false/fallbackUsed=false`, and eight `curl` responses returning `dataSourceTransition=server->fallback`/`missingMaster=true`/`fallbackUsed=true`/`runId=20251126T150000Z`/`version=20251126`/`cacheHit=false`/`HTTP_STATUS:200`.<br/>`node scripts/bridge-sync.mjs --run-id 20251126T150000Z --date 20251124 --source server` was rerun after that coverage cycle, overwriting `artifacts/api-stability/20251124T000000Z/master-sync/20251124/hashes/server/{orca05.hash,orca06.hash,orca08.hash}` and `diffs/server-vs-msw-orca*.json`, while preserving `schema missing: artifacts/api-stability/20251124T151500Z/ab-compare/20251124T153000Z/raw/B/orca-master-generic-class.json` plus `auditSummary` (`serverDataSource=snapshot`/`serverMissingMaster=false`/`serverFallbackUsed=false`); DOC_STATUS 65 行・このチェックリスト 55 行・worker report の RUN_ID セクション have been updated to reference these outputs alongside `artifacts/e2e/20251126T150000Z/*`/`warning banner tone=server` events.<br/>`npm run build`（`orca-api.ts` 型整備・`AlertBanner` 定義整理・`HttpHandlerMethod.resolver` 保護・React Query `cacheTime`→`gcTime`）succeeded after the TypeScript fixes, and the new `dist` was consumed by the Stage/Preview + Playwright + `curl` verification cycle (`docs/server-modernization/phase2/notes/issue-master-bridge-build.md` has the full trace). `mvn -pl server-modernized -DskipTests compile` also succeeded because `UserModel#getRegisteredDateAsString` is back, so the Modernized runtime can keep serving `/resources/api/orca/master/*`.<br/>Next actions: (1) keep raw B → bridge-sync → hashes/diffs → DOC_STATUS/manager checklist/worker report loops running and rewrite the `artifacts/api-stability/20251124T000000Z/master-sync/20251124/` hashes/diffs every time `dataSourceTransition=server`/`missingMaster` moves toward the server route, (2) continue revalidating Reception/Claim Live coverage with `warning banner tone=server` + `dataSourceTransition=server` through Stage/Playwright/curl and overwrite `artifacts/e2e/20251126T150000Z/*`, (3) repeat `npm run build` → Stage Preview → Playwright → curl after any further TypeScript or UserModel changes so `dist`/logs stay aligned. |
- [x] Stage Preview/Playwright/curl のログ（`artifacts/e2e/20251126T150000Z/stage-preview.log` / `artifacts/e2e/20251126T150000Z/playwright-orca-master.log` / `artifacts/e2e/20251126T150000Z/master-bridge-stub-check.log`）を追加で共有し、Reception/Claim coverage で `warning banner tone=server` + `dataSourceTransition=server` へ移行するイベントを明示。今週再実行したログを上書きし、DOC_STATUS・このチェックリスト・worker report の RUN_ID セクション（65 行）にはログパス・未完タスク（raw B 差分ループ・Live coverage tone・ビルド issue）・次アクション（bridge-sync 再実行、Live coverage 再確認、修正後 Stage/Playwright/curl の再実行）を追記済み。
  - [x] Web クライアント Ops task の結果を ORCA/Server マネージャーへ共有する場合は、本チェックリストのタスクD欄に参照先を追記。→ 2025-11-16 RUN_ID=`20251116T170500Z` の UI サーフェス同期ログ（`docs/server-modernization/phase2/operations/logs/20251116T170500Z-orca-ui-sync.md`）を登録。
- [ ] `operations/LOCAL_BACKEND_DOCKER.md` と `operations/ORCA_CERTIFICATION_ONLY.md` の内容が一致しているか確認し、Secrets/認証情報の取り扱い手順を明記。
  - [ ] `operations/DEV_MSW_MOCKS.md` / `LEGACY_INTEGRATION_CHECKS.md` / `TEST_SERVER_DEPLOY.md` の手順で不足しているログ保存先や証跡をチェックし、必要に応じて `docs/server-modernization/phase2/operations/logs/` や `artifacts/` へのリンクを追加。
  - [ ] Web クライアント Ops task の結果を ORCA/Server マネージャーへ共有する場合は、本チェックリストのタスクD欄に参照先を追記。

 ## 3a. RUN_ID=20251129T120000Z（Charts 右カラム UX）
 - `docs/web-client/ux/charts-right-column-ux.md` で DocumentTimeline/WorkSurface/OrderConsole/OrcaOrderPanel の連携と ORCA バナーの `data-run-id`+`aria-live` 表示を実装要件として整理。実装完了時には `docs/server-modernization/phase2/operations/logs/20251129T120000Z-charts.md` へレビュー・メモを追記し、DOC_STATUS `Web クライアント/UX` 行に RUN_ID＋ログパスを加えてからマネージャー報告をまとめる。
 - 報告では RUN_ID=`20251129T120000Z` と本ログへのリンクを明示し、Implementation/UX チームに連携レビューと Playwright (aria-live warning banner の挙動) を含む検証追加を依頼する。
 - Implementation/UX チームとの画面レビューで `OrcaOrderPanel` の `DataSourceBanner` が `data-run-id`/`aria-live` を持つ RUN_ID=`20251129T120000Z` 表示済み、`ChartsAdminShortcutCard` と `AdminRunIdBanner` が RUN_ID=`20251129T105243Z` の `data-run-id`/deep-link ボタン(`#charts-status-deep-link`/`#admin-danger-operations`) を共通表示していることを確認。右カラムの show/hide 操作でこれらのカードが collapsed/expanded 両状態で再表示され、Admin バナーは SystemPreferences/UserAdministration の `StatusBadge` と `Button as="a"` deep-link を保持することも確認した。
- Playwright では右カラムの展開・収縮状態を切り替えたうえで `ChartsAdminShortcutCard` と `AdminRunIdBanner` の `data-run-id`/deep-linkボタンを操作するシナリオを追加検討中。show/hide を含めた検証案と deep-link（`target=_blank`）操作を本チェックリストに記録し、次回 Playwright 実装時のテストケースとして稼働させる予定。
- **Playwright ケース化計画（DocumentTimeline show/hide＋Adminバナー）**
- Implementation/UX チームには上記 RUN_ID=`20251129T120000Z`（右カラム ORCA Banner/DocumentTimeline）および RUN_ID=`20251129T105243Z`（ChartsAdminShortcutCard/AdminRunIdBanner）の deep link 設定を共有し、show/hide 切替と deep link 操作が同一 UI/レイアウトで再現されることをレビューで確認してもらう。
- 下記シナリオを Playwright チケットに記録し、Implementation/UX 共有後に自動化に着手する。
  - DocumentTimeline 右カラム全体の show/hide 操作：`DocumentTimeline` の表示・折りたたみを切り替えることで `ChartsAdminShortcutCard`/`AdminRunIdBanner` が collapsed/expanded の両状態で再描画されること、および `data-run-id`/`aria-live` 表示が変化（再読み込みの代替）せず維持されることを確認。
  - `ChartsAdminShortcutCard` と `AdminRunIdBanner` の deep link ボタン（#charts-status-deep-link、#admin-danger-operations）クリック：`target=_blank` で別タブが開き、ログ深リンク先が起動時のステータスを保持している状態を Playwright で要素取得＋遷移停止（`page.wait_for_event("popup")` 等）で検証。
  - `data-run-id` 情報および `aria-live` 通知（右カラムの ORCA banner / `AdminRunIdBanner` の live region）の表示：ARIA 変更を監視し、Show/Hold や deep link クリックによるフォーカス移動前後の変化が意図通りであることを確認。
- 今後の Playwright 自動化観点として、deep link の `href` と `target=_blank` の属性を維持しつつログパスを都度最新に差し替える方式（ログリンクが更新されてもテスト側で `data-run-id` から `logs/<RUN_ID>-*.md` を自動判定できる仕組み）をこのチェックリストに追記しておく。

## 4. 進捗確認ポイント
- README/DOC_STATUS のリンクと記載内容が一致しているか。
- ChartsPage/UX ガイドに最新レイアウト・ガード条件が反映されているか。
- Features ドキュメントと API/UI GAP 表の整合（差分がある場合はタスクを追加）。
- ローカル環境手順と実際の Secrets/ログ保管ディレクトリが一致しているか。

## 5. ワーカー指示・報告テンプレ
- 【ワーカー指示】には以下を必ず含める:
  1. 対象カテゴリ（Architecture / UX / Features / Operations）。
  2. 必読ドキュメントと参照順序。
  3. 更新後にリンクを追記するファイル（README, DOC_STATUS, 本チェックリスト）。
- 【ワーカー報告】には以下を記載:
  1. 修正ファイル一覧と行番号。
  2. RUN_ID（該当なしは `RUN_ID=NA`）。
  3. 証跡パス（スクリーンショット / artifacts / logs）。
  4. DOC_STATUS 更新有無と対象行。
  5. 追加で必要なワーカー/マネージャーへの連絡事項。

## 6. 更新ルール
- 各タスクのチェックボックスは進捗が変わった日に即更新し、日付入りコメントを残す。
- 本ファイルに記載したドキュメント一覧に追加・削除が発生した場合は、`PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` と `docs/web-client/README.md` の両方を同時に更新する。
- ChartsPage 関連の修正を開始する前に、AGENTS.md で要求されている UX ガイド参照ルールが守られているか確認する。

> 最終更新: 2025-11-14 / 担当: Codex（Web クライアント UX/Features マネージャー）
