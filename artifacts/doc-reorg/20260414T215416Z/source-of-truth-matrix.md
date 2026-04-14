# Source Of Truth Matrix

| Topic | Canonical | Secondary / Support | Not Canonical |
| --- | --- | --- | --- |
| repo index | `docs/README.md` | `README.md` | packet / archive docs |
| manager current state | `docs/managerdocs/README.md` + `01`-`07` | `docs/architecture/*`, `web-client/notes/*` | workstream packet |
| architecture summary | `docs/architecture/server-modernization-overview.md`, `docs/architecture/web-client-overview.md`, `docs/architecture/server-internal-modernization-adr.md`, `docs/architecture/repository-doc-taxonomy.md` | module README | evidence / archive |
| runtime contracts | `docs/contracts/` | `web-client/notes/*`, architecture summary | packet / evidence |
| runbooks | `docs/runbooks/release-validation.md`, `docs/runbooks/reviewer-submission-packet.md` | `docs/operations/ORCA_CERTIFICATION_ONLY.md`, `docs/releases/orca-remediation-cutover.md` | closeout packet / recovery packet |
| operations | `docs/operations/ORCA_CERTIFICATION_ONLY.md` | `ops/README.md` | ad-hoc evidence dump |
| releases | `docs/releases/orca-remediation-cutover.md` | `docs/runbooks/release-validation.md` | archive packet |
| web-client current contract | `web-client/notes/README.md` + individual note files | `web-client/README.md`, `docs/managerdocs/03_web_current_contract_summary.md` | dated packet / stale UI memo |
| UI / UX reference | `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` | `docs/web-client/ux/web-client-ui-guideline.md`, `docs/web-client/architecture/*` | duplicated DADS summary |
| active workflow docs | `docs/implementation/README.md`, `docs/implementation/orca-order-alignment/README.md` | runbooks / releases | archive packet / prompt |
| ORCA workflow background | `docs/reference/orca-order-alignment/` | contracts / web-client notes | closeout packet / evidence |
| repository history / discovery | `docs/reference/repository-history/` | `LICENSE`, root `README.md` | implementation source |
| legacy reference | `client/`, `server/`, `ext_lib/` | docs/reference/repository-history | current contract docs |
| evidence / generated | `artifacts/README.md` と `artifacts/` 実体 | `docs/runbooks/*` の evidence path 記述 | `docs/` の source-of-truth 判定 |
| Flyway canonical source | `server-modernized/tools/flyway/sql` | `server-modernized/tools/flyway/README.md` | `target/classes/db/migration`, local baseline seed |

## Duplicate Reduction Summary

- repo index は `README.md` と `docs/README.md` の二重入口から、`docs/README.md` 中心へ整理
- ORCA workflow は `docs/implementation/orca-order-alignment/` の packet 混在から、workflow index / reference / archive に分離
- repository history は `src/discovery/` から `docs/reference/repository-history/` へ移し、docs taxonomy に合わせた
- UI docs は DADS を enduring reference とし、project-local guideline と current contract を別層に整理
