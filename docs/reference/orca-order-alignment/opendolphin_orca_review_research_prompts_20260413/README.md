# OpenDolphinNext ORCA 是正 再監査プロンプトセット

内容:
- `10_code_review_prompt.md` : 差し替え後コードの最終再監査用 prompt
- `20_orca_spec_investigation_prompt.md` : ORCA / WebORCA / API 仕様の追加調査用 prompt
- `30_review_report_template.md` : レビュー報告テンプレート
- `31_spec_research_template.md` : 仕様調査メモテンプレート

使い方:
1. まず `10_code_review_prompt.md` を reviewer に渡す
2. reviewer が external/spec ambiguity を検出した場合、または live blocker が repo defect か外因か切り分けできない場合は `20_orca_spec_investigation_prompt.md` を別 agent に渡す
3. 両者の結果を `30_review_report_template.md` と `31_spec_research_template.md` に合わせて統合する
