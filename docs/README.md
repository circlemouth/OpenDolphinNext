# Docs

`docs/` は現行運用で使う最小の正本セットだけを置きます。歴史的な計画書、phase 文書、prompt pack、証跡 dump は current source of truth にしません。

## まず読む
- [managerdocs/README.md](managerdocs/README.md)
- [contracts/](contracts/)
- [architecture/server-modernization-overview.md](architecture/server-modernization-overview.md)
- [architecture/web-client-overview.md](architecture/web-client-overview.md)
- [runbooks/release-validation.md](runbooks/release-validation.md)

## Manager 向け正本
- [managerdocs/README.md](managerdocs/README.md)
- `docs/managerdocs/` は manager handoff、release readiness、repo-external sign-off、UI improvement program の正本です。
- product improvement の manager 用進行表は [managerdocs/09_web_product_improvement_execution_plan_20260329.md](managerdocs/09_web_product_improvement_execution_plan_20260329.md) を参照してください。

## Current Contracts
- [runtime-config.md](contracts/runtime-config.md)
- [health-endpoints.md](contracts/health-endpoints.md)
- [orca-connection.md](contracts/orca-connection.md)
- [document-integrity.md](contracts/document-integrity.md)
- [patient-images.md](contracts/patient-images.md)
- [orca-master-api.md](contracts/orca-master-api.md)

## Architecture
- [server-modernization-overview.md](architecture/server-modernization-overview.md)
- [web-client-overview.md](architecture/web-client-overview.md)
- [server-internal-modernization-adr.md](architecture/server-internal-modernization-adr.md)

## Implementation
- [orca-order-alignment/README.md](implementation/orca-order-alignment/README.md)

## Live Runbooks
- [release-validation.md](runbooks/release-validation.md)

## Operations
- [ORCA_CERTIFICATION_ONLY.md](operations/ORCA_CERTIFICATION_ONLY.md)

## Code-Adjacent Docs
- [web-client/README.md](../web-client/README.md)
- `web-client/notes/`
- [web-client/product-improvement/README.md](web-client/product-improvement/README.md)
- [server-modernized/reporting/README.md](../server-modernized/reporting/README.md)
- [server-modernized/tools/flyway/README.md](../server-modernized/tools/flyway/README.md)
- [ops/README.md](../ops/README.md)
- [ops/db/local-baseline/README.md](../ops/db/local-baseline/README.md)
- [ops/modernized-server/checks/README.md](../ops/modernized-server/checks/README.md)
- [tests/e2e/README.md](../tests/e2e/README.md)
- [tests/e2e/orca-master.scenarios.md](../tests/e2e/orca-master.scenarios.md)
- [tests/playwright/utils/fixtures/README.md](../tests/playwright/utils/fixtures/README.md)
- [scripts/tools/README.md](../scripts/tools/README.md)
- [.devcontainer/README.md](../.devcontainer/README.md)

## Operating Rule
- docs は delete by default、keep by exception とする。
- code changes と related docs updates は同じ変更で揃える。
- repo に証拠がなければ unknown と扱う。
- `docs/web-client/product-improvement/` は開発オーケストレーション資料置き場であり、current contract の正本ではありません。

## Add / Delete Rule
- 新しい docs を追加してよいのは、current contract、manager handoff、live runbook、enduring architecture summary、code-adjacent README のいずれかに直接該当する場合だけです。
- dated note、phase plan、prompt pack、worker report、verification evidence dump は原則 `docs/` に残しません。
- 既存 docs と役割が重なる場合は新規追加より統合を優先し、正本を 1 本に絞ります。
- reference-only 文書を残す場合は、canonical source を冒頭に明記し、managerdocs / contracts / web-client notes と競合させません。
- repo 内参照が消えており、現行運用の判断・実行に不要な docs は削除を優先します。
