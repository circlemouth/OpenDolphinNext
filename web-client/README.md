# OpenDolphin Web Client

この README は `web-client/` の module entry です。current contract の正本は `notes/` に分離し、UI の enduring reference は `docs/web-client/` 側へ寄せます。

## Current Contracts
- [notes/README.md](./notes/README.md)
- [notes/auth-check.md](./notes/auth-check.md)
- [notes/auth-transition.md](./notes/auth-transition.md)
- [notes/patient-context-contract.md](./notes/patient-context-contract.md)
- [notes/feedback-spec.md](./notes/feedback-spec.md)
- [notes/disease-insurance-orca-contract.md](./notes/disease-insurance-orca-contract.md)
- [notes/ui-current-contract.md](./notes/ui-current-contract.md)
- [notes/orca-order-remediation-20260403.md](./notes/orca-order-remediation-20260403.md)
- [notes/orca-order-contract-cleanup-20260404.md](./notes/orca-order-contract-cleanup-20260404.md)
- [notes/release-gate.md](./notes/release-gate.md)
- [notes/security-spec.md](./notes/security-spec.md)

## Enduring UI / Architecture References
- [../docs/web-client/ux/dads_app_ui_design_rules_20260411.md](../docs/web-client/ux/dads_app_ui_design_rules_20260411.md)
- [../docs/web-client/ux/web-client-ui-guideline.md](../docs/web-client/ux/web-client-ui-guideline.md)
- [../docs/web-client/architecture/document-embedded-attachment-policy.md](../docs/web-client/architecture/document-embedded-attachment-policy.md)
- [../docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md](../docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md)

## Release / Validation
- [notes/release-gate.md](./notes/release-gate.md)
- [../docs/runbooks/release-validation.md](../docs/runbooks/release-validation.md)

## Current Summary
- 認証は `/login` 起点
- `returnTo` は sanitize 済み internal path のみを扱う
- 患者文脈は URL / browser storage に残さない
- ORCA route taxonomy は `official=/api/orca/official/*`, `master=/api/orca/master/*`, `local=/api/local/*`
- security 規範の詳細は `notes/security-spec.md` を正本とする
