# 実行ログ運用

- 配置先: `docs/server-modernization/planning/codex_automation_orchestration/logs/`
- ファイル名: `RUN_ID-TASK_ID-short-title.md`
- 例: `20260320T113001Z-A01-direct-deps.md`

## 最低限残す内容
- RUN_ID
- 実行したタスク ID と名称
- メインエージェントが召喚したサブエージェントの役割
- 変更ファイル一覧
- 実行コマンド一覧
- テスト結果
- blocker の有無
- 次回の先頭タスク

## 注意
- plan のチェック更新だけで終わらせず、タスクごとの差分根拠を必ずログへ残す。
- blocker で停止した場合もログは作成する。
