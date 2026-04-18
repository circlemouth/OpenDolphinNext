# OpenDolphinNext ORCA closeout recovery packet R3

> Archive note: this packet is historical. `PASS` / close 条件 / final report template language in this directory is not current evidence. Current status is tracked by `../../../implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md` and current contracts/runbooks.

この packet は、差し替え後レビューで残った未完了を完遂するための Codex 用 prompt セットです。

今回の狙いは広い再実装ではなく、次の 3 つです。

1. `/appointments/medical-information` 502 と live fullflow blocker の根因切り分けと必要なら repo fix
2. new RUN_ID の live evidence / closeout / provenance を current accepted HEAD で取り直す
3. reviewer 提出用 zip 作成スクリプトを logs-only 方式から完全に置き換え、review-checkout + closeout-packet を同梱する submission packet を作る

## 使う順番

1. `10_main_agent_prompt.md` をメインエージェントに貼る
2. メインエージェントが `20_*`〜`23_*` を gpt-5.4 high サブエージェントへ渡す
3. 最後に `30_final_report_template.md` で報告を整える

## 同梱ファイル

- `00_remaining_scope.md`
- `01_submission_packet_contract.md`
- `10_main_agent_prompt.md`
- `20_subagent_runtime_blockers_prompt.md`
- `21_subagent_patients_import_evidence_prompt.md`
- `22_subagent_submission_packet_rewrite_prompt.md`
- `23_subagent_docs_reports_prompt.md`
- `30_final_report_template.md`

## 今回の重点

- PR2 は再実装ではなく import path の再証跡と controlled mapping の最終確認
- PR3 は accept -> charts handoff と `appointments/medical-information` 502 の runtime 根因を詰める
- PR6 は complete closeout packet と reviewer submission packet を current accepted HEAD から再生成する
- 既存 `create-review-archive.sh` 方式は残さなくてよい
- review 用 zip は `.git` を持つ clean review-checkout と、同一 RUN_ID の closeout-packet を分離同梱する
