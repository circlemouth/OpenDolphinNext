# Document Reorg Final Report

- RUN_ID: `20260414T215416Z`
- Scope: docs / README / notes / packet / handoff / prompt / reference / archive / evidence の整理
- Source policy: repository 現物のみ参照。build artifact は source-of-truth 判定に使わない

## 1. 実施概要

今回の整理では、`docs/README.md` を primary doc entry に再編し、current / workflow / reference / archive / ops-verification / evidence を明示的に分離した。`docs/implementation/orca-order-alignment/` から dated packet / prompt / closeout / recovery / review docs を外し、背景仕様は `docs/reference/`、履歴保持は `docs/archive/` へ移した。`src/discovery/` の doc-only 資産は `docs/reference/repository-history/` に集約し、root `README.md` は薄い入口へ整理した。

あわせて、`web-client/README.md` と `web-client/notes/README.md` を current contract 入口として整備し、UI 系 docs の導線を DADS reference 起点にそろえた。`artifacts/README.md` を追加し、evidence / generated を source of truth から切り離した。

## 2. 実際に変更したファイル一覧

### 新規作成
- `docs/implementation/README.md`
- `docs/reference/README.md`
- `docs/reference/orca-order-alignment/README.md`
- `docs/reference/repository-history/README.md`
- `docs/archive/README.md`
- `docs/archive/orca-order-alignment/README.md`
- `docs/architecture/repository-doc-taxonomy.md`
- `web-client/notes/README.md`
- `artifacts/README.md`
- `artifacts/doc-reorg/20260414T215416Z/*`

### 更新
- `README.md`
- `docs/README.md`
- `docs/implementation/orca-order-alignment/README.md`
- `docs/architecture/web-client-overview.md`
- `docs/web-client/ux/web-client-ui-guideline.md`
- `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md`
- `web-client/README.md`
- `web-client/notes/ui-current-contract.md`
- `docs/reference/repository-history/ライセンス_コード著者アカウント同一性時系列調査_20260313.md`

### 移動
- `src/discovery/*` -> `docs/reference/repository-history/*`
- `docs/implementation/orca-order-alignment/orca_order_alignment_authoritative_*` -> `docs/reference/orca-order-alignment/`
- `docs/implementation/orca-order-alignment/orca_order_alignment_execution_plan_checklist_self_contained_20260407.md` -> `docs/archive/orca-order-alignment/`
- `docs/implementation/orca-order-alignment/orca_order_alignment_closure_packet_20260408.md` -> `docs/archive/orca-order-alignment/`
- `docs/implementation/orca-order-alignment/orca_remaining_tasks_checklist_20260410.md` -> `docs/archive/orca-order-alignment/`
- `docs/implementation/orca-order-alignment/opendolphin_orca_codex_packet_20260413/` -> `docs/archive/orca-order-alignment/opendolphin_orca_codex_packet_20260413/`
- `docs/implementation/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/` -> `docs/archive/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/`
- `docs/implementation/orca-order-alignment/opendolphin_orca_recovery_packet_r3_20260413/` -> `docs/archive/orca-order-alignment/opendolphin_orca_recovery_packet_r3_20260413/`
- `docs/implementation/orca-order-alignment/opendolphin_orca_review_research_prompts_20260413/` -> `docs/archive/orca-order-alignment/opendolphin_orca_review_research_prompts_20260413/`

## 3. keep / move / delete

### executed
- `keep`: `docs/README.md` を全体索引の正本として維持。理由は enduring docs と workflow docs の入口を一箇所に集約するため。
- `keep`: `docs/implementation/orca-order-alignment/README.md` を workstream index として維持。理由は active workflow 入口を消さずに current contract から切り離すため。
- `move`: ORCA packet / prompt / closeout / recovery / review docs を `docs/archive/orca-order-alignment/` へ移動。理由は current 導線から外し、stale duplicate を減らすため。
- `move`: authoritative spec / tables を `docs/reference/orca-order-alignment/` へ移動。理由は current workflow ではなく背景仕様として残すため。
- `move`: `src/discovery/` の doc-only 資産を `docs/reference/repository-history/` へ移動。理由は doc-only reference を docs taxonomy に収めるため。
- `keep`: DADS reference は `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` を唯一の enduring reference として維持。理由は stale copy を増やさないため。
- `delete`: current entry から packet / closeout / review links を削除。理由は current docs との混線を止めるため。

### deferred
- `keep/delete`: `web-client/package-lock.json` と `web-client/pnpm-lock.yaml` の二重 lockfile は、本タスクでは報告のみ。workflow は npm 前提なので片側整理が必要。
- `keep/delete`: reviewer 提出の正本は `create-reviewer-submission-packet.sh` と validator を keep。`create-review-archive.sh` は delete 候補、`create-review-package.sh` と `create-review-bundles.sh` は用途再判定が必要。
- `move/delete`: tracked `artifacts/**` と `web-client/artifacts/**` は repo 外 evidence storage か untracked 出力へ移す候補。tracked artifact が多く、current docs と review を汚染している。
- `move`: `ops/tests/api-smoke-test` は CI 資産ではなく manual harness として見えるため、将来的に manual/ops 専用位置へ寄せる余地がある。
- `keep/move`: `server-modernized/tools/flyway/sql` を唯一の canonical schema source として維持しつつ、`ops/db/local-baseline` は manual seed 専用へ格下げ整理が必要。

## 4. 実行順序

### 今回実行した順序
1. tracked file inventory と topic 別 canonical map を作成
2. `docs/implementation/orca-order-alignment/` と `src/discovery/` の実態を分類
3. `git mv` で reference / archive / repository-history へ移動
4. `docs/README.md`、`README.md`、`web-client/README.md`、`web-client/notes/README.md`、UI 導線 docs を更新
5. `artifacts/README.md` と report 一式を作成
6. stale path grep と doc link check を実行
7. deliverable zip を生成

### repo-wide follow-up として推奨する順序
1. lockfile 正本を 1 つに決める
2. reviewer packaging tool の正本 / deprecated を整理する
3. tracked artifacts を repo 外または untracked 出力へ移す
4. `ops/tests/api-smoke-test` の manual / CI 境界をファイル配置で整える
5. `ops/db/local-baseline` を Flyway canonical と混線しない manual seed 領域へ整理する

## 5. source-of-truth matrix 要約

- repo / docs index: `docs/README.md`
- manager current state: `docs/managerdocs/`
- architecture summary: `docs/architecture/`
- runtime contracts: `docs/contracts/`
- runbooks: `docs/runbooks/`
- operations: `docs/operations/`
- releases: `docs/releases/`
- web-client current contract: `web-client/README.md` と `web-client/notes/`
- UI / UX reference: `docs/web-client/ux/` と `docs/web-client/architecture/`
- active workflow docs: `docs/implementation/`
- legacy reference: `client/`, `server/`, `ext_lib/`, `docs/reference/repository-history/`
- evidence / generated: `artifacts/`

詳細表は `source-of-truth-matrix.md` を参照。

## 6. current / workflow / reference / evidence の最終区分

- current: `docs/managerdocs/`, `docs/contracts/`, `docs/architecture/`, `docs/runbooks/`, `docs/operations/`, `docs/releases/`, `docs/web-client/`, `web-client/notes/`
- workflow: `docs/implementation/README.md`, `docs/implementation/orca-order-alignment/README.md`
- reference: `docs/reference/orca-order-alignment/`, `docs/reference/repository-history/`
- archive: `docs/archive/orca-order-alignment/`
- evidence: `artifacts/`, `artifacts/doc-reorg/20260414T215416Z/`

## 7. broken link / index 整合性の検証結果

- `bash server-modernized/tools/ci/check-doc-links.sh` を実行し、エラー出力はなかった
- `rg -n "implementation/orca-order-alignment/(opendolphin_orca|orca_order_alignment_|orca_remaining_tasks)|src/discovery|webclient_screen_structure_plan" README.md docs web-client/README.md web-client/notes` で stale path を確認し、current entry に残る broken path は除去した
- `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md` の欠落参照は現行 docs へのリンクへ置き換えた
- `docs/README.md` は packet 群の直リンクを外し、current / workflow / reference / archive / ops-verification / evidence を明示した

## 8. 残課題とリスク

- `tests/e2e/README.md` は `artifacts/api-stability/...` を案内するが、CI 実体は `artifacts/validation/e2e/...` であり、manual / CI artifact path の不一致が残る
- tracked artifact が多く、review / diff / handoff ノイズが大きい
- lockfile 二重管理、reviewer packaging script 並立、Flyway と local baseline の説明差分は non-doc structural issue として残る
- archive 配下の dated packet には `/mnt/data/...` のような当時の実行環境メモが残るが、current entry からは切り離した

## 9. zip 配置先

- `artifacts/doc-reorg/20260414T215416Z/repo-doc-reorg-deliverable.zip`
