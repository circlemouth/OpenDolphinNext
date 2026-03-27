# Codex Automation Orchestration（現行）

- 更新日: 2026-03-27
- RUN_ID: 20260327T063611Z

> 本ディレクトリは、`common` 廃止・公開面整理・品質ゲート強制までを、**メインエージェントがサブエージェントを順次召喚して処理する** ための現行 automation 導線です。
> 旧 `codex_automation_workplan_revised.md` 系は Legacy/Archive です。本件の進捗判定には使いません。

## 参照優先順位
1. `docs/DEVELOPMENT_STATUS.md`
2. `AGENTS.md` / `GEMINI.md`
3. `docs/server-modernization/README.md`
4. 本ファイル
5. `codex_automation_orchestration_plan.md`
6. `codex_automation_master_prompt.txt`
7. `prompts/` 配下の task prompt

## 実行方式
- 毎回の実行主体は **メインエージェント** とする。
- メインエージェントは `codex_automation_orchestration_plan.md` から未完了先頭タスクを 1 件だけ選ぶ。
- メインエージェントは対応する task prompt を添えて **`【ワーカー指示】` 形式でサブエージェントを 1 体だけ召喚** する。
- サブエージェントは担当タスクの実装・テスト・必要最小限の文書更新案を実施し、**`【ワーカー報告】` 形式**で返す。
- メインエージェントは結果をレビューし、必要なら同一サブエージェントへ追加修正を指示する。
- メインエージェント自身が最終検証、計画書更新、実行ログ作成を行ってから終了する。
- `pom.xml`、`OpenDolphinRestApplication.java`、`README.md`、`WebXmlEndpointExposureTest.java` で衝突しやすいため、原則は 1 体運用とする。
- ただし cleanup track 完了後の phase3 では、WS0 起点で非衝突が確定した WS1〜WS8 を最小限併行実行可。

## 収録物
- `codex_automation_orchestration_plan.md`
  - 現行の task order、完了条件、検証コマンド、更新ルール。
- `codex_automation_master_prompt.txt`
  - 毎回メインエージェントへ渡す共通 prompt。
- `prompts/A01_*.txt` 〜 `prompts/A10_*.txt`
  - 未完了先頭タスクごとにサブエージェントへ渡す task prompt。
- `prompts/phase3/*.md`
  - Phase3 継続作業向けの orchestrator / workstream prompt pack（WS0〜WS8）。
- `docs/development/supporting/phase3_wave2_prompt_pack/README.md`
  - static-analysis Wave 2 の現行支援資料。
- `docs/development/supporting/phase3_wave3_prompt_pack/README.md`
  - static-analysis Wave 3 の現行支援資料。
- `docs/development/supporting/phase3_wave4_prompt_pack/README.md`
  - static-analysis Wave 4 の現行支援資料。
- `prompts/phase3/WS0_parallel_orchestrator_prompt.md`
  - cleanup track 完了後の現行継続タスクの起点となるオーケストレーター prompt。
- `logs/README.md`
  - 実行ログの命名規則と最低記録項目。

## 現行継続タスク
- cleanup track の `A01`〜`A10` は完了。現行で実行する内容は `prompts/phase3/WS0_parallel_orchestrator_prompt.md` を起点に、`WS1`〜`WS8` を必要に応じて並行実施します。
- 実行順の正本は `codex_automation_orchestration_plan.md` を参照し、`prompts/phase3` 側の進捗は plan の更新と logs/ の記録で管理します。

## 運用ルール
- 1 実行 = 1 ブランチ = 1 PR = 1 タスク。
- 前段タスクが `main` に反映される前に次タスクへ進まない。
- サブエージェントは task prompt の責務外へスコープを広げない。
- サブエージェントの返却必須項目は「実施内容 / 変更ファイル / 実行コマンド / テスト結果 / blocker / plan 更新要否」とする。
- blocker 発生時はサブエージェントで打ち切らず、メインエージェントが blocker を整理して計画書とログへ残す。
- Legacy 文書
  - `docs/server-modernization/planning/codex_automation_workplan_revised.md`
  - `docs/server-modernization/planning/codex_automation_prompts_revised.md`
  - `docs/server-modernization/planning/codex_automation_master_prompt.md`
  - 上記は履歴確認専用であり、本 automation の progress source ではない。

## 次に使うファイル
1. `codex_automation_master_prompt.txt` を毎回メインエージェントへ渡す。
2. メインエージェントが plan を読んで未完了先頭タスクを特定する。
3. メインエージェントが `prompts/` 配下の対応 task prompt をそのままサブエージェントへ渡す。
4. 実行後に `logs/` 配下へ RUN_ID 付きログを追加し、plan の該当箇所を更新する。
