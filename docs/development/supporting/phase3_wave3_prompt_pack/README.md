# Phase3+ Static Analysis Wave 3 Prompt Pack

- 更新日: 2026-03-28
- RUN_ID: 20260327T152028Z

このディレクトリは、`server-modernized` の SpotBugs / FindSecBugs baseline burn-down をさらに進めるための現行支援資料である。
Wave 3 の実行手順と lane 切り出しを保持し、agent からはこの README を起点に読む。

## 参照順
1. [phase3_wave3_static_analysis_dev_doc.md](phase3_wave3_static_analysis_dev_doc.md)
2. [WS0_wave3_orchestrator_prompt.md](WS0_wave3_orchestrator_prompt.md)
3. [WSA_wave3_kensa_sort_dynamic_sql_prompt.md](WSA_wave3_kensa_sort_dynamic_sql_prompt.md)
4. [WSB_wave3_converter_setmodel_prompt.md](WSB_wave3_converter_setmodel_prompt.md)
5. [WSC_wave3_orca_gateway_push_prompt.md](WSC_wave3_orca_gateway_push_prompt.md)
6. [WSD_wave3_admin_rest_tail_prompt.md](WSD_wave3_admin_rest_tail_prompt.md)
7. [docs/server-modernization/static-analysis-baseline-inventory.md](../../../server-modernization/static-analysis-baseline-inventory.md)

## 使い方
- Wave 3 の統合担当は `WS0_wave3_orchestrator_prompt.md` から入る。
- 実作業 lane は `WSA` 〜 `WSD` の 4 本に分ける。
- baseline の正本は `docs/server-modernization/static-analysis-baseline-inventory.md` を参照する。
- canonical command は `bash ./scripts/server-modernized/verify-static-analysis.sh` を使う。

## 関連導線
- [docs/development/README.md](../../README.md)
- [docs/server-modernization/README.md](../../../server-modernization/README.md)
- [docs/DEVELOPMENT_STATUS.md](../../../DEVELOPMENT_STATUS.md)
