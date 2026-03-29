# Web client overview

この文書は `web-client` の現行 contract を短く把握するための summary です。

## 入口
- module README: [`web-client/README.md`](../../web-client/README.md)
- manager 向け要約: [../managerdocs/03_web_current_contract_summary.md](../managerdocs/03_web_current_contract_summary.md)

## 現行の contract
- 認証は `/login` 起点
- factor2 は必要時のみ要求
- patient context は URL / browser storage に残さない
- `returnTo` は sanitize 済み internal path のみ
- logout は cleanup 優先で `replace`
- raw API message や内部詳細は client に露出しない

## 参考となる notes
- `web-client/notes/auth-check.md`
- `web-client/notes/auth-transition.md`
- `web-client/notes/patient-context-contract.md`
- `web-client/notes/feedback-spec.md`
- `web-client/notes/ui-current-contract.md`
- `web-client/notes/release-gate.md`
- `web-client/notes/security-spec.md`

## enduring design docs
- `docs/web-client/ux/web-client-ui-guideline.md`
- `docs/web-client/architecture/document-embedded-attachment-policy.md`
- `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md`

## release gate
- `cd web-client && npm run ci`
- `cd web-client && node scripts/runtime-ready-smoke.mjs`

## 注意
- UI 非表示や route guard は UX であり認可そのものではない
- シークレットや管理者判断を client に持たせない
