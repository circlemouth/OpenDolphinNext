# 開発計画インデックス

- 更新日: 2026-03-24
- RUN_ID: 20260324T111046Z

このディレクトリは、現行の開発計画と Legacy/Archive 化した旧計画の索引である。実装着手前に本ファイルを読み、現行計画への導線をここから辿る。

## 現行の開発計画
- [phase2_current_coding_tasks_checklist_v1.md](phase2_current_coding_tasks_checklist_v1.md)
  - 現行の開発計画正本。
  - ファイル名に `phase2` を含むが、2026-03-24 時点では legacy ではなく現行計画として扱う。
  - `server-modernized` の着手可能タスク、依存関係、PR 粒度、検証観点をここに集約する。
- [web_client_contract_followup_checklist.md](web_client_contract_followup_checklist.md)
  - Web クライアントの契約追随用チェックリスト。
  - `server-modernized` の公開契約に合わせて `web-client` 側の blocked route 除去や契約整合を進める際の現行参照。

## Legacy/Archive の開発計画
- [server-modernized-remediation-master-checklist.md](server-modernized-remediation-master-checklist.md)
  - 完遂済みのため、履歴参照専用。
- [../server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-execution-checklist.md](../server-modernization/planning/server-modernized-plan/docs/development/dangerous-path-remediation-execution-checklist.md)
  - 旧「現行計画」。2026-03-24 以降は Legacy/Archive として扱う。
- [../server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remaining-closure-checklist-20260322.md](../server-modernization/planning/server-modernized-plan/docs/development/server-modernized-remaining-closure-checklist-20260322.md)
  - 完遂済みのため、履歴参照専用。

## 関連文書
- [execution-log.md](execution-log.md)
- [pull-request-checklist-template.md](pull-request-checklist-template.md)
- [../DEVELOPMENT_STATUS.md](../DEVELOPMENT_STATUS.md)
- [../server-modernization/README.md](../server-modernization/README.md)

## 補助資料
- [supporting/phase2a_handoff_docs_bundle/phase2a_a1_contract_freeze_pack_v1.md](supporting/phase2a_handoff_docs_bundle/phase2a_a1_contract_freeze_pack_v1.md)
- [supporting/phase2a_handoff_docs_bundle/phase2a_a1_handoff_ticket_seed.csv](supporting/phase2a_handoff_docs_bundle/phase2a_a1_handoff_ticket_seed.csv)
- [supporting/phase2a_handoff_docs_bundle/phase2a_a3_orca_boundary_design_report.md](supporting/phase2a_handoff_docs_bundle/phase2a_a3_orca_boundary_design_report.md)
- [supporting/phase2a_handoff_docs_bundle/phase2a_a3_slice1_file_plan.md](supporting/phase2a_handoff_docs_bundle/phase2a_a3_slice1_file_plan.md)
- [supporting/phase2a_handoff_docs_bundle/phase2a_a5_security_audit_integrity_report_initial.md](supporting/phase2a_handoff_docs_bundle/phase2a_a5_security_audit_integrity_report_initial.md)
- [supporting/phase3_wave2_prompt_pack/README.md](supporting/phase3_wave2_prompt_pack/README.md)
  - `server-modernized` の static-analysis Wave 2 支援資料。`docs/server-modernization/static-analysis-baseline-inventory.md` と連動する。
- [supporting/phase3_wave3_prompt_pack/README.md](supporting/phase3_wave3_prompt_pack/README.md)
  - `server-modernized` の static-analysis Wave 3 支援資料。`docs/server-modernization/static-analysis-baseline-inventory.md` と連動する。
- [supporting/phase3_wave4_prompt_pack/README.md](supporting/phase3_wave4_prompt_pack/README.md)
  - `server-modernized` の static-analysis Wave 4 支援資料。`docs/server-modernization/static-analysis-baseline-inventory.md` と連動する。
- [supporting/phase3_post_decision_prompt_pack/README.md](supporting/phase3_post_decision_prompt_pack/README.md)
  - Phase3+ post-decision 実装の支援資料。repo-only で確定した static-analysis / release gate 判断を repo-local truth に反映する。
- 補助資料は履歴・設計補足・handoff seed の参照用であり、現行開発計画正本ではない。
