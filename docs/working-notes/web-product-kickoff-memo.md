# Web Product Improvement Kickoff Memo

- RUN_ID: `20260329T232932Z`
- branch: `codex/web-product-improvement-docs-20260329`
- scope: `web-client/` の current contract を壊さない product improvement。repo-external は除外。

## Stage 0 Inventory

### 主要 touchpoint
- auth / redirect: `web-client/src/LoginScreen.tsx`, `web-client/src/features/login/loginErrorMessage.ts`, `web-client/src/AppRouter.tsx`, `web-client/src/libs/session/sessionExpiry.ts`, `web-client/src/features/login/loginRouteState.ts`
- patient context / recovery: `web-client/src/routes/useAppNavigation.ts`, `web-client/src/features/shared/ReturnToBar.tsx`, `web-client/src/features/patients/PatientsPage.tsx`, `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`, `web-client/src/features/shared/ApiFailureBanner.tsx`, `web-client/src/features/shared/apiError.ts`
- charts / admin guardrail: `web-client/src/features/charts/SoapNotePanel.tsx`, `web-client/src/features/charts/DocumentTimeline.tsx`, `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`, `web-client/src/features/administration/AdministrationPage.tsx`, `web-client/src/features/administration/api.ts`
- notes / manager docs: `web-client/notes/auth-transition.md`, `web-client/notes/patient-context-contract.md`, `web-client/notes/feedback-spec.md`, `web-client/notes/ui-current-contract.md`, `docs/managerdocs/03_web_current_contract_summary.md`, `docs/managerdocs/04_ui_improvement_program.md`, `docs/managerdocs/06_open_unknowns_and_evidence_gaps.md`

### 既存 test の所在
- auth: `web-client/src/__tests__/LoginScreen.test.tsx`, `web-client/src/features/login/__tests__/loginErrorMessage.test.ts`, `web-client/src/__tests__/AppRouter.login-redirect.test.tsx`, `web-client/src/libs/session/sessionExpiry.test.ts`
- navigation / patient context: `web-client/src/routes/__tests__/useAppNavigation.test.tsx`, `web-client/src/routes/__tests__/NavigationGuardProvider.test.tsx`
- recovery / shared: `web-client/src/features/shared/__tests__/ReturnToBar.test.tsx`, `web-client/src/features/shared/__tests__/ApiFailureBanner.test.tsx`, `web-client/src/features/shared/apiError.test.ts`
- Patients / Mobile Images / Administration: `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`, `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`, `web-client/src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx`

## Quick Win / Evidence-First Split

### quick win として code 変更まで進めるもの
- BL-01 / BL-02: auth exception copy matrix の docs 固定、`LoginScreen` の段階表示と factor2 copy 改善
- BL-03 / BL-14: `/login` に戻された理由表示、redirect reason taxonomy の helper 化、scrub explanation の microcopy
- BL-05 / BL-09: `ReturnToBar` 実装、surface-aware lost-context CTA、canonical feedback copy の整理

### 先に evidence を固めるもの
- Patients の route-specific source priority
- Mobile Images の route-specific source priority
- route 別 minimal encounter context schema
- admin current UI detail
- auto-sync / auto-action current behavior
- a11y / focus / keyboard / narrow layout の current behavior

## Guardrail

- `replace` を `push` に変えない
- patient context を URL / `localStorage` / `sessionStorage` に永続化しない
- Charts の通常主面は `SoapNotePanel` を維持する
- `DocumentTimeline` / `MedicalOutpatientRecordPanel` を debug-only から昇格させない
- admin SoT は `/api/admin/config` のままにする
- raw backend/internal detail を user-visible copy に出さない
