# Docs

`docs/` は enduring な current docs の正本入口です。`docs/README.md` を全体索引とし、current / workflow / reference / archive / ops-verification / evidence をここで分離します。

## Current / Enduring Docs
- [managerdocs/README.md](managerdocs/README.md)
- [contracts/](contracts/)
- [contracts/audit-log.md](contracts/audit-log.md)
- [contracts/audit-event-coverage-inventory.md](contracts/audit-event-coverage-inventory.md)
- [contracts/chart-authority-api.md](contracts/chart-authority-api.md)
- [contracts/disease-boundary.md](contracts/disease-boundary.md)
- [contracts/chart-finalize-snapshot.md](contracts/chart-finalize-snapshot.md)
- [contracts/orca-ledger-and-unknown-state.md](contracts/orca-ledger-and-unknown-state.md)
- [contracts/prescription-authority.md](contracts/prescription-authority.md)
- [contracts/prescription-authority-api.md](contracts/prescription-authority-api.md)
- [contracts/protected-export-authorization-matrix.md](contracts/protected-export-authorization-matrix.md)
- [architecture/](architecture/)
- [architecture/repository-doc-taxonomy.md](architecture/repository-doc-taxonomy.md)
- [architecture/ehr-orca-source-of-truth-boundary.md](architecture/ehr-orca-source-of-truth-boundary.md)
- [architecture/ehr-chart-prescription-authority.md](architecture/ehr-chart-prescription-authority.md)
- [architecture/orca-integration-safety-contract.md](architecture/orca-integration-safety-contract.md)
- [runbooks/](runbooks/)
- [runbooks/backup-restore-hash-verification.md](runbooks/backup-restore-hash-verification.md)
- [runbooks/orca-outage-recovery.md](runbooks/orca-outage-recovery.md)
- [runbooks/production-operations-readiness.md](runbooks/production-operations-readiness.md)
- [operations/](operations/)
- [operations/orca-unknown-state-runbook.md](operations/orca-unknown-state-runbook.md)
- [testing/ehr-orca-required-test-matrix.md](testing/ehr-orca-required-test-matrix.md)
- [validation/release-validation-report.md](validation/release-validation-report.md)
- [releases/](releases/)
- [web-client/architecture/](web-client/architecture/)
- [web-client/ux/](web-client/ux/)
- [web-client/ux/medical-safety-ui-rules.md](web-client/ux/medical-safety-ui-rules.md)
- [../web-client/README.md](../web-client/README.md)
- [../web-client/notes/README.md](../web-client/notes/README.md)

## Workflow Docs
- [implementation/README.md](implementation/README.md)
- [implementation/opendolphin-next-remaining-tasks-20260513T113016Z/README.md](implementation/opendolphin-next-remaining-tasks-20260513T113016Z/README.md)
- [implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND1.md](implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND1.md)
- [implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND2.md](implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND2.md)
- [implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND3.md](implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND3.md)
- [implementation/opendolphin-next-orca-ehr-completion-20260510T092335Z/README.md](implementation/opendolphin-next-orca-ehr-completion-20260510T092335Z/README.md)
- [implementation/orca-trial-phase3-retry-20260421T060636Z/MAIN_AGENT_REPORT.md](implementation/orca-trial-phase3-retry-20260421T060636Z/MAIN_AGENT_REPORT.md)
- [implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-A-orca-wrapper-contract-report.md](implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-A-orca-wrapper-contract-report.md)
- [implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-B-readiness-classifier-report.md](implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-B-readiness-classifier-report.md)
- [implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-C-local-selector-candidates-report.md](implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-C-local-selector-candidates-report.md)
- [implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-D-package-rerun-report.md](implementation/orca-trial-readonly-contract-fix-20260420T000000Z/subagent-D-package-rerun-report.md)
- [implementation/orca-trial-readonly-diagnostics-20260420T000000Z/README.md](implementation/orca-trial-readonly-diagnostics-20260420T000000Z/README.md)
- [implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-A-official-patientget-500-report.md](implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-A-official-patientget-500-report.md)
- [implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-D-evidence-rerun-package-report.md](implementation/orca-trial-readonly-diagnostics-20260420T000000Z/subagent-D-evidence-rerun-package-report.md)
- [implementation/orca-trial-readonly-preflight-harness-20260420T000000Z/subagent-C-docs-report.md](implementation/orca-trial-readonly-preflight-harness-20260420T000000Z/subagent-C-docs-report.md)
- [implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/README.md](implementation/orca-trial-readonly-preflight-harness-20260419T220346Z/README.md)
- [implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/README.md](implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/README.md)
- [implementation/opendolphin-postfix-static-remediation-20260418/README.md](implementation/opendolphin-postfix-static-remediation-20260418/README.md)
- [implementation/opendolphin-webclient-followup-release-gate-package-20260417/](implementation/opendolphin-webclient-followup-release-gate-package-20260417/)
- [implementation/opendolphin-webclient-remaining-followup-package-20260417/](implementation/opendolphin-webclient-remaining-followup-package-20260417/)
- [implementation/clinical-functional-release-readiness-roadmap-20260422/README.md](implementation/clinical-functional-release-readiness-roadmap-20260422/README.md)
- [implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md](implementation/clinical-functional-release-readiness-roadmap-20260422/order-family-v2-candidate-research-20260425T215740Z.md)
- [implementation/orca-order-alignment/README.md](implementation/orca-order-alignment/README.md)
- [implementation/orca-order-alignment/orca_order_alignment_authoritative_spec_packet_20260407.md](implementation/orca-order-alignment/orca_order_alignment_authoritative_spec_packet_20260407.md)
- [implementation/orca-order-alignment/orca_order_alignment_authoritative_tables_20260407.json](implementation/orca-order-alignment/orca_order_alignment_authoritative_tables_20260407.json)
- [implementation/orca-order-alignment/orca_order_alignment_execution_plan_checklist_self_contained_20260407.md](implementation/orca-order-alignment/orca_order_alignment_execution_plan_checklist_self_contained_20260407.md)
- [implementation/opendolphin-webclient-implementation-package-20260417/README.md](implementation/opendolphin-webclient-implementation-package-20260417/README.md)
- [implementation/opendolphin-webclient-implementation-package-20260416/README.md](implementation/opendolphin-webclient-implementation-package-20260416/README.md)
- [codex/README.md](codex/README.md)
- [codex/unified-orca-postretry-clinical-wave1-20260421/README.md](codex/unified-orca-postretry-clinical-wave1-20260421/README.md)
- [codex/clinical-input-cwp01-karte-order-persistence-20260421/README.md](codex/clinical-input-cwp01-karte-order-persistence-20260421/README.md)
- [codex/clinical-input-wave2a-20260421/README.md](codex/clinical-input-wave2a-20260421/README.md)
- [codex/clinical-input-test-wave1-20260421/README.md](codex/clinical-input-test-wave1-20260421/README.md)
- [agent-prompts/README.md](agent-prompts/README.md)
- current workflow の実行正本は [runbooks/release-validation.md](runbooks/release-validation.md)、[runbooks/reviewer-submission-packet.md](runbooks/reviewer-submission-packet.md)、[releases/orca-remediation-cutover.md](releases/orca-remediation-cutover.md) です。
- `docs/implementation/` には workstream index と active workflow background を置き、dated packet / closeout / recovery を current 導線に混ぜません。

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

### Test Boundary Matrix
- `CI`: `.github/workflows/*`, `tests/e2e/`
- `helper`: `tests/charts/`, `tests/reception/`, `tests/images/`, `tests/playwright/`, `tests/review-package/`, `tests/review-packet/`, `ops/tests/orca-trial-requests/`
- `manual`: `ops/tests/api-smoke-test/`, `ops/tests/storage/attachment-mode/`, `ops/tests/security/factor2/`
- `evidence`: `artifacts/validation/e2e/`, `artifacts/parity-manual/`, `artifacts/reviewer-submission-packets/`
- `deprecated`: logs-only review archive flow

## Source Of Truth Map
- repo / docs index: この `docs/README.md`
- manager current state: `docs/managerdocs/`
- runtime contracts: `docs/contracts/`
- architecture summary: `docs/architecture/`
- EHR / ORCA safety boundary: `docs/architecture/ehr-orca-source-of-truth-boundary.md`、`docs/architecture/ehr-chart-prescription-authority.md`、`docs/architecture/orca-integration-safety-contract.md`
- live runbooks: `docs/runbooks/`
- release validation report template: `docs/validation/release-validation-report.md`
- operations runbook: `docs/operations/`
- EHR / ORCA UNKNOWN operations: `docs/operations/orca-unknown-state-runbook.md`
- EHR / ORCA required test matrix: `docs/testing/ehr-orca-required-test-matrix.md`
- release / cutover: `docs/releases/`
- web-client current contract: `web-client/README.md` と `web-client/notes/`
- UI / UX basis: `docs/web-client/ux/` と `docs/web-client/architecture/`
- Medical safety UI: `docs/web-client/ux/medical-safety-ui-rules.md`
- evidence: `artifacts/`

## Rules
- current contract は `docs/contracts/`、`docs/managerdocs/`、`web-client/notes/` に絞る。
- workflow 実行手順は `docs/runbooks/` と `docs/releases/` に寄せる。
- background reference は `docs/reference/` へ置く。
- dated packet / prompt / handoff / closeout / review docs は `docs/archive/` へ移す。
- evidence や generated output は `artifacts/` に置き、source of truth に昇格させない。
- 重複した source of truth を増やさず、既存の正本へリンクで寄せる。
