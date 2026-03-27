# Phase3+ Static Analysis Wave 2 Prompt Pack

- 更新日: 2026-03-27
- RUN_ID: 20260327T134212Z

このディレクトリは、`server-modernized` の SpotBugs / FindSecBugs baseline burn-down を進めるための現行支援資料である。
Wave 1 の inventory と Wave 2 の実行手順を分けて保持し、agent からはこの README を起点に読む。

## 参照順
1. [phase3_wave2_static_analysis_dev_doc.md](phase3_wave2_static_analysis_dev_doc.md)
2. [WS0_wave2_orchestrator_prompt.md](WS0_wave2_orchestrator_prompt.md)
3. [WSA_open_orca_rest_fixture_cleanup_prompt.md](WSA_open_orca_rest_fixture_cleanup_prompt.md)
4. [WSB_converter_defensive_copy_prompt.md](WSB_converter_defensive_copy_prompt.md)
5. [WSC_orca_session_nullability_prompt.md](WSC_orca_session_nullability_prompt.md)
6. [WSD_tail_cleanup_inventory_refresh_prompt.md](WSD_tail_cleanup_inventory_refresh_prompt.md)
7. [docs/server-modernization/static-analysis-baseline-inventory.md](../../../server-modernization/static-analysis-baseline-inventory.md)

## 使い方
- Wave 2 の統合担当は `WS0_wave2_orchestrator_prompt.md` から入る。
- 実作業 lane は `WSA` 〜 `WSD` の 4 本に分ける。
- baseline の正本は `docs/server-modernization/static-analysis-baseline-inventory.md` を参照する。
- canonical command は `bash ./scripts/server-modernized/verify-static-analysis.sh` を使う。

## 関連導線
- [docs/development/README.md](../../README.md)
- [docs/server-modernization/README.md](../../../server-modernization/README.md)
- [docs/DEVELOPMENT_STATUS.md](../../../DEVELOPMENT_STATUS.md)
