# ORCA残タスク完遂パッケージ

このパッケージは、最新の再検証報告で「受理不可」となった残タスクを **Codex で実装修正・検証・証跡収集まで完遂** させるための実行用ドキュメント一式です。

## 収録ファイル

- `01_codex_supervisor_prompt.txt`
  - Codex 統括エージェント向けのコピペ用メインプロンプト
- `02_execution_plan.md`
  - 工程表、依存関係、フェーズ分割、Done 条件
- `03_detailed_remaining_task_spec.md`
  - 実装仕様書。残タスクの expected contract、ファイル別変更指示、禁止事項、no-regression 項目を記載
- `04_acceptance_and_verification_matrix.md`
  - 受け入れ条件、テスト観点、必須コマンド、grep gate
- `05_subagent_prompts.md`
  - サブエージェント別の詳細プロンプト
- `06_final_report_template.md`
  - Codex の最終報告テンプレート

## 使い方

1. リポジトリとこのディレクトリを同じ作業環境に置く
2. `01_codex_supervisor_prompt.txt` を Codex に貼る
3. Codex に最初に `02`、`03`、`04`、`05` を読ませる
4. サブエージェント並列で実装する
5. `04` の必須テストと grep gate を完走させる
6. `06` の形式で証跡つき最終報告を出させる

## このパッケージの方針

- 後方互換は不要
- 過去の DB 遺産はない前提
- broad rule / broad regex / legacy fallback は残さない
- catalog に定義があるだけでは完了扱いにしない
- `save / send / server mutation / read / help / test` が閉じるまで完了扱いにしない
- build / test / verify / static-analysis は **ログつきで証明** する
