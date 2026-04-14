# Web Client Overview

この文書は `web-client` の current contract と UI basis を短く把握するための summary です。

## Entry
- [../../web-client/README.md](../../web-client/README.md)
- [../../web-client/notes/README.md](../../web-client/notes/README.md)
- [../managerdocs/03_web_current_contract_summary.md](../managerdocs/03_web_current_contract_summary.md)

## Current Contract
- 認証は `/login` 起点
- factor2 は必要時のみ要求
- patient context は URL / browser storage に残さない
- `returnTo` は sanitize 済み internal path のみ
- logout は cleanup 優先で `replace`
- raw API message や内部詳細は client に露出しない
- ORCA route taxonomy は `official=/api/orca/official/*`, `master=/api/orca/master/*`, `local=/api/local/*`

## Current Notes
- [../../web-client/notes/auth-check.md](../../web-client/notes/auth-check.md)
- [../../web-client/notes/auth-transition.md](../../web-client/notes/auth-transition.md)
- [../../web-client/notes/patient-context-contract.md](../../web-client/notes/patient-context-contract.md)
- [../../web-client/notes/feedback-spec.md](../../web-client/notes/feedback-spec.md)
- [../../web-client/notes/ui-current-contract.md](../../web-client/notes/ui-current-contract.md)
- [../../web-client/notes/release-gate.md](../../web-client/notes/release-gate.md)
- [../../web-client/notes/security-spec.md](../../web-client/notes/security-spec.md)

## Enduring Design Docs
- [../web-client/ux/dads_app_ui_design_rules_20260411.md](../web-client/ux/dads_app_ui_design_rules_20260411.md)
- [../web-client/ux/web-client-ui-guideline.md](../web-client/ux/web-client-ui-guideline.md)
- [../web-client/architecture/document-embedded-attachment-policy.md](../web-client/architecture/document-embedded-attachment-policy.md)
- [../web-client/architecture/web-client-screen-structure-decisions-20260106.md](../web-client/architecture/web-client-screen-structure-decisions-20260106.md)

## Validation Boundary
- live validation の正本は [../runbooks/release-validation.md](../runbooks/release-validation.md)
- README / overview にコマンド正本を二重化しない

## Notes
- UI 非表示や route guard は UX であり認可そのものではない
- シークレットや管理者判断を client に持たせない
