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

## Live Runbooks
- [release-validation.md](runbooks/release-validation.md)

## Operations
- [ORCA_CERTIFICATION_ONLY.md](operations/ORCA_CERTIFICATION_ONLY.md)

## Code-Adjacent Docs
- [web-client/README.md](../web-client/README.md)
- `web-client/notes/`
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
