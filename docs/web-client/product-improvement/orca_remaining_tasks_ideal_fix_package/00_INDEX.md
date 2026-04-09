# ORCA 残タスク 完遂パッケージ（ideal-fix edition）

このパッケージは、最新の split review と Codex 実 repo 読みを突き合わせたうえで、
**いま本当に残っている修正**を、担当者が迷わず実装できる粒度まで落とし込んだものです。

## 読む順番
1. `02_execution_plan.md`
2. `03_normative_implementation_spec.md`
3. `04_acceptance_matrix.md`
4. `07_phase0_contract_freeze_checklist.md`
5. `05_subagent_prompts.md`
6. `06_final_report_template.md`

## このパッケージの方針
- 後方互換は不要
- 過去 DB 遺産も前提にしない
- broad fallback / legacy rescue / helper 重複を残さない
- 「catalog にある」ではなく `save / send / server mutation / read / help / test` まで閉じる
- ただし、split review 間で割れた論点は **Phase 0 の read-only 再確認**で確定してから触る
- 実装の理想形を先に固定する。コードを読んでから方針を決めるのではなく、方針に沿ってコードを寄せる

## 主要ドキュメント
- `01_codex_supervisor_prompt.txt`: Codex 統括向けのコピペ用 prompt
- `02_execution_plan.md`: 工程表
- `03_normative_implementation_spec.md`: 実装仕様書
- `04_acceptance_matrix.md`: 受け入れ条件と検証項目
- `05_subagent_prompts.md`: サブエージェント用 prompt 集
- `06_final_report_template.md`: 最終報告テンプレート
- `07_phase0_contract_freeze_checklist.md`: 実 repo 再確認チェックリスト
