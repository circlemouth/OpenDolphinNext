# Subagent A Inventory Summary

- repo index の実運用ハブは `docs/README.md`
- manager current state は `docs/managerdocs/`
- runtime contracts は `docs/contracts/`
- architecture summary は `docs/architecture/`
- runbooks は `docs/runbooks/`
- operations は `docs/operations/`
- releases は `docs/releases/`
- web-client current contract は `web-client/README.md` 入口 + `web-client/notes/`
- UI / UX reference は `docs/web-client/ux/` と `docs/web-client/architecture/`
- active workflow docs は `docs/implementation/orca-order-alignment/`
- legacy / reference-only は `client/`, `server/`, `ext_lib/`, 旧 `src/discovery/`
- evidence / generated は `artifacts/`

## Duplicate Risks
- root README と docs README の二重入口
- manager 向け web 要約と web-client notes の二重要約
- release boundary を managerdocs / runbooks / web-client notes が重複記述
- ORCA workflow packet 群の役割重複
