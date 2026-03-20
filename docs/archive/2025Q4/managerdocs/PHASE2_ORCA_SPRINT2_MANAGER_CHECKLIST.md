# Phase2 ORCA Sprint2 マネージャー作業チェックリスト（2025-11-19）

> **参照開始順**
> 1. `AGENTS.md`
> 2. `docs/web-client/README.md`（Web Client Hub）
> 3. `docs/server-modernization/phase2/domains/ORCA_REST_IMPLEMENTATION_NOTES.md` §6
> 4. `docs/managerdocs/PHASE2_ORCA_SPRINT2_MANAGER_CHECKLIST.md`
>
> **報告テンプレ（RUN_ID / 証跡パス / DOC_STATUS 行）**
> - RUN_ID: `RUN_ID=<ID>`（ドキュメントのみは `RUN_ID=NA`）
> - 証跡パス: `docs/server-modernization/phase2/domains/...`, `docs/server-modernization/phase2/operations/logs/...`, `artifacts/...` など
> - DOC_STATUS 行: `docs/web-client/planning/phase2/DOC_STATUS.md`「モダナイズ/外部連携（ORCA Sprint2）」行の更新内容
>
> **Archive 移行チェック（担当: Codex, 期限: 2025-11-29）**
> - [ ] Dormant 判定ログ
> - [ ] `docs/archive/2025Q4/` へ移行しスタブ差替
> - [ ] `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` / `DOC_STATUS.md` 備考へアーカイブ記録
>
- **開発端末手順の現行/Legacy 判定**
- [ ] `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` = 現行手順（Sprint2 CRUD 手順の前提確認）
- [ ] `mac-dev-login.local.md` = Legacy / Archive（DOC_STATUS と同期）

## 1. 背景
- Sprint2 設計情報は `docs/server-modernization/phase2/domains/ORCA_REST_IMPLEMENTATION_NOTES.md` §6 を一次情報として整備済み。
- `MODERNIZED_API_DOCUMENTATION_GUIDE.md` §3.2 から上記節へアンカーされ、`DOC_STATUS.md` 行 25 にも Active 記録あり。
- 現在のマネージャー指示は、ORCA ラッパー実装／Runbook 連携／進捗台帳の同期を確実にすることが目的。
- 2025-11-20 時点では PHR Phase-C/D/E RUN_ID=`20251121TrialPHRSeqZ1` を ORCAcertification-only 接続（`docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` 参照）で再定義済。公式案内は `docs/server-modernization/phase2/operations/assets/orca-trialsite/raw/trialsite.md` を参照し、「新規登録／更新／削除 OK」＋ CRUD ログ採取を前提とする。証跡は `docs/server-modernization/phase2/operations/logs/20251121-phr-seq-trial.md` / `artifacts/orca-connectivity/20251121TrialPHRSeqZ1/` に集約されており、Sprint2 側でもタスクC（棚卸し）で `DOC_STATUS.md` W22 行との整合を確認する。

## 2. 進行タスク一覧
- [x] **タスクA: Sprint2 アンカー反映** — `API_PARITY_MATRIX.md` と `PHASE2_PROGRESS.md` の ORCA 行を Sprint2 設計アンカーへ差し替える。完了条件: 両ファイルから §6 各 API へ直接ジャンプでき、`DOC_STATUS.md` 備考に「アンカー更新済（2025-11-14）」追記。（完了: 2025-11-14 / RUN_ID=NA）
  - [ ] `API_PARITY_MATRIX.md` の Matrix No.18/8/9/10/14/17/35 等へ `Sprint2設計` リンク追記。
  - [ ] `PHASE2_PROGRESS.md` ORCA セクションへ「参照: ORCA_REST_IMPLEMENTATION_NOTES §6」脚注追加。
  - [ ] `DOC_STATUS.md` 行 25 の備考へタスク完了メモを反映。
- [x] **タスクB: RUN_ID タグ＋証跡テンプレ整備** — `ORCA_API_STATUS.md` に RUN_ID を明示し、`ORCA_CONNECTIVITY_VALIDATION.md` §4.3/§4.4 を Sprint2 証跡テンプレと同期。完了条件: 全対象 API に `[RUN_ID=...]` 表記と証跡パス、Runbook 表に保存ファイル指示と RUN_ID 記入欄を追加、`DOC_STATUS.md` に反映メモ。（完了: 2025-11-14 / RUN_ID=テンプレ）
  - [ ] `ORCA_API_STATUS.md` Matrix 行へ RUN_ID と `logs/...` 参照を追記。
  - [ ] `ORCA_CONNECTIVITY_VALIDATION.md` §4.3/§4.4 表・手順へ `httpdump/`, `trace`, `RUN_ID` 記入欄などを補強。
  - [ ] `DOC_STATUS.md` 備考へ「RUN_ID タグ整備 / テンプレ同期済」追記。
- [x] **タスクC: DOC_STATUS 運用チェック** — 2025-11-16 (RUN_ID=`20251116T170500Z`) に Web クライアント UI サーフェス更新を反映し、`DOC_STATUS.md` 行 25 / `MODERNIZED_API_DOCUMENTATION_GUIDE.md` §5 に本ログ（`docs/server-modernization/phase2/operations/logs/20251116T170500Z-orca-ui-sync.md`）と REST_API_INVENTORY UI ステータス列の整備を記録。
- [x] `DOC_STATUS.md` 行 25: ステータス Active / 最終レビュー **2025-11-16** / 備考へ「RUN_ID=20251116T170500Z, evidence=docs/server-modernization/phase2/operations/logs/20251116T170500Z-orca-ui-sync.md, REST_API_INVENTORY UI ステータス列と API_UI_GAP §0 追加」を追記済み。
  - [ ] `MODERNIZED_API_DOCUMENTATION_GUIDE.md` §5 へ今回の棚卸し結果メモ（必要な場合）。
  - [ ] `docs/web-client/README.md` ORCA リンク整合チェック（必要時更新）。
- [x] **タスクD: ORCA-01 `/orca/inputset` SQL 修正** — `inputcd` の WHERE 句を括弧で明示し、SQL 文字列ユニットテストを追加。証跡: `docs/server-modernization/phase2/operations/logs/20251219T113948Z-orca-01-inputset-sql.md` / 成果物: `src/server_modernized_full_completion_phase2/04_orca_master_api/ORCA_01_inputset_sql修正.md`。
- [x] **タスクE: ORCA-02 `/orca/stamp/{setCd,name}` date パラメータ追加** — `date` クエリで有効期間判定を指定可能化し、既存の第3要素指定は後方互換で維持。証跡: `docs/server-modernization/phase2/operations/logs/20251219T131008Z-orca-02-stamp-date.md` / 成果物: `src/server_modernized_full_completion_phase2/04_orca_master_api/ORCA_02_stamp_dateパラメータ追加.md`。
- [x] **タスクF: ORCA-03 `/orca/tensu/shinku` レスポンス拡充** — `taniname` / `ykzkbn` / `yakkakjncd` を含む列構成で `/orca/tensu/name` と整合。証跡: `docs/server-modernization/phase2/operations/logs/20251219T133053Z-orca-03-tensu-shinku.md` / 成果物: `src/server_modernized_full_completion_phase2/04_orca_master_api/ORCA_03_tensu_shinkuレスポンス拡充.md`。
- [x] **タスクG: ORCA-05 `/orca/master/generic-class|generic-price|youhou|material|kensa-sort` 実装** — DTO/監査メタ/ページング/契約テストを整備。証跡: `docs/server-modernization/phase2/operations/logs/20251219T140028Z-orca-05-master-generic.md` / 成果物: `src/server_modernized_full_completion_phase2/04_orca_master_api/ORCA_05_master_generic系列実装.md`。
- [x] **タスクH: ORCA-06 `/orca/master/hokenja` `/orca/master/address` 実装** — 保険者/住所 DTO と監査ログ（404/503/空レス差分）を整備。証跡: `docs/server-modernization/phase2/operations/logs/20251219T144408Z-orca-06-hokenja-address.md` / 成果物: `src/server_modernized_full_completion_phase2/04_orca_master_api/ORCA_06_hokenja_address実装.md`。
- [ ] 2025-11-20 追記: `DOC_STATUS.md` W22 行（ORCA PHR タスク）に登録された RUN_ID=`20251121TrialPHRSeqZ1`（Trial CRUD ベース）のステータスと `docs/server-modernization/phase2/operations/logs/2025-11-21-phr-seq-trial.md` を突合し、「新規登録／更新／削除 OK（トライアル環境でのみ）」表記と CRUD ログ反映可否を確認。行 25 の備考へ Trial 切替と残課題を明記。

## 3. 進捗更新テンプレ（ワーカー報告）
- `【ワーカー報告】` に以下を必ず含める。
  1. 更新ファイル一覧（例: `docs/server-modernization/phase2/domains/API_PARITY_MATRIX.md`）。
  2. 関連 RUN_ID（ドキュメントのみの場合は `RUN_ID=NA` と明記）。
  3. 証跡パス（`logs/...`, `artifacts/...`, diff スクリーンショット等）。
  4. 未完了項目/フォローアップ（例: 次回 RUN_ID 採取予定）。

## 4. 今後の運用
- タスクA/B/C のステータスが変わるたび本ファイルのチェックボックスを更新し、次アクションを追記する。
- 新規タスクが派生した場合は本節に追加し、`DOC_STATUS.md` 行 25 の備考と整合を保つ。
- 週次棚卸しでこのチェックリストを確認し、必要に応じてログ取得計画やサポート問い合わせ（`PHASE2_PROGRESS.md` W39）へリンクを張る。

## 5. 参照ドキュメントマップ
| 種別 | ドキュメント | 役割 / 更新トリガ |
| --- | --- | --- |
| 設計一次情報 | `docs/server-modernization/phase2/domains/ORCA_REST_IMPLEMENTATION_NOTES.md` §6 | Sprint2 API スコープと DTO。タスクA実施時は必ず該当節を更新。 |
| パリティ管理 | `docs/server-modernization/phase2/domains/API_PARITY_MATRIX.md` | 1:1 対応状況と Matrix No.。リンク整備後も数値が変わったら再集計。 |
| Runbook / 証跡 | `docs/server-modernization/phase2/operations/ORCA_API_STATUS.md`<br/>`docs/server-modernization/phase2/operations/ORCA_CONNECTIVITY_VALIDATION.md` | RUN_ID 表と Runbook。タスクBで RUN_ID 記入欄を同期。 |
| マスターデータギャップ | `docs/server-modernized/phase2/verification/00_ORCA_MASTER_DATA_GAP_REPORT.md`<br/>`docs/server-modernization/phase2/operations/logs/20251123T135709Z-orca-master-gap.md`<br/>`docs/server-modernization/phase2/notes/MODERNIZED_SERVER_GAP_TRACKER_20251116T210500Z.md` | ORCA-05〜08 の根拠と ETA/オーナー管理。REST 追加や UI 影響確認時に参照。 |
| Stub / 型スケルトン | `artifacts/api-stability/20251123T130134Z/schemas/`<br/>`web-client/src/types/orca.ts` | ORCA-05〜08 用の fixture / 型スタブ。実装・実測後に差し替え、`API_PARITY_MATRIX.md` と整合を取る。 |
| ドキュメントハブ | `docs/server-modernization/phase2/operations/MODERNIZED_API_DOCUMENTATION_GUIDE.md` §3.2/§5 | API ドキュメント集約と運用ルール。タスクCで §5 の棚卸しメモを更新。 |
| 棚卸し / クロスリンク | `docs/web-client/planning/phase2/DOC_STATUS.md` 行 25<br/>`docs/managerdocs/PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` | Sprint2 行のステータスとマネージャー割当表。更新時は両方を同期。 |

> 表に載っていない資料を参照する場合は、追加後に `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` と本ファイルの双方を更新し、チェックボックスへコメントを残す。

> 最終更新: 2025-11-19 / 担当: Codex（Phase2 ORCA 連携マネージャー）
