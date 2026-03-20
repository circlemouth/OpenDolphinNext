# Phase2 マネージャー割当オーバービュー（2025-11-16）

本ドキュメントは Web クライアント／モダナイズ版サーバー開発に関わる資料を領域ごとにグルーピングし、担当マネージャーと一次参照先を即座に確認できるようにするための索引です。各領域のマネージャーは、該当チェックリストとここで列挙したドキュメントを常に同期させ、棚卸し台帳 `docs/web-client/planning/phase2/DOC_STATUS.md` に結果を反映してください。

> **Legacy/Archive（参照のみ・新規追加禁止, RUN_ID=`20251203T203000Z`）** Phase2 はロールオフ済み。`docs/server-modernization/phase2/PHASE2_DOCS_ROLLOFF.md` を経由し、現行ワークは `docs/DEVELOPMENT_STATUS.md` へ誘導。証跡: `docs/server-modernization/phase2/operations/logs/20251203T203000Z-phase2-legacy-mark.md`

## Phase2 ガバナンス必読チェーン

> **Phase2 ガバナンス必読チェーン / 接続・RUN 運用共通ルール**  
> 1. `AGENTS.md` → `docs/web-client/README.md` → `docs/server-modernization/phase2/INDEX.md` → `docs/managerdocs/PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` → 各領域チェックリストの順で参照・更新し、同一 RUN_ID を連携する。  
> 2. WebORCA 接続先・認証情報は `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` を参照する運用とし、mac-dev ログイン手順は Archive 扱いとする。標準は WebORCA Trial の Basic 認証 + XML(UTF-8) で、証明書は不要。  
> 3. RUN_ID は `YYYYMMDDThhmmssZ` 形式を採用し、指示・README・DOC_STATUS・ログ・証跡ディレクトリのすべてで同一値を共有する。観点ごとに派生 RUN_ID を使う場合は親 RUN_ID を明示し、ログ先頭と備考欄へ併記する。  
> 4. DOC_STATUS 更新は (a) 最終コミット確認 → (b) Active/Dormant/Archive 判定 → (c) 備考に RUN_ID / 証跡パスを追記 → (d) ハブドキュメントへ同日付反映、の順で行い、完了報告前にチェック。  
> 5. Legacy サーバー/クライアントは参照専用アーカイブであり、差分検証のためにのみ起動可（保守・稼働維持作業は禁止）。

RUN_ID=`20251219T062549Z` で参照チェーンを再確認し、ハブ文書の RUN_ID を統一。証跡: `docs/web-client/planning/phase2/logs/20251219T062549Z-runid-governance.md`。
RUN_ID=`20251219T063136Z` で DOC_STATUS 棚卸しとハブ同期を実施。証跡: `docs/web-client/planning/phase2/logs/20251219T063136Z-doc-status-hub-sync.md`。
RUN_ID=`20251219T113948Z` で ORCA-01 `/orca/inputset` SQL 修正とテスト追加を実施。証跡: `docs/server-modernization/phase2/operations/logs/20251219T113948Z-orca-01-inputset-sql.md`。
RUN_ID=`20251219T125123Z` で DDL 変換警告と Agroal クラスロード警告を解消。証跡: `docs/server-modernization/phase2/operations/logs/20251219T125123Z-ddl-agroal-warn-fix.md`。
RUN_ID=`20251219T140028Z` で ORCA-05 `/orca/master/generic-class|generic-price|youhou|material|kensa-sort` を実装。証跡: `docs/server-modernization/phase2/operations/logs/20251219T140028Z-orca-05-master-generic.md`。
RUN_ID=`20251219T144408Z` で ORCA-06 `/orca/master/hokenja` `/orca/master/address` を実装。証跡: `docs/server-modernization/phase2/operations/logs/20251219T144408Z-orca-06-hokenja-address.md`。
RUN_ID=`20251219T131008Z` で ORCA-02 `/orca/stamp/{setCd,name}` date パラメータ追加を実施。証跡: `docs/server-modernization/phase2/operations/logs/20251219T131008Z-orca-02-stamp-date.md`。
RUN_ID=`20251219T133053Z` で ORCA-03 `/orca/tensu/shinku` レスポンス拡充（`taniname` / `ykzkbn` / `yakkakjncd`）を記録。証跡: `docs/server-modernization/phase2/operations/logs/20251219T133053Z-orca-03-tensu-shinku.md`。
RUN_ID=`20251219T223000Z` で ORCA-02 `/orca/stamp/{setCd,name}` date 追補回収（ドキュメント/最小確認）を実施。証跡: `docs/server-modernization/phase2/operations/logs/20251219T223000Z-orca-02-stamp-date-followup.md`。

## 1. 機能別マッピング（EMR 通信の 2 本柱）

機能単位でタスクを切り出し、電子カルテサーバーを中心とした 2 つの通信ラインで管理します。

| 機能領域 | サブ領域 / 役割 | 主要ドキュメント / ログ | マネージャーチェックリスト | 主なアウトプット |
| --- | --- | --- | --- | --- |
| 電子カルテサーバー ↔ ORCA 通信 | ORCA 接続実測（RUN 管理） | `docs/server-modernization/phase2/operations/ORCA_CONNECTIVITY_VALIDATION.md`<br/>`docs/server-modernization/phase2/operations/ORCA_API_STATUS.md`<br/>`docs/server-modernization/phase2/operations/logs/2025-11-15-orca-connectivity.md` ほか | `docs/managerdocs/PHASE2_ORCA_CONNECTIVITY_MANAGER_CHECKLIST.md` | WebORCA トライアル環境での DNS/TLS・CRUD 実測、`RUN_ID` 発行、証跡ログ整備。doctor seed 欠落や HTTP405 のブロッカー整理も同チェックリストで一元管理。 |
| 電子カルテサーバー ↔ ORCA 通信 | ORCA Demo/Dolphin/PHR ギャップ解消 | `docs/server-modernization/phase2/domains/ORCA_REST_IMPLEMENTATION_NOTES.md`<br/>`docs/server-modernization/phase2/domains/API_PARITY_MATRIX.md`<br/>`docs/server-modernization/phase2/operations/logs/2025-11-15-phr-seq-phaseAB.md`<br/>`docs/server-modernization/phase2/operations/logs/2025-11-21-phr-seq-trial.md`<br/>`docs/server-modernization/phase2/operations/logs/2025-11-21-phr-seq-phaseCDE.md`<br/>`docs/server-modernization/phase2/operations/logs/20251116T164400Z-status-sync.md` | `docs/managerdocs/PHASE2_ORCA_PHR_GAP_MANAGER_CHECKLIST.md` | PHR Phase-A/B/C/D/E の連携 RUN、PKCS#12 配布、ギャップ一覧更新。Worker-A（RUN_ID=`20251121TrialPHRSeqZ1-A/B`）の **Trial再実測完了** と Worker-B（RUN_ID=`20251121TrialPHRSeqZ1-CDE`）の **Trial通信不可だが実装済** を `DOC_STATUS` W22 行・エスカレーションログと同期し、Trial CRUD ログ (`artifacts/orca-connectivity/`) へリンク。 |
| 電子カルテサーバー ↔ ORCA 通信 | ORCA Sprint2（ラッパー API 設計/棚卸し） | `docs/server-modernization/phase2/domains/ORCA_REST_IMPLEMENTATION_NOTES.md` §6<br/>`docs/server-modernization/phase2/operations/MODERNIZED_API_DOCUMENTATION_GUIDE.md`<br/>`docs/server-modernization/phase2/operations/ORCA_API_STATUS.md`<br/>`docs/server-modernized/phase2/verification/00_ORCA_MASTER_DATA_GAP_REPORT.md`<br/>`docs/server-modernization/phase2/notes/MODERNIZED_SERVER_GAP_TRACKER_20251116T210500Z.md`<br/>`artifacts/api-stability/20251123T130134Z/schemas/`（ORCA-05〜08 fixture） | `docs/managerdocs/PHASE2_ORCA_SPRINT2_MANAGER_CHECKLIST.md` | API ラッパー実装、RUN_ID タグ管理、`API_PARITY_MATRIX.md`／`DOC_STATUS.md` 行25の更新、証跡テンプレ同期。 |
| 電子カルテサーバー ↔ Web クライアント 通信 | Web クライアント UI / UX / Feature ハンドオフ | `docs/web-client/README.md`（カテゴリ別ハブ）<br/>`docs/web-client/architecture/PHASE2_SYSTEMS_ALIGNMENT.md`<br/>`docs/web-client/ux/ux-documentation-plan.md` → `docs/web-client/ux/charts-claim-ui-policy.md`（legacy: `docs/web-client/ux/legacy/CHART_UI_GUIDE_INDEX.md` / `ux/legacy/ONE_SCREEN_LAYOUT_GUIDE.md` / `ux/legacy/KARTE_SCREEN_IMPLEMENTATION.md`）<br/>`docs/web-client/features/*.md`<br/>`docs/web-client/operations/*.md` | `docs/managerdocs/PHASE2_WEB_CLIENT_EXPERIENCE_MANAGER_CHECKLIST.md` | カルテ UI 改修・UX ガイド同期・運用 Runbook 更新・ORCAcertification 方針のレビュー。Web クライアントでの ORCA 連携 UX 調整もここで追う。 |
| 電子カルテサーバー ↔ Web クライアント 通信 | サーバーモダナイズ基盤（Foundation / Legacy） | `docs/server-modernization/phase2/INDEX.md`<br/>`docs/server-modernization/legacy-server-modernization-checklist.md`（Archive: `docs/archive/2025Q4/server-modernization/phase2/operations/...`）<br/>`docs/server-modernization/phase2/foundation/*.md`<br/>`ops/modernized-server/docker/configure-wildfly.cli` | `docs/managerdocs/PHASE2_SERVER_FOUNDATION_MANAGER_CHECKLIST.md` | Jakarta EE 10 ギャップ、依存更新、WildFly CLI 差分、ORCA cert 方針のブロッカー共有（Docker 未導入など）。Web クライアントとの API 契約維持がゴール。 |

これにより、ORCA 側と Web クライアント側でそれぞれ優先順位を付けやすくなり、ワーカー指示も機能単位で発行できます。横断的な課題が出た場合は、該当する機能領域を二重チェックにせず、上記表のサブ領域を参照して調整してください。

### W22 週次備考（2025-11-21）

| 週次 | 担当領域 | 備考 |
| --- | --- | --- |
| W22 | ORCA Demo/Dolphin/PHR ギャップ | `DOC_STATUS.md` W22 行に 4 本の派生 RUN（`20251116T210500Z-{E1,E2,E3}` / `…-E2` / `…-E3`）を追記し、PHR REST 証跡、予約/受付 Trial 実測、MML Runbook 更新を `docs/server-modernization/phase2/notes/external-api-gap-20251116T111329Z.md` / `MODERNIZED_SERVER_GAP_TRACKER_20251116T210500Z.md` と同期。Archive 済みテンプレ (`2025-11-14-phr-plan.md`) は `docs/archive/2025Q4/...` へ移し、残課題（Trial 404/405 解除、ORMaster DNS/FW、MML 実測）を備考に保持。 |

> **メモ**: 追加でマネージャーを任命する場合は、本表の該当機能領域（ORCA 通信 or Web クライアント通信）を明示し、対応するサブ領域行を追加してから `DOC_STATUS.md` へ Active 行を登録してください。

## 2. 機能別運用ポイント

### 電子カルテサーバー ↔ ORCA 通信
- RUN_ID と証跡は `docs/server-modernization/phase2/operations/logs/<RUN_ID>-orca-*.md` に集約し、`ORCA_CONNECTIVITY_VALIDATION.md` と `ORCA_API_STATUS.md` の双方へリンクする。
- Trial サーバーでの CRUD 実行結果（200/40x/エラーコード）は `API_PARITY_MATRIX.md` と `PHASE2_ORCA_SPRINT2_MANAGER_CHECKLIST.md` でダブルチェックし、`PHASE2_ORCA_PHR_GAP_MANAGER_CHECKLIST.md` にも共有する。
- API 実装や PHR ギャップなど、ORCA 側の判断が必要なタスクは、上記 3 チェックリストのいずれかを親にし、ワーカー報告をまとめる。

### 電子カルテサーバー ↔ Web クライアント 通信
- Web クライアント側の UI / API 改修は `PHASE2_WEB_CLIENT_EXPERIENCE_MANAGER_CHECKLIST.md` に集約し、`docs/web-client/README.md` と `docs/web-client/architecture/PHASE2_SYSTEMS_ALIGNMENT.md` を常に同期する。
- サーバー基盤変更（Jakarta EE 10 対応、WildFly CLI など）は `PHASE2_SERVER_FOUNDATION_MANAGER_CHECKLIST.md` でトラッキングし、Web クライアントから利用する API に影響する場合は即座に `PHASE2_WEB_CLIENT_EXPERIENCE_MANAGER_CHECKLIST.md` へ派生タスクを作る。
- Web クライアントとの通信品質（排他制御、ロングポーリング、ORCA cert 方針）は `docs/web-client/operations/` を参照し、Runbook 更新を両チェックリストで相互レビューする。

## 3. 棚卸し・報告ルール
- すべてのマネージャーは、該当領域の作業を開始/完了したら `docs/web-client/planning/phase2/DOC_STATUS.md` の行を更新し、`備考` 欄に最新の RUN_ID／ログパス／証跡ディレクトリを記す。
- 【ワーカー指示】発行時は、本表の「開発領域」「主要ドキュメント」を引用し、参照順序・保存先・報告テンプレを明記すること。
- 【ワーカー報告】を受けたら、担当マネージャーは自分のチェックリストに反映し、本表と DOCTYPE のリンク切れがないか確認する。

## 4. 運用手順
1. マネージャーは担当領域のチェックリストを最新化し、完了条件・証跡・依存関係を明示する。
2. 新規資料を作成した場合は、該当領域の行に当該資料を追記し、`docs/web-client/README.md` または `docs/server-modernization/phase2/INDEX.md` にもリンクを追加する。
3. 週次レビュー前に、本表と各チェックリストの「進捗確認ポイント」を対照し、漏れがあればチェックボックスやタスクを追加する。
4. 廃止予定資料は `DOC_STATUS.md` で Dormant/Archive 判定を行い、結果を本表へ反映する（Archive 移行時は備考にアーカイブ先を記載）。

## 5. 連絡テンプレ（マネージャー向け）
- 【ワーカー指示】の先頭で **担当領域名** と本表内の **主要ドキュメント** を列挙する。
- 指示内の「更新必須ドキュメント一覧」をチェックリストへコピーし、完了時に ✔ を付ける。
- 報告受領後 1 営業日以内に、自分のチェックリストと `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` を更新して整合させる。

> 最終更新: 2025-11-16 / 担当: Codex（Phase2 ドキュメント統括）
