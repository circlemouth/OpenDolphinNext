# Docs

`docs/` は enduring な current docs の正本入口です。`docs/README.md` を全体索引とし、current / workflow / reference / archive / ops-verification / evidence をここで分離します。

## Current / Enduring Docs
- [managerdocs/README.md](managerdocs/README.md)
- [contracts/](contracts/)
- [architecture/](architecture/)
- [architecture/repository-doc-taxonomy.md](architecture/repository-doc-taxonomy.md)
- [runbooks/](runbooks/)
- [operations/](operations/)
- [releases/](releases/)
- [web-client/architecture/](web-client/architecture/)
- [web-client/ux/](web-client/ux/)
- [../web-client/README.md](../web-client/README.md)
- [../web-client/notes/README.md](../web-client/notes/README.md)

## Workflow Docs
- [implementation/README.md](implementation/README.md)
- [implementation/orca-order-alignment/README.md](implementation/orca-order-alignment/README.md)
- current workflow の実行正本は [runbooks/release-validation.md](runbooks/release-validation.md)、[runbooks/reviewer-submission-packet.md](runbooks/reviewer-submission-packet.md)、[releases/orca-remediation-cutover.md](releases/orca-remediation-cutover.md) です。
- `docs/implementation/` には workstream index だけを置き、dated packet / prompt / closeout / review template を current 導線に混ぜません。

## Reference
- [reference/README.md](reference/README.md)
- [reference/orca-order-alignment/README.md](reference/orca-order-alignment/README.md)
- [reference/repository-history/README.md](reference/repository-history/README.md)
- DADS は [web-client/ux/dads_app_ui_design_rules_20260411.md](web-client/ux/dads_app_ui_design_rules_20260411.md) を enduring reference とし、別文書へ焼き直しません。

## Archive
- [archive/README.md](archive/README.md)
- [archive/orca-order-alignment/README.md](archive/orca-order-alignment/README.md)
- archive は履歴保持のために残す領域です。current contract や workflow の実行入口にはしません。

## Ops / Verification Boundary
- [../ops/README.md](../ops/README.md): 環境起動と manual / ops harness
- [../tests/e2e/README.md](../tests/e2e/README.md): 自動テスト本体の説明
- [../scripts/tools/README.md](../scripts/tools/README.md): thin runner / packaging tool reference
- [../.github/workflows/](../.github/workflows/): 実際の CI entry
- [../artifacts/README.md](../artifacts/README.md): evidence / generated outputs

CI の正本は `.github/workflows/` の実ジョブです。`runtime-ready-smoke`、ORCA live QA、`ops/tests/api-smoke-test`、reviewer submission packet 生成は manual gate として扱います。

## Source Of Truth Map
- repo / docs index: この `docs/README.md`
- manager current state: `docs/managerdocs/`
- runtime contracts: `docs/contracts/`
- architecture summary: `docs/architecture/`
- live runbooks: `docs/runbooks/`
- operations runbook: `docs/operations/`
- release / cutover: `docs/releases/`
- web-client current contract: `web-client/README.md` と `web-client/notes/`
- UI / UX basis: `docs/web-client/ux/` と `docs/web-client/architecture/`
- evidence: `artifacts/`

## Rules
- current contract は `docs/contracts/`、`docs/managerdocs/`、`web-client/notes/` に絞る。
- workflow 実行手順は `docs/runbooks/` と `docs/releases/` に寄せる。
- background reference は `docs/reference/` へ置く。
- dated packet / prompt / handoff / closeout / review docs は `docs/archive/` へ移す。
- evidence や generated output は `artifacts/` に置き、source of truth に昇格させない。
- 重複した source of truth を増やさず、既存の正本へリンクで寄せる。
