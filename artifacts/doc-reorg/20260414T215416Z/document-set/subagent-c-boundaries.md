# Subagent C Boundaries Summary

- CI の正本は `.github/workflows/` の実ジョブ
- `runtime-ready-smoke`、ORCA live QA、`ops/tests/api-smoke-test`、reviewer submission packet は manual gate
- `ops/` は manual / ops harness、`tests/` は automated tests、`scripts/` は thin runner、`artifacts/` は evidence
- non-doc findings:
  - tracked artifacts が多い
  - `web-client` lockfile が二重
  - reviewer packaging script が並立
  - manual vs CI artifact path がずれる
  - Flyway canonical と local baseline seed の説明差分が残る
