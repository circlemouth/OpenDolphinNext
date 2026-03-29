# Phase3+ Post-Decision Prompt Pack

- 更新日: 2026-03-29
- RUN_ID: 20260329T060038Z

このディレクトリは、Phase3+ の post-decision 実装を進めるための現行支援資料である。
repo-only で確定した static-analysis / release gate の判断を、repo-local truth として反映するための入口をまとめている。

## 参照順
1. [phase3_post_decision_dev_doc.md](phase3_post_decision_dev_doc.md)
2. [WS0_post_decision_orchestrator_prompt.md](WS0_post_decision_orchestrator_prompt.md)
3. [WSA_inventory_conflict_map_prompt.md](WSA_inventory_conflict_map_prompt.md)
4. [WSB_static_analysis_contract_prompt.md](WSB_static_analysis_contract_prompt.md)
5. [WSC_static_analysis_workflow_restore_prompt.md](WSC_static_analysis_workflow_restore_prompt.md)
6. [WSD_minimal_release_gate_docs_prompt.md](WSD_minimal_release_gate_docs_prompt.md)
7. [phase3_post_decision_shared_context.md](phase3_post_decision_shared_context.md)
8. [phase3_handoff_current_state.md](phase3_handoff_current_state.md)
   - Phase3+ の current state / handoff memo。repo-local truth と残課題の再読用。

## 使い方
- 統合担当は `WS0_post_decision_orchestrator_prompt.md` から読む。
- inventory / conflict map、static-analysis contract、workflow restore、release gate docs を workstream ごとに分ける。
- canonical command と release gate の説明は repo-visible docs と同期させる。

## 関連導線
- [docs/development/README.md](../../README.md)
- [docs/server-modernization/README.md](../../../server-modernization/README.md)
- [docs/DEVELOPMENT_STATUS.md](../../../DEVELOPMENT_STATUS.md)
