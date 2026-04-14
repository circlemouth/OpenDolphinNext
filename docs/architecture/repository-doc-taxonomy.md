# Repository Document Taxonomy

## Purpose

この文書は、repository 内の文書を current / workflow / reference / archive / evidence に分け、どこが source of truth かを固定する enduring taxonomy です。

## Categories

### Current / Enduring Docs
- `docs/README.md`: docs 全体索引の正本
- `docs/managerdocs/`: manager current state と release boundary
- `docs/contracts/`: runtime / public contract
- `docs/architecture/`: enduring architecture summary
- `docs/runbooks/`: live runbook
- `docs/operations/`: operational runbook
- `docs/releases/`: cutover / rollback / release procedure
- `docs/web-client/architecture/`, `docs/web-client/ux/`: UI/UX の enduring reference
- `web-client/README.md`, `web-client/notes/`: web-client current contract

### Current Workflow Docs
- `docs/implementation/`: active workstream index
- `docs/implementation/orca-order-alignment/`: ORCA order alignment の current workflow 入口
- workflow の実行正本は `docs/runbooks/` と `docs/releases/` へ寄せる

### Reference
- `docs/reference/`: 背景資料、履歴調査、仕様根拠
- reference は current contract を置き換えず、必ず正本への導線を併記する

### Archive
- `docs/archive/`: dated packet / prompt / handoff / closeout / recovery / review template
- archive は current docs の導線から外し、履歴保持のためだけに残す

### Ops / Verification / Automation
- `ops/`: manual / ops harness と環境起動
- `tests/`: 自動テスト本体
- `scripts/`: thin runner / packager
- `.github/workflows/`: 実際の CI entry

### Evidence / Generated
- `artifacts/`, `tmp/`, `output/`, `**/target/`, `**/dist/`, `**/node_modules/`, `**/test-results/`
- RUN_ID 固定の packet / logs / screenshots / validation output
- evidence は source of truth ではない

## Canonical Rules
- repo-wide docs hub は `docs/README.md`
- manager current state は `docs/managerdocs/`
- public / runtime contract は `docs/contracts/`
- web-client current contract は `web-client/notes/`
- DADS reference は `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Flyway migration の canonical source は `server-modernized/tools/flyway/sql`
- closeout / review / runtime evidence の canonical storage は `artifacts/`

## Boundary Rules
- current / workflow / reference / archive / evidence を混在させない
- dated packet を current entry に載せない
- duplicate source of truth を増やさず、既存の正本へリンクで寄せる
- build artifact や review package を source of truth 判定に使わない
