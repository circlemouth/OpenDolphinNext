# OpenDolphinNext ORCA整合 完遂パッケージ

このパッケージは、**現在コードのみ** を根拠に洗い出された未完了項目を、Codex エージェントで **最後まで実装・検証・同期** させるための実行用ドキュメント群です。

## 使う順番
1. `01_codex_supervisor_prompt.txt`
2. `03_development_spec.md`
3. `04_verification_matrix.md`
4. `02_subagent_prompts.md`

## 同梱物
- `01_codex_supervisor_prompt.txt`
  - Codex 統括エージェントにそのまま貼る主プロンプト
- `02_subagent_prompts.md`
  - SoT/Client/Server/Test&Docs/Final Audit 用の専門サブエージェントプロンプト
- `03_development_spec.md`
  - 背景、current contract、詳細タスク、変更対象ファイル、実装方針
- `04_verification_matrix.md`
  - 受け入れ条件、検証手順、対象テスト、grep gate、完了判定

## 前提
- hidden report や過去レビュー結果を根拠にせず、**現在コード** と本ドキュメントだけで進める
- 後方互換性は不要
- 過去のデータベース遺産はない前提
- build 成果物や生成物が zip に入っていても無視し、コードのみを見る
- 「catalog に定義がある」だけでは不十分で、**save / send / server mutation / read / help / test** まで閉じる

## 完了の定義
- `03_development_spec.md` の current contract と `04_verification_matrix.md` の全項目を満たす
- targeted tests / full tests / build / typecheck を通す
- stale help / docs / tests を同期する
- 未解決・未確認を残さない
