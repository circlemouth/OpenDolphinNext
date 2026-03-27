# Phase3+ Static Analysis Wave 4 Prompt Pack

- 更新日: 2026-03-28
- RUN_ID: 20260327T224925Z

このディレクトリは、`server-modernized` の SpotBugs / FindSecBugs baseline burn-down をさらに進めるための現行支援資料である。
Wave 4 の実行手順と lane 切り出しを保持し、agent からはこの README を起点に読む。

## 参照順
1. [phase3_wave4_static_analysis_dev_doc.md](phase3_wave4_static_analysis_dev_doc.md)
2. [WS0_wave4_orchestrator_prompt.md](WS0_wave4_orchestrator_prompt.md)
3. [WSA_wave4_rest_tail_prompt.md](WSA_wave4_rest_tail_prompt.md)
4. [WSB_wave4_rest_orca_tail_prompt.md](WSB_wave4_rest_orca_tail_prompt.md)
5. [WSC_wave4_persistence_query_tail_prompt.md](WSC_wave4_persistence_query_tail_prompt.md)
6. [WSD_wave4_security_audit_tail_prompt.md](WSD_wave4_security_audit_tail_prompt.md)
7. [WSE_wave4_orca_adapter_tail_prompt.md](WSE_wave4_orca_adapter_tail_prompt.md)
8. [WSF_wave4_orca_converter_tail_prompt.md](WSF_wave4_orca_converter_tail_prompt.md)
9. [WSG_wave4_runtime_security_tail_prompt.md](WSG_wave4_runtime_security_tail_prompt.md)
10. [docs/server-modernization/static-analysis-baseline-inventory.md](../../../server-modernization/static-analysis-baseline-inventory.md)

## 使い方
- Wave 4 の統合担当は `WS0_wave4_orchestrator_prompt.md` から入る。
- 実作業 lane は `WSA` 〜 `WSG` の 7 本に分ける。
- baseline の正本は `docs/server-modernization/static-analysis-baseline-inventory.md` を参照する。
- canonical command は `bash ./scripts/server-modernized/verify-static-analysis.sh` を使う。

## 関連導線
- [docs/development/README.md](../../README.md)
- [docs/server-modernization/README.md](../../../server-modernization/README.md)
- [docs/DEVELOPMENT_STATUS.md](../../../DEVELOPMENT_STATUS.md)
